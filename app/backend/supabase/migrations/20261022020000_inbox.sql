-- Hộp thư đa kênh: every inbound conversation (Messenger, hotline) becomes a
-- thread that intake turns into a lead or merges into an existing one. The public
-- driver form creates leads directly (21_lead_sale_public_intake.sql).
create table public.lead_inbox_threads (
  id text primary key default 'HT-'||gen_random_uuid(),
  channel text not null check (channel in ('facebook','form','hotline')),
  page_id text not null default '',
  external_id text not null,
  name text not null default '',
  phone text,
  status text not null default 'open' check (status in ('open','linked','spam','closed')),
  lead_id text references public.leads(id),
  unread integer not null default 0,
  last_text text not null default '',
  last_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  unique (channel, page_id, external_id)
);
create index lead_inbox_threads_last on public.lead_inbox_threads(last_at desc);
create table public.lead_inbox_messages (
  id text primary key default 'TM-'||gen_random_uuid(),
  thread_id text not null references public.lead_inbox_threads(id),
  direction text not null check (direction in ('in','out','note','system')),
  body text not null default '',
  mid text unique,
  actor_id bigint references public.sales(id),
  status text not null default 'sent' check (status in ('sent','failed','pending')),
  error text,
  at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create index lead_inbox_messages_thread on public.lead_inbox_messages(thread_id, at);

alter table public.lead_inbox_threads enable row level security;
alter table public.lead_inbox_messages enable row level security;
revoke all on public.lead_inbox_threads, public.lead_inbox_messages from anon, authenticated;
grant select on public.lead_inbox_threads, public.lead_inbox_messages to authenticated;
create policy lead_inbox_threads_read on public.lead_inbox_threads for select to authenticated
  using ((private.lead_actor(false)->>'role') in ('admin','intake'));
create policy lead_inbox_messages_read on public.lead_inbox_messages for select to authenticated
  using ((private.lead_actor(false)->>'role') in ('admin','intake'));

-- Normalises Vietnamese mobile numbers the same way lead_command does.
create or replace function private.lead_phone(p text) returns text language sql immutable as $$
  select case when v ~ '^\+?84[0-9]{9}$' then '0'||right(v,9) when v ~ '^0[0-9]{9}$' then v end
  from (select regexp_replace(coalesce(p,''),'[[:space:]().-]','','g') v) x;
$$;

-- Server-side intake used by the Facebook webhook (service role) and hotline logging.
create or replace function private.lead_inbox_ingest(
  p_channel text, p_page text, p_external text, p_name text, p_phone text,
  p_body text, p_mid text, p_direction text default 'in', p_data jsonb default '{}'::jsonb
) returns text language plpgsql security definer set search_path=public,private as $$
declare thread text; inbound boolean := p_direction='in';
begin
  if p_mid is not null and exists(select 1 from public.lead_inbox_messages where mid=p_mid) then
    select thread_id into thread from public.lead_inbox_messages where mid=p_mid; return thread;
  end if;
  insert into public.lead_inbox_threads(channel,page_id,external_id,name,phone,last_text,last_at,last_inbound_at,unread)
  values (p_channel,coalesce(p_page,''),p_external,left(coalesce(p_name,''),120),private.lead_phone(p_phone),
          left(coalesce(p_body,''),300),now(),case when inbound then now() end,case when inbound then 1 else 0 end)
  on conflict (channel,page_id,external_id) do update set
    name=case when excluded.name<>'' then excluded.name else lead_inbox_threads.name end,
    phone=coalesce(excluded.phone,lead_inbox_threads.phone),
    last_text=excluded.last_text, last_at=now(),
    last_inbound_at=case when inbound then now() else lead_inbox_threads.last_inbound_at end,
    unread=lead_inbox_threads.unread+case when inbound then 1 else 0 end,
    status=case when inbound and lead_inbox_threads.status='closed' then 'open' else lead_inbox_threads.status end
  returning id into thread;
  insert into public.lead_inbox_messages(thread_id,direction,body,mid,actor_id,data)
  values (thread,p_direction,left(coalesce(p_body,''),4000),p_mid,nullif(p_data->>'actorId','')::bigint,coalesce(p_data,'{}'::jsonb));
  return thread;
end $$;

create or replace function public.lead_inbox_snapshot() returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
declare a jsonb := private.lead_actor();
begin
  perform private.lead_assert(a->>'role' in ('admin','intake'),'Chỉ Tiếp nhận/Quản trị dùng Hộp thư.');
  return jsonb_build_object(
    'threads',coalesce((select jsonb_agg(to_jsonb(t) order by t.last_at desc)
      from (select * from public.lead_inbox_threads order by last_at desc limit 500) t),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.at)
      from public.lead_inbox_messages m where m.thread_id in (select id from public.lead_inbox_threads order by last_at desc limit 500)),'[]'::jsonb));
end $$;

-- Staff actions on threads. Outbound Messenger replies are sent by the edge
-- function, which records them through private.lead_inbox_ingest.
create or replace function public.lead_inbox_command(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare a jsonb := private.lead_actor(); kind text := p->>'type'; th public.lead_inbox_threads; lead text; v_phone text;
begin
  perform private.lead_assert(a->>'role' in ('admin','intake'),'Chỉ Tiếp nhận/Quản trị dùng Hộp thư.');
  if kind='hotline' then
    v_phone := private.lead_phone(p->>'phone');
    perform private.lead_assert(v_phone is not null,'Số điện thoại cần 10 chữ số, bắt đầu bằng 0.');
    perform private.lead_inbox_ingest('hotline','',v_phone,p->>'name',v_phone,
      coalesce(nullif(btrim(p->>'note'),''),case when (p->>'missed')::boolean then 'Cuộc gọi nhỡ' else 'Cuộc gọi đến' end),null,'in',
      jsonb_build_object('missed',coalesce((p->>'missed')::boolean,false),'by',a->>'id'));
    return '{"ok":true}'::jsonb;
  end if;
  select * into th from public.lead_inbox_threads where id=p->>'id' for update;
  perform private.lead_assert(th.id is not null,'Không tìm thấy hội thoại.');
  if kind='read' then
    update public.lead_inbox_threads set unread=0 where id=th.id;
  elsif kind='note' then
    perform private.lead_assert(length(btrim(p->>'body')) between 1 and 4000,'Nhập nội dung ghi chú.');
    insert into public.lead_inbox_messages(thread_id,direction,body,actor_id) values(th.id,'note',btrim(p->>'body'),(a->>'id')::bigint);
  elsif kind='status' then
    perform private.lead_assert(p->>'status' in ('open','spam','closed'),'Trạng thái không hợp lệ.');
    update public.lead_inbox_threads set status=p->>'status',unread=0 where id=th.id;
    insert into public.lead_inbox_messages(thread_id,direction,body,actor_id) values(th.id,'system',
      case p->>'status' when 'spam' then 'Đánh dấu rác' when 'closed' then 'Đóng hội thoại' else 'Mở lại hội thoại' end,(a->>'id')::bigint);
  elsif kind='phone' then
    v_phone := private.lead_phone(p->>'phone');
    perform private.lead_assert(v_phone is not null,'Số điện thoại cần 10 chữ số, bắt đầu bằng 0.');
    update public.lead_inbox_threads set phone=v_phone where id=th.id;
  elsif kind='link' then
    lead := p->>'leadId';
    perform private.lead_assert(exists(select 1 from public.leads where id=lead),'Không tìm thấy hồ sơ.');
    update public.lead_inbox_threads set lead_id=lead,status='linked',unread=0 where id=th.id;
    insert into public.lead_inbox_messages(thread_id,direction,body,actor_id) values(th.id,'system','Gắn vào hồ sơ '||lead,(a->>'id')::bigint);
  else
    raise exception 'Lệnh Hộp thư không hợp lệ.';
  end if;
  insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',now(),'actorId',a->>'id',
    'action','inbox.'||kind,'target',coalesce(th.id,''),'detail',p::text),coalesce(lead,th.lead_id));
  return '{"ok":true}'::jsonb;
end $$;

-- Entry points for the Facebook edge function (service role only).
create or replace function public.lead_inbox_receive(p jsonb) returns text
language sql security definer set search_path=public,private as $$
  select private.lead_inbox_ingest(p->>'channel',p->>'pageId',p->>'externalId',p->>'name',p->>'phone',
    p->>'body',nullif(p->>'mid',''),coalesce(p->>'direction','in'),coalesce(p->'data','{}'::jsonb));
$$;
-- Lets the edge function check that the caller may reply on a thread.
create or replace function public.lead_inbox_reply_target(p_thread text) returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
declare a jsonb := private.lead_actor(); t public.lead_inbox_threads;
begin
  perform private.lead_assert(a->>'role' in ('admin','intake'),'Chỉ Tiếp nhận/Quản trị trả lời tin nhắn.');
  select * into t from public.lead_inbox_threads where id=p_thread;
  perform private.lead_assert(t.id is not null and t.channel='facebook','Hội thoại không thuộc kênh Messenger.');
  return jsonb_build_object('id',t.id,'pageId',t.page_id,'psid',t.external_id,'lastInboundAt',t.last_inbound_at,'actorId',a->>'id');
end $$;
revoke all on function public.lead_inbox_receive(jsonb), public.lead_inbox_reply_target(text) from public,anon,authenticated;
grant execute on function public.lead_inbox_receive(jsonb) to service_role;
grant execute on function public.lead_inbox_reply_target(text) to authenticated;
revoke all on function private.lead_phone(text), private.lead_inbox_ingest(text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.lead_inbox_snapshot(), public.lead_inbox_command(jsonb) from public,anon;
grant execute on function public.lead_inbox_snapshot(), public.lead_inbox_command(jsonb) to authenticated;
