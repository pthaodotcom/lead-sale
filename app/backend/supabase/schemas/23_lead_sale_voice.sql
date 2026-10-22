-- Browser-to-browser voice. Guest links are scoped capabilities, not CRM access.
create table private.lead_voice_invites (
 id uuid primary key default gen_random_uuid(), token_hash text not null,
 lead_id text not null references public.leads(id),
 assignment_id text references public.lead_assignments(id),
 actor_id bigint not null references public.sales(id),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '2 hours',
 receiver_id uuid, receiver_seen_at timestamptz
);
create table public.lead_voice_calls (
 id uuid primary key default gen_random_uuid(),
 invite_id uuid not null references private.lead_voice_invites(id),
 lead_id text not null references public.leads(id), assignment_id text references public.lead_assignments(id),
 actor_id bigint not null references public.sales(id),
 status text not null default 'ringing' check(status in ('ringing','connecting','connected','completed','no_answer','rejected','cancelled','failed')),
 started_at timestamptz not null default clock_timestamp(), accepted_at timestamptz,
 caller_connected_at timestamptz, receiver_connected_at timestamptz, connected_at timestamptz,
 ended_at timestamptz, duration_seconds integer not null default 0,
 caller_seen_at timestamptz not null default clock_timestamp(), receiver_seen_at timestamptz not null default clock_timestamp(),
 end_reason text not null default ''
);
create unique index lead_voice_one_live on public.lead_voice_calls(actor_id) where status in ('ringing','connecting','connected');
create index lead_voice_calls_lead on public.lead_voice_calls(lead_id,started_at desc);
create table private.lead_voice_signals (
 call_id uuid primary key references public.lead_voice_calls(id), offer text not null, answer text
);
alter table public.lead_voice_calls enable row level security;
revoke all on public.lead_voice_calls from public,anon,authenticated;
grant select on public.lead_voice_calls to authenticated;
create policy lead_voice_read on public.lead_voice_calls for select to authenticated using(private.lead_can_read(lead_id));
revoke all on private.lead_voice_invites,private.lead_voice_signals from public,anon,authenticated;

create function private.lead_voice_expire() returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare stamp timestamptz:=clock_timestamp();
begin
 update public.lead_voice_calls c set
   status=case when c.status='ringing' then 'no_answer' else 'failed' end,
   ended_at=case when c.status='ringing' then least(stamp,c.started_at+interval '45 seconds')
     when c.status='connecting' then least(stamp,c.accepted_at+interval '40 seconds')
     else least(stamp,least(c.caller_seen_at,c.receiver_seen_at)+interval '25 seconds') end,
   end_reason=case when c.status='ringing' then 'no_answer' else 'connection_timeout' end
 where c.status in ('ringing','connecting','connected') and
   (c.status='ringing' and c.started_at<stamp-interval '45 seconds'
    or c.status='connecting' and c.accepted_at<stamp-interval '40 seconds'
    or c.status='connected' and least(c.caller_seen_at,c.receiver_seen_at)<stamp-interval '25 seconds');
 update public.lead_voice_calls c set status='failed',ended_at=stamp,end_reason='link_expired'
 from private.lead_voice_invites i where c.invite_id=i.id and i.expires_at<=stamp and c.status in ('ringing','connecting','connected');
 update public.lead_voice_calls set duration_seconds=greatest(0,floor(extract(epoch from ended_at-connected_at))::int)
 where ended_at is not null and connected_at is not null and duration_seconds<>greatest(0,floor(extract(epoch from ended_at-connected_at))::int);
end $$;

create function private.lead_voice_view(p_invite uuid) returns jsonb language sql security definer set search_path=pg_catalog,public,private as $$
 select jsonb_build_object('serverTime',clock_timestamp(),'expiresAt',i.expires_at,
 'receiverReady',i.receiver_seen_at>clock_timestamp()-interval '12 seconds',
 'call',(select jsonb_build_object('id',c.id,'status',c.status,'startedAt',c.started_at,'acceptedAt',c.accepted_at,
   'connectedAt',c.connected_at,'endedAt',c.ended_at,'durationSeconds',c.duration_seconds,'endReason',c.end_reason,
   'offer',case when c.status in ('ringing','connecting','connected') then s.offer end,
   'answer',case when c.status in ('ringing','connecting','connected') then s.answer end)
 from public.lead_voice_calls c left join private.lead_voice_signals s on s.call_id=c.id
 where c.invite_id=i.id order by c.started_at desc limit 1))
 from private.lead_voice_invites i where i.id=p_invite;
$$;

create function private.lead_voice_transition(p_call uuid,p_action text,p_side text,p_reason text default '') returns void
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare c public.lead_voice_calls; stamp timestamptz:=clock_timestamp();
begin
 select * into c from public.lead_voice_calls where id=p_call for update;
 perform private.lead_assert(c.id is not null,'Không tìm thấy cuộc gọi.');
 if c.status not in ('ringing','connecting','connected') then return; end if;
 if p_action='accept' then
   perform private.lead_assert(p_side='receiver' and c.status='ringing','Cuộc gọi không còn chờ nhận.');
   update public.lead_voice_calls set status='connecting',accepted_at=stamp where id=c.id;
 elsif p_action='connected' then
   perform private.lead_assert(c.status in ('connecting','connected'),'Chưa chấp nhận cuộc gọi.');
   if p_side='caller' then update public.lead_voice_calls set caller_connected_at=coalesce(caller_connected_at,stamp) where id=c.id;
   else update public.lead_voice_calls set receiver_connected_at=coalesce(receiver_connected_at,stamp) where id=c.id; end if;
   update public.lead_voice_calls set status='connected',connected_at=coalesce(connected_at,greatest(caller_connected_at,receiver_connected_at))
   where id=c.id and caller_connected_at is not null and receiver_connected_at is not null;
 elsif p_action in ('end','fail') then
   update public.lead_voice_calls set
     status=case when p_action='fail' then 'failed' when c.connected_at is not null then 'completed'
       when c.status='ringing' and p_side='receiver' then 'rejected' else 'cancelled' end,
     ended_at=stamp,end_reason=case when p_action='fail' then left(p_reason,120) else p_side||'_ended' end,
     duration_seconds=case when c.connected_at is null then 0 else greatest(0,floor(extract(epoch from stamp-c.connected_at))::int) end
   where id=c.id;
 else raise exception 'Thao tác cuộc gọi không hợp lệ.'; end if;
end $$;

create function public.lead_voice_staff(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare a jsonb:=private.lead_actor(); action text:=p->>'action'; i private.lead_voice_invites;
 token text; ticket public.lead_assignments; call_id uuid; item public.lead_voice_calls;
begin
 perform private.lead_voice_expire();
 if action in ('history','prepare') then
   perform private.lead_assert(private.lead_can_read(p->>'leadId'),'Bạn không có quyền xem hồ sơ này.');
   if action='history' then
     return jsonb_build_object('calls',coalesce((select jsonb_agg(to_jsonb(x)) from (
       select id,assignment_id,actor_id,status,started_at,connected_at,ended_at,duration_seconds,end_reason
       from public.lead_voice_calls where lead_id=p->>'leadId'
       and (nullif(p->>'ticketId','') is null or assignment_id=p->>'ticketId') order by started_at desc limit 20
     ) x),'[]'::jsonb));
   end if;
   perform private.lead_assert(not (select archived from public.leads where id=p->>'leadId'),'Hồ sơ đã lưu trữ.');
   if nullif(p->>'ticketId','') is not null then
     select * into ticket from public.lead_assignments where id=p->>'ticketId';
     perform private.lead_assert(ticket.lead_id=p->>'leadId' and ticket.status in ('New','Open') and ticket.expires_at>clock_timestamp()
       and (a->>'role'='admin' or ticket.assignee_id=(a->>'id')::bigint and ticket.data ? 'acceptedAt'),'Nhận việc trên phiếu còn hạn để gọi.');
   else
     perform private.lead_assert(a->>'role' in ('admin','intake'),'Chỉ Tiếp nhận/Admin gọi trực tiếp từ hồ sơ.');
   end if;
   perform private.lead_assert((select count(*) from private.lead_voice_invites where actor_id=(a->>'id')::bigint and created_at>clock_timestamp()-interval '1 minute')<10,'Bạn tạo link quá nhanh. Vui lòng đợi một phút.');
   token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
   insert into private.lead_voice_invites(token_hash,lead_id,assignment_id,actor_id)
   values(md5(token),p->>'leadId',nullif(p->>'ticketId',''),(a->>'id')::bigint) returning * into i;
   return jsonb_build_object('id',i.id,'token',token,'expiresAt',i.expires_at);
 end if;
 select * into i from private.lead_voice_invites where id=(p->>'inviteId')::uuid for update;
 perform private.lead_assert(i.actor_id=(a->>'id')::bigint and private.lead_can_read(i.lead_id),'Link cuộc gọi không thuộc tài khoản này.');
 perform private.lead_assert(i.expires_at>clock_timestamp(),'Link nhận cuộc gọi đã hết hạn.');
 if action='start' then
   -- Recheck permissions when dialling, not just when generating the link.
   if i.assignment_id is not null then
     select * into ticket from public.lead_assignments where id=i.assignment_id;
     perform private.lead_assert(ticket.status in ('New','Open') and ticket.expires_at>clock_timestamp()
       and (a->>'role'='admin' or ticket.assignee_id=(a->>'id')::bigint and ticket.data ? 'acceptedAt'),'Phiếu không còn cho phép gọi.');
   else perform private.lead_assert(a->>'role' in ('admin','intake'),'Không có quyền gọi từ hồ sơ.'); end if;
   perform private.lead_assert(i.receiver_id is not null and i.receiver_seen_at>clock_timestamp()-interval '12 seconds','Điện thoại chưa sẵn sàng. Mở link và bấm Sẵn sàng nhận cuộc gọi.');
   perform private.lead_assert(length(p->>'sdp') between 20 and 64000 and left(p->>'sdp',3)='v=0','Không tạo được kết nối âm thanh.');
   perform private.lead_assert(not exists(select 1 from public.lead_voice_calls where actor_id=i.actor_id and status in ('ringing','connecting','connected')),'Bạn đang có một cuộc gọi khác.');
   insert into public.lead_voice_calls(invite_id,lead_id,assignment_id,actor_id) values(i.id,i.lead_id,i.assignment_id,i.actor_id) returning id into call_id;
   insert into private.lead_voice_signals(call_id,offer) values(call_id,p->>'sdp');
 elsif action in ('connected','end','fail') then
   select * into item from public.lead_voice_calls where id=(p->>'callId')::uuid and invite_id=i.id;
   perform private.lead_assert(item.id is not null,'Không tìm thấy cuộc gọi.');
   perform private.lead_voice_transition(item.id,action,'caller',coalesce(p->>'reason','connection_failed'));
 elsif action<>'poll' then raise exception 'Thao tác cuộc gọi không hợp lệ.'; end if;
 update public.lead_voice_calls set caller_seen_at=clock_timestamp() where invite_id=i.id and status in ('ringing','connecting','connected');
 return private.lead_voice_view(i.id);
end $$;

create function public.lead_voice_guest(p_invite uuid,p_token text,p_client uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare i private.lead_voice_invites; c public.lead_voice_calls; action text:=p->>'action';
begin
 perform private.lead_assert(p_client is not null and length(p_token)=64,'Link nhận cuộc gọi không hợp lệ.');
 select * into i from private.lead_voice_invites where id=p_invite and token_hash=md5(p_token) for update;
 perform private.lead_assert(i.id is not null and i.expires_at>clock_timestamp(),'Link không hợp lệ hoặc đã hết hạn. Xin nhân viên gửi link mới.');
 perform private.lead_voice_expire();
 if action='ready' then
   perform private.lead_assert(i.receiver_id is null or i.receiver_id=p_client or
     (i.receiver_seen_at<clock_timestamp()-interval '25 seconds' and not exists(select 1 from public.lead_voice_calls where invite_id=i.id and status in ('ringing','connecting','connected'))),
     'Link đang mở trên thiết bị khác. Đóng trang bên đó và đợi 25 giây.');
   update private.lead_voice_invites set receiver_id=p_client,receiver_seen_at=clock_timestamp() where id=i.id;
 elsif action<>'info' then
   perform private.lead_assert(i.receiver_id=p_client,'Bấm Sẵn sàng nhận cuộc gọi trên điện thoại này.');
   if action in ('accept','answer','connected','end','fail') then
     select * into c from public.lead_voice_calls where id=(p->>'callId')::uuid and invite_id=i.id;
     perform private.lead_assert(c.id is not null,'Không tìm thấy cuộc gọi.');
     if action='answer' then
       perform private.lead_assert(c.status='connecting' and length(p->>'sdp') between 20 and 64000 and left(p->>'sdp',3)='v=0','Cuộc gọi không còn chờ kết nối.');
       update private.lead_voice_signals set answer=coalesce(answer,p->>'sdp') where call_id=c.id;
     else perform private.lead_voice_transition(c.id,action,'receiver',coalesce(p->>'reason','connection_failed')); end if;
   elsif action<>'poll' then raise exception 'Thao tác nhận cuộc gọi không hợp lệ.'; end if;
   update private.lead_voice_invites set receiver_seen_at=clock_timestamp() where id=i.id;
   update public.lead_voice_calls set receiver_seen_at=clock_timestamp() where invite_id=i.id and status in ('ringing','connecting','connected');
 end if;
 if action='info' then return jsonb_build_object('expiresAt',i.expires_at); end if;
 return private.lead_voice_view(i.id);
end $$;
revoke all on function private.lead_voice_expire(),private.lead_voice_view(uuid),private.lead_voice_transition(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.lead_voice_staff(jsonb) from public,anon;
grant execute on function public.lead_voice_staff(jsonb) to authenticated;
revoke all on function public.lead_voice_guest(uuid,text,uuid,jsonb) from public;
grant execute on function public.lead_voice_guest(uuid,text,uuid,jsonb) to anon,authenticated;
