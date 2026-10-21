-- Forward-only expansion. The immutable bootstrap remains unchanged.
alter function public.lead_command(jsonb,uuid,integer) set schema private;
alter function private.lead_command(jsonb,uuid,integer) rename to lead_command_base;
revoke all on function private.lead_command_base(jsonb,uuid,integer) from public,anon,authenticated;

do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.lead_activities'::regclass and contype='c' and pg_get_constraintdef(oid) like '%outcome%' loop
    execute format('alter table public.lead_activities drop constraint %I',c.conname);
  end loop;
end $$;
alter table public.lead_activities add constraint lead_activity_outcome check(data->>'outcome' in ('called','no_answer','unresponsive','overdue','wrong_phone'));

create function private.lead_reception_guard() returns trigger language plpgsql as $$
begin
  if current_setting('lead.edit_only',true)='true' then return null; end if;
  return new;
end $$;
create trigger lead_reception_edit_guard before insert on public.lead_receptions for each row execute function private.lead_reception_guard();

create function private.lead_activity_normalize() returns trigger language plpgsql as $$
begin
  if current_setting('lead.chat_unresponsive',true)='true' then new.data:=new.data||'{"outcome":"unresponsive"}'; end if;
  return new;
end $$;
create trigger lead_activity_normalize before insert on public.lead_activities for each row execute function private.lead_activity_normalize();

create or replace function private.lead_counts(p_ticket text) returns jsonb
language sql stable security definer set search_path=public,private as $$
select jsonb_build_object('noAnswer',count(*) filter(where a.data->>'outcome'='no_answer' and a.data->>'channel'='call'),'overdue',count(*) filter(where a.data->>'outcome'='overdue'))
from public.lead_activities a join public.lead_assignments t on t.id=a.assignment_id
where a.assignment_id=p_ticket and a.round_no=coalesce((t.data->>'round')::int,1) and not (a.data ? 'voidedAt');
$$;

-- The current assignee receives read-only care history for that Lead. All writes
-- still check the actual ticket owner, version and expiry in lead_command.
create or replace function private.lead_can_ticket(p_ticket text) returns boolean
language plpgsql stable security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(false); t jsonb; latest jsonb;
begin
  if a is null then return false; end if;
  if a->>'role' in ('admin','intake') then return true; end if;
  select data into t from public.lead_assignments where id=p_ticket;
  if t is null then return false; end if;
  latest:=private.lead_latest(t->>'leadId');
  if a->>'role'='leader' then return coalesce(latest->>'teamId'=a->>'teamId',false); end if;
  return coalesce(a->>'role'='telesale' and latest->>'assigneeId'=a->>'id' and latest->>'status'<>'Closed' and (latest->>'expiresAt')::timestamptz>now(),false);
end $$;

create function public.lead_command(p_command jsonb,p_request_id uuid,p_expected_version integer default null) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(); kind text:=p_command->>'type'; target text:=p_command->>'id';
  l jsonb; t jsonb; item jsonb; old jsonb; ap jsonb; previous jsonb; cmd jsonb:=p_command; result jsonb;
  stamp timestamptz:=now(); moment timestamptz; received timestamptz; reason text:=btrim(p_command->>'reason'); status_value text; ticket text; lead text; numbers jsonb;
begin
  perform private.lead_assert(p_request_id is not null and jsonb_typeof(p_command)='object','Yêu cầu không hợp lệ.');
  perform pg_advisory_xact_lock(179826221);
  select payload into previous from private.lead_requests where actor_id=(a->>'id')::bigint and request_id=p_request_id;
  if found then
    perform private.lead_assert(previous=p_command,'Mã yêu cầu đã được dùng cho nội dung khác.');
    return '{"ok":true}'::jsonb;
  end if;

  if kind in ('leadStatus','correctMilestone','receiveLead') then
    select data into l from public.leads where id=target for update; lead:=target;
    perform private.lead_assert(a->>'role' in ('admin','intake') and l is not null and not (l->>'archived')::boolean,'Không có quyền cập nhật hồ sơ này.');
    perform private.lead_assert(p_expected_version=coalesce((l->>'version')::int,1),'Dữ liệu đã thay đổi. Tải lại trước khi lưu.');
    perform private.lead_assert(length(reason)>0,'Nhập căn cứ cập nhật.');
    if kind='receiveLead' then
      perform private.lead_assert(exists(select 1 from public.lead_sources where id=p_command->>'sourceId' and (data->>'active')::boolean),'Chọn nguồn tiếp nhận đang hoạt động.');
      insert into public.lead_receptions(data) values(jsonb_build_object('id','TN-'||gen_random_uuid(),'leadId',target,'sourceId',p_command->>'sourceId','at',stamp,'actorId',a->>'id','note',reason));
      update public.leads set data=data||jsonb_build_object('updatedAt',stamp,'version',(l->>'version')::int+1) where id=target;
    else
      status_value:=p_command->>'status';
      perform private.lead_assert(status_value in ('New','Activated','Onboarded','Closed'),'Trạng thái không hợp lệ.');
      if kind='leadStatus' then
        perform private.lead_assert((l->>'status'='New' and status_value in ('Activated','Closed')) or (l->>'status'='Activated' and status_value='Onboarded') or (l->>'status'='Closed' and status_value='New'),'Chuyển trạng thái hồ sơ không hợp lệ.');
      end if;
      item:=l||jsonb_build_object('status',status_value,'updatedAt',stamp,'version',(l->>'version')::int+1);
      if kind='correctMilestone' then
        item:=(item-'activatedAt'-'onboardedAt'-'activatedSource'-'onboardedSource'-'activatedEventId'-'onboardedEventId'-'activatedReceivedAt'-'onboardedReceivedAt'-'firstOrderId')||jsonb_build_object('milestoneSource','manual_correction','coreCorrectionAt',stamp,'correctionReason',reason);
        if status_value in ('Activated','Onboarded') then
          moment:=(p_command->>'activatedAt')::timestamptz;
          perform private.lead_assert(moment<=stamp and moment>='2000-01-01'::timestamptz,'Ngày đăng ký đính chính không hợp lệ.');
          item:=item||jsonb_build_object('activatedAt',moment,'activatedSource','manual_correction');
        end if;
        if status_value='Onboarded' then
          received:=(p_command->>'onboardedAt')::timestamptz;
          perform private.lead_assert(received>=moment and received<=stamp,'Đơn đầu phải sau đăng ký và không ở tương lai.');
          item:=item||jsonb_build_object('onboardedAt',received,'onboardedSource','manual_correction');
        end if;
      else
        moment:=coalesce((p_command->>'occurredAt')::timestamptz,stamp);
        perform private.lead_assert(moment<=stamp and moment>='2000-01-01'::timestamptz,'Thời điểm xác nhận không hợp lệ.');
        if status_value='Activated' then item:=item||jsonb_build_object('activatedAt',moment,'activatedSource','manual','milestoneSource','manual','milestoneRecordedAt',stamp,'milestoneActorId',a->>'id','milestoneReason',reason); end if;
        if status_value='Onboarded' then
          perform private.lead_assert(moment>=(l->>'activatedAt')::timestamptz,'Đơn đầu phải sau đăng ký.');
          item:=item||jsonb_build_object('onboardedAt',moment,'onboardedSource','manual','milestoneSource','manual','milestoneRecordedAt',stamp,'milestoneActorId',a->>'id','milestoneReason',reason);
        end if;
      end if;
      update public.leads set data=item where id=target;
      if status_value in ('Activated','Onboarded','Closed') then
        for t in select data from public.lead_assignments where lead_id=target and status in ('New','Open') loop
          update public.lead_assignments set data=data||jsonb_build_object('status','Solved','updatedAt',stamp,'version',coalesce((data->>'version')::int,1)+1) where id=t->>'id';
          perform private.lead_cancel_appointments(t->>'id');
        end loop;
      end if;
    end if;
  elsif kind in ('review','amendReview') then
    select data into old from public.lead_closure_reviews where id=target for update;
    perform private.lead_assert(a->>'role' in ('admin','intake') and old is not null and length(btrim(p_command->>'note'))>0,'Chỉ tiếp nhận được rà soát bàn giao; nhập kết quả.');
    if kind='review' then perform private.lead_assert(old->>'reviewedAt' is null,'Bàn giao đã được xác nhận, không được ghi đè.');
    else perform private.lead_assert(old->>'reviewedAt' is not null and length(reason)>0,'Đính chính cần kết quả đã xác nhận và lý do.'); end if;
    perform private.lead_assert(p_expected_version=coalesce((old->>'version')::int,1),'Bàn giao đã thay đổi. Tải lại.');
    perform private.lead_assert(coalesce(p_command->>'result','reviewed') in ('reviewed','eligible','follow_up','closed'),'Kết quả bàn giao không hợp lệ.');
    lead:=old->>'leadId';
    update public.lead_closure_reviews set data=data||jsonb_build_object('reviewedAt',stamp,'reviewedBy',a->>'id','result',coalesce(p_command->>'result','reviewed'),'note',btrim(p_command->>'note'),'version',coalesce((data->>'version')::int,1)+1)||case when kind='amendReview' then jsonb_build_object('history',coalesce(data->'history','[]')||jsonb_build_array((old-'history')||jsonb_build_object('amendReason',reason))) else '{}' end where id=target;
  elsif kind in ('voidActivity','correctAppointment') then
    if kind='voidActivity' then select data into old from public.lead_activities where id=target; else select data into ap from public.lead_appointments where id=target; old:=ap; end if;
    ticket:=old->>'assignmentId'; lead:=old->>'leadId';
    select data into t from public.lead_assignments where id=ticket for update;
    perform private.lead_assert(t is not null and private.lead_can_ticket(ticket) and (a->>'role'='admin' or (a->>'role'='telesale' and t->>'assigneeId'=a->>'id')),'Không có quyền đính chính hoạt động.');
    perform private.lead_assert(p_expected_version=(t->>'version')::int,'Phiếu đã thay đổi. Tải lại.');
    perform private.lead_assert(length(reason)>0,'Nhập lý do đính chính.');
    if kind='voidActivity' then
      perform private.lead_assert(old->>'voidedAt' is null and old->>'appointmentId' is null,'Hoạt động đã hủy hoặc thuộc lịch hẹn; đính chính tại lịch hẹn.');
      update public.lead_activities set data=data||jsonb_build_object('voidedAt',stamp,'voidedBy',a->>'id','voidReason',reason) where id=target;
      update public.lead_appointments set data=data||jsonb_build_object('status','cancelled','correctionReason',reason) where data->>'activityId'=target and status='scheduled';
    else
      perform private.lead_assert(ap->>'status' in ('attended','missed') and p_command->>'status' in ('attended','missed','cancelled') and ap->>'status'<>p_command->>'status','Chỉ đính chính kết quả lịch đã ghi nhận.');
      update public.lead_appointments set data=data||jsonb_build_object('status',p_command->>'status','correctionReason',reason,'correctedAt',stamp,'correctedBy',a->>'id') where id=target;
      update public.lead_activities set data=data||jsonb_build_object('voidedAt',stamp,'voidedBy',a->>'id','voidReason',reason) where appointment_id=target and not (data ? 'voidedAt');
      if p_command->>'status'='missed' then
        update public.lead_activities set data=(data-'voidedAt'-'voidedBy'-'voidReason')||jsonb_build_object('correctionReason',reason) where appointment_id=target;
        if not found then
          insert into public.lead_activities(data) values(jsonb_build_object('id','HD-'||gen_random_uuid(),'leadId',lead,'assignmentId',ticket,'actorId',a->>'id','channel','call','at',stamp,'outcome','overdue','decision','none','reason','none','note',reason,'round',coalesce((select round_no from public.lead_activities where id=ap->>'activityId'),(t->>'round')::int),'appointmentId',target));
        end if;
      end if;
    end if;
    -- Correct counts, but never silently reopen Solved, expired or Closed tickets.
    numbers:=private.lead_counts(ticket);
    update public.lead_assignments set data=data||jsonb_build_object('updatedAt',stamp,'version',(data->>'version')::int+1) where id=ticket;
    if t->>'status' in ('New','Open') and (t->>'expiresAt')::timestamptz>stamp and (numbers->>'overdue')::int>=3 then
      update public.lead_assignments set data=data||'{"status":"Solved"}' where id=ticket; perform private.lead_cancel_appointments(ticket);
    end if;
  else
    if kind='assign' then
      perform private.lead_assert(not exists(select 1 from public.lead_closure_reviews where lead_id=p_command->>'leadId' and data->>'reviewedAt' is null),'Xác nhận bàn giao trước khi phân công lại.');
      perform private.lead_assert(coalesce((select data->>'result' from public.lead_closure_reviews where lead_id=p_command->>'leadId' order by (data->>'reviewedAt')::timestamptz desc nulls last limit 1),'eligible') not in ('follow_up','closed'),'Kết quả bàn giao chưa đủ điều kiện phân công lại.');
    end if;
    if kind='activity' then
      perform private.lead_assert(not (p_command->'input'->>'channel'='zalo' and p_command->'input'->>'outcome'='no_answer'),'Chat chưa phản hồi dùng kết quả Chưa phản hồi, không tính KNM.');
      if p_command->'input'->>'outcome'='unresponsive' then
        perform private.lead_assert(p_command->'input'->>'channel'='zalo' and p_command->'input'->>'decision'='none' and coalesce(p_command->'input'->>'appointmentAt','')='','Chưa phản hồi chỉ dành cho chat và chưa có quyết định.');
        cmd:=jsonb_set(cmd,'{input,outcome}','"called"');
        perform set_config('lead.chat_unresponsive','true',true);
      end if;
    end if;
    if kind='saveLead' then
      perform set_config('lead.edit_only',case when target is null then 'false' else 'true' end,true);
      received:=coalesce((p_command->'input'->>'receivedAt')::timestamptz,stamp);
      perform private.lead_assert(received<=stamp and received>='2000-01-01'::timestamptz,'Ngày tiếp nhận không hợp lệ.');
    end if;
    result:=private.lead_command_base(cmd,p_request_id,p_expected_version);
    if kind='saveLead' then
      perform set_config('lead.edit_only','false',true);
      if target is null then
        select id into lead from public.leads where phone=regexp_replace(regexp_replace(p_command->'input'->>'phone','[[:space:]().-]','','g'),'^\+?84([0-9]{9})$','0\1');
        update public.leads set data=data||jsonb_build_object('receivedAt',received) where id=lead;
        update public.lead_receptions set data=data||jsonb_build_object('at',received) where lead_id=lead;
      end if;
    end if;
    if kind='activity' and p_command->'input'->>'outcome'='unresponsive' then
      perform set_config('lead.chat_unresponsive','false',true);
    end if;
    update private.lead_requests set payload=p_command where actor_id=(a->>'id')::bigint and request_id=p_request_id;
    return result;
  end if;
  insert into private.lead_requests(actor_id,request_id,payload) values((a->>'id')::bigint,p_request_id,p_command);
  insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',stamp,'actorId',a->>'id','action',kind,'target',target,'detail',p_command::text,'requestId',p_request_id),lead);
  return '{"ok":true}'::jsonb;
end $$;
revoke all on function public.lead_command(jsonb,uuid,integer) from public,anon;
grant execute on function public.lead_command(jsonb,uuid,integer) to authenticated;
revoke all on function private.lead_reception_guard() from public,anon,authenticated;
revoke all on function private.lead_activity_normalize() from public,anon,authenticated;

-- Source simulator data and receiver inbox are deliberately separate resources.
create table private.lead_sim_drivers (
  id text primary key, name text not null, phone text not null check(phone ~ '^0[0-9]{9}$'),
  state text not null default 'account_created', registration_state text not null default 'account_created', registration_at timestamptz, created_at timestamptz not null default now(),
  created_by bigint not null references public.sales(id)
);
create table private.lead_sim_orders (
  id text primary key, driver_id text not null references private.lead_sim_drivers(id),
  status text not null check(status in ('order_received','order_cancelled','first_order_completed')),
  occurred_at timestamptz not null
);
create table private.lead_core_links (
  driver_id text primary key references private.lead_sim_drivers(id),
  lead_id text not null unique references public.leads(id),
  confirmed_by bigint not null references public.sales(id), confirmed_at timestamptz not null default now()
);
create table private.lead_sim_outbox (
  id text primary key, driver_id text not null references private.lead_sim_drivers(id), payload jsonb not null,
  created_at timestamptz not null default now(), actor_id bigint not null references public.sales(id)
);
create table private.lead_core_events (
  id text primary key, payload jsonb not null, received_at timestamptz not null default now(),
  processed_at timestamptz, lead_id text references public.leads(id),
  status text not null default 'received', message text not null default '', attempts integer not null default 0
);
create table private.lead_core_attempts (
  id bigint generated always as identity primary key, event_id text not null references private.lead_core_events(id),
  at timestamptz not null default now(), status text not null, message text not null
);
revoke all on all tables in schema private from public,anon,authenticated;

create function private.lead_core_process(p_id text) returns void language plpgsql security definer set search_path=public,private as $$
declare e private.lead_core_events; l jsonb; driver private.lead_sim_drivers; linked text;
  typ text; moment timestamptz; status_value text; message_value text; next_status text; t record;
begin
  select * into e from private.lead_core_events where id=p_id for update;
  if e.status in ('processed','ignored') then return; end if;
  typ:=e.payload->>'eventType';
  begin
    perform private.lead_assert(e.payload->>'sourceSystem'='driver-simulator','Nguồn gửi không hợp lệ.');
    perform private.lead_assert(typ in ('account_created','registration_pending','registration_completed','order_received','order_cancelled','first_order_completed'),'Loại sự kiện không hợp lệ.');
    moment:=(e.payload->>'occurredAt')::timestamptz;
    perform private.lead_assert(moment<=now() and moment>='2000-01-01'::timestamptz,'Ngày sự kiện không hợp lệ hoặc ở tương lai.');
    perform private.lead_assert(length(e.payload->>'externalDriverId') between 1 and 120 and e.payload->>'phone' ~ '^0[0-9]{9}$','Danh tính tài xế không hợp lệ.');
    if typ like '%order%' then perform private.lead_assert(length(btrim(e.payload->>'orderId')) between 1 and 120,'Sự kiện đơn hàng cần mã đơn.'); end if;
    select * into driver from private.lead_sim_drivers where id=e.payload->>'externalDriverId';
    select lead_id into linked from private.lead_core_links where driver_id=e.payload->>'externalDriverId';
    if linked is null then
      status_value:='waiting_link'; message_value:='Chưa liên kết tài xế với Lead được phép thử.';
    else
      select data into l from public.leads where id=linked for update;
      if l->>'phone' is distinct from e.payload->>'phone' or driver.phone is distinct from e.payload->>'phone' then
        status_value:='conflict'; message_value:='Số điện thoại nguồn khác hồ sơ đã liên kết.';
      elsif typ not in ('registration_completed','first_order_completed') then
        status_value:='ignored'; message_value:='Đã ghi nhận tình trạng nguồn; chưa đủ điều kiện chuyển trạng thái Lead.';
      elsif (l->>'archived')::boolean or l->>'status'='Closed' or l ? 'coreCorrectionAt' then
        status_value:='conflict'; message_value:='Lead đã đóng/lưu trữ hoặc có đính chính; cần đối soát, không tự ghi đè.';
      elsif typ='first_order_completed' and not (l ? 'activatedAt') then
        status_value:='waiting_registration'; message_value:='Chờ sự kiện đăng ký hợp lệ.';
      elsif typ='first_order_completed' and moment<(l->>'activatedAt')::timestamptz then
        status_value:='conflict'; message_value:='Thời điểm đơn hoàn thành trước thời điểm đăng ký.';
      elsif (typ='registration_completed' and l ? 'activatedAt') or (typ='first_order_completed' and l ? 'onboardedAt') then
        status_value:='ignored'; message_value:='Đã có mốc kết quả; giữ nguyên mốc đầu, không đếm lại.';
      else
        next_status:=case when typ='registration_completed' then 'Activated' else 'Onboarded' end;
        l:=l||jsonb_build_object('status',next_status,'updatedAt',now(),'version',coalesce((l->>'version')::int,1)+1,'externalDriverId',driver.id,'coreSource','driver-simulator');
        if typ='registration_completed' then
          l:=l||jsonb_build_object('activatedAt',moment,'activatedSource','simulator','activatedEventId',e.id,'activatedReceivedAt',e.received_at);
        else
          l:=l||jsonb_build_object('onboardedAt',moment,'onboardedSource','simulator','onboardedEventId',e.id,'onboardedReceivedAt',e.received_at,'firstOrderId',e.payload->>'orderId');
        end if;
        update public.leads set data=l where id=linked;
        for t in select id from public.lead_assignments where lead_id=linked and status in ('New','Open') loop
          update public.lead_assignments set data=data||jsonb_build_object('status','Solved','updatedAt',now(),'version',coalesce((data->>'version')::int,1)+1) where id=t.id;
          perform private.lead_cancel_appointments(t.id);
        end loop;
        insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',now(),'actorId','driver-simulator','action','Kết quả từ hệ thống giả lập','target',linked,'detail',e.payload::text,'eventId',e.id),linked);
        status_value:='processed'; message_value:='Đã cập nhật '||next_status||' từ nguồn giả lập.';
      end if;
    end if;
  exception when others then
    status_value:='rejected'; message_value:=sqlerrm;
  end;
  update private.lead_core_events set status=status_value,message=message_value,lead_id=linked,processed_at=now() where id=p_id;
end $$;

-- Only the trusted HTTP receiver can call this (no browser RPC grant).
create function private.lead_core_receive(p_event jsonb) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare e private.lead_core_events; pending record; collision boolean:=false;
begin
  perform private.lead_assert(jsonb_typeof(p_event)='object' and length(p_event->>'eventId') between 1 and 120,'Sự kiện cần eventId hợp lệ.');
  perform pg_advisory_xact_lock(179826221);
  insert into private.lead_core_events(id,payload) values(p_event->>'eventId',p_event) on conflict(id) do nothing;
  select * into e from private.lead_core_events where id=p_event->>'eventId' for update;
  update private.lead_core_events set attempts=attempts+1 where id=e.id;
  collision:=e.payload<>p_event;
  if collision then
    insert into private.lead_core_attempts(event_id,status,message) values(e.id,'id_collision','Cùng eventId nhưng nội dung khác; đã từ chối, giữ nguyên bản gốc.');
    return jsonb_build_object('eventId',e.id,'status','id_collision','message','Mã sự kiện đã dùng cho nội dung khác.');
  end if;
  perform private.lead_core_process(e.id);
  -- A late registration unlocks pending first-order events without inventing dates.
  if p_event->>'eventType'='registration_completed' then
    for pending in select id from private.lead_core_events where payload->>'externalDriverId'=p_event->>'externalDriverId' and status='waiting_registration' order by received_at,id loop
      update private.lead_core_events set attempts=attempts+1 where id=pending.id;
      perform private.lead_core_process(pending.id);
      insert into private.lead_core_attempts(event_id,status,message) select id,status,'Tự xử lý lại sau đăng ký: '||message from private.lead_core_events where id=pending.id;
    end loop;
  end if;
  select * into e from private.lead_core_events where id=e.id;
  insert into private.lead_core_attempts(event_id,status,message) values(e.id,e.status,e.message);
  return jsonb_build_object('eventId',e.id,'status',e.status,'message',e.message,'leadId',e.lead_id,'attempts',e.attempts);
end $$;

create function public.lead_simulator(p_command jsonb) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(); kind text:=p_command->>'type'; driver private.lead_sim_drivers; linked jsonb; event_payload jsonb; moment timestamptz; typ text; phone_value text; event_id text;
begin
  perform private.lead_assert(a->>'role' in ('admin','intake'),'Chỉ Admin/Tiếp nhận được xem đối soát.');
  if kind='snapshot' then
    return jsonb_build_object(
      'drivers',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'phone',d.phone,'state',d.state,'registrationState',d.registration_state,'leadId',m.lead_id,'confirmedAt',m.confirmed_at) order by d.created_at desc) from private.lead_sim_drivers d left join private.lead_core_links m on m.driver_id=d.id),'[]'::jsonb),
      'orders',coalesce((select jsonb_agg(to_jsonb(o) order by o.occurred_at desc) from private.lead_sim_orders o),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'driverId',o.driver_id,'payload',o.payload,'sentAt',o.created_at,'status',coalesce(e.status,'unsent'),'message',e.message,'receivedAt',e.received_at,'processedAt',e.processed_at,'leadId',e.lead_id,'attempts',coalesce(e.attempts,0)) order by o.created_at desc) from private.lead_sim_outbox o left join private.lead_core_events e on e.id=o.id),'[]'::jsonb),
      'inbox',coalesce((select jsonb_agg(to_jsonb(e) order by e.received_at desc) from private.lead_core_events e),'[]'::jsonb),
      'attempts',coalesce((select jsonb_agg(to_jsonb(t) order by t.id desc) from private.lead_core_attempts t),'[]'::jsonb));
  end if;
  if kind='retry' then
    select e.payload into event_payload from private.lead_core_events e where e.id=p_command->>'eventId';
    perform private.lead_assert(event_payload is not null,'Không tìm thấy sự kiện.');
    return jsonb_build_object('event',event_payload);
  end if;
  perform private.lead_assert(a->>'role'='admin','Chỉ Admin được thao tác hệ thống tài xế giả lập.');
  perform pg_advisory_xact_lock(179826221);
  if kind='createDriver' then
    phone_value:=regexp_replace(coalesce(p_command->>'phone',''),'[[:space:]().-]','','g');
    if phone_value ~ '^\+?84[0-9]{9}$' then phone_value:='0'||right(phone_value,9); end if;
    perform private.lead_assert(phone_value ~ '^0[0-9]{9}$' and length(btrim(p_command->>'name')) between 2 and 120,'Tên hoặc số điện thoại tài xế không hợp lệ.');
    event_id:='DRV-'||coalesce((p_command->>'requestId')::uuid,gen_random_uuid());
    insert into private.lead_sim_drivers(id,name,phone,created_by) values(event_id,btrim(p_command->>'name'),phone_value,(a->>'id')::bigint) on conflict(id) do nothing;
    select * into driver from private.lead_sim_drivers where id=event_id;
    perform private.lead_assert(driver.name=btrim(p_command->>'name') and driver.phone=phone_value and driver.created_by=(a->>'id')::bigint,'Mã tạo tài xế đã dùng cho nội dung khác.');
    return jsonb_build_object('driverId',driver.id);
  elsif kind='link' then
    select * into driver from private.lead_sim_drivers where id=p_command->>'driverId';
    select data into linked from public.leads where id=p_command->>'leadId';
    perform private.lead_assert(driver.id is not null and linked is not null and driver.phone=linked->>'phone' and not (linked->>'archived')::boolean,'Chọn đúng Lead có cùng số điện thoại, chưa lưu trữ.');
    if exists(select 1 from private.lead_core_links where driver_id=driver.id and lead_id=linked->>'id') then return '{"ok":true}'::jsonb; end if;
    perform private.lead_assert(not exists(select 1 from private.lead_core_links where driver_id=driver.id or lead_id=linked->>'id'),'Tài xế hoặc Lead đã có liên kết; không tự ghi đè liên kết.');
    insert into private.lead_core_links(driver_id,lead_id,confirmed_by) values(driver.id,linked->>'id',(a->>'id')::bigint);
    insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',now(),'actorId',a->>'id','action','Cho phép dùng giả lập','target',linked->>'id','detail',driver.id),linked->>'id');
    return '{"ok":true}'::jsonb;
  elsif kind='resend' then
    select o.payload into event_payload from private.lead_sim_outbox o where o.id=p_command->>'eventId';
    perform private.lead_assert(event_payload is not null,'Không tìm thấy bản tin nguồn.');
    return jsonb_build_object('event',event_payload);
  elsif kind='emit' then
    select * into driver from private.lead_sim_drivers where id=p_command->>'driverId';
    perform private.lead_assert(driver.id is not null,'Chọn tài xế giả lập.');
    typ:=p_command->>'eventType'; moment:=(p_command->>'occurredAt')::timestamptz;
    perform private.lead_assert(typ in ('account_created','registration_pending','registration_completed','order_received','order_cancelled','first_order_completed') and moment<=now() and moment>='2000-01-01'::timestamptz,'Loại hoặc ngày sự kiện không hợp lệ.');
    if typ like '%order%' then perform private.lead_assert(length(btrim(p_command->>'orderId')) between 1 and 120,'Nhập mã đơn.'); end if;
    event_id:=coalesce(p_command->>'requestId',gen_random_uuid()::text);
    perform private.lead_assert(length(event_id) between 1 and 120,'Mã sự kiện không hợp lệ.');
    event_payload:=jsonb_build_object('sourceSystem','driver-simulator','eventId',event_id,'externalDriverId',driver.id,'phone',driver.phone,'eventType',typ,'occurredAt',moment,'orderId',coalesce(p_command->>'orderId',''));
    insert into private.lead_sim_outbox(id,driver_id,payload,actor_id) values(event_id,driver.id,event_payload,(a->>'id')::bigint) on conflict(id) do nothing;
    perform private.lead_assert(exists(select 1 from private.lead_sim_outbox where id=event_id and private.lead_sim_outbox.payload=event_payload),'Mã gửi đã dùng cho nội dung khác.');
    update private.lead_sim_drivers set state=typ where id=driver.id;
    if typ in ('account_created','registration_pending','registration_completed') then
      update private.lead_sim_drivers set registration_state=typ,registration_at=moment where id=driver.id and (registration_at is null or registration_at<=moment) and (registration_state<>'registration_completed' or typ='registration_completed');
    else
      perform private.lead_assert(not exists(select 1 from private.lead_sim_orders where id=p_command->>'orderId' and driver_id<>driver.id),'Mã đơn đã thuộc tài xế khác.');
      insert into private.lead_sim_orders(id,driver_id,status,occurred_at) values(p_command->>'orderId',driver.id,typ,moment)
        on conflict(id) do update set status=excluded.status,occurred_at=excluded.occurred_at where private.lead_sim_orders.occurred_at<=excluded.occurred_at and private.lead_sim_orders.status<>'first_order_completed';
    end if;
    return jsonb_build_object('event',event_payload);
  end if;
  raise exception 'Thao tác giả lập không hợp lệ.';
end $$;
revoke all on function private.lead_core_process(text),private.lead_core_receive(jsonb) from public,anon,authenticated;
revoke all on function public.lead_simulator(jsonb) from public,anon;
grant execute on function public.lead_simulator(jsonb) to authenticated;

alter table private.lead_import_batches add column rows jsonb not null default '[]', add column results jsonb not null default '{}';
create function public.lead_import(p_command jsonb) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(); batch private.lead_import_batches; kind text:=p_command->>'type'; row_index integer; input jsonb; result jsonb; phone_value text; row_request uuid; reason text;
begin
  perform private.lead_assert(a->>'role' in ('admin','intake'),'Chỉ tiếp nhận/Admin được nhập dữ liệu.');
  if kind='list' then
    return coalesce((select jsonb_agg(jsonb_build_object('id',id,'fileName',file_name,'createdAt',created_at,'count',jsonb_array_length(rows),'results',results) order by created_at desc) from private.lead_import_batches where actor_id=(a->>'id')::bigint or a->>'role'='admin'),'[]');
  end if;
  if kind='create' then
    perform private.lead_assert(jsonb_typeof(p_command->'rows')='array' and jsonb_array_length(p_command->'rows') between 1 and 500 and length(p_command->>'fileName') between 1 and 255 and octet_length((p_command->'rows')::text)<=5242880,'Lô nhập cần 1–500 dòng, không quá 5 MB.');
    insert into private.lead_import_batches(id,actor_id,file_name,rows) values((p_command->>'id')::uuid,(a->>'id')::bigint,p_command->>'fileName',p_command->'rows') on conflict(id) do nothing;
  end if;
  select * into batch from private.lead_import_batches where id=(p_command->>'id')::uuid for update;
  perform private.lead_assert(batch.id is not null and (batch.actor_id=(a->>'id')::bigint or a->>'role'='admin'),'Không tìm thấy lô nhập thuộc quyền của bạn.');
  if kind='create' then perform private.lead_assert(batch.rows=p_command->'rows' and batch.file_name=p_command->>'fileName','Mã lô nhập đã dùng cho dữ liệu khác.'); end if;
  if kind in ('create','get') then return jsonb_build_object('id',batch.id,'fileName',batch.file_name,'rows',batch.rows,'results',batch.results); end if;
  perform private.lead_assert(kind='row','Lệnh nhập dữ liệu không hợp lệ.');
  row_index:=(p_command->>'index')::int;
  perform private.lead_assert(row_index>=0 and row_index<jsonb_array_length(batch.rows),'Dòng nhập không hợp lệ.');
  result:=batch.results->row_index::text;
  if result->>'status' in ('saved','skipped') then return result; end if;
  input:=batch.rows->row_index;
  phone_value:=regexp_replace(regexp_replace(input->>'phone','[[:space:]().-]','','g'),'^\+?84([0-9]{9})$','0\1');
  if exists(select 1 from jsonb_array_elements(batch.rows) with ordinality x(value,n) where n<=row_index and regexp_replace(regexp_replace(value->>'phone','[[:space:]().-]','','g'),'^\+?84([0-9]{9})$','0\1')=phone_value) then
    result:=jsonb_build_object('status','skipped','message','Trùng số điện thoại với dòng trước trong file.');
  else
    begin
      row_request:=md5(batch.id::text||':'||row_index)::uuid;
      perform public.lead_command(jsonb_build_object('type','saveLead','input',input),row_request,null);
      result:=jsonb_build_object('status','saved','message','Đã lưu','leadId',(select id from public.leads where phone=phone_value));
    exception when others then reason:=sqlerrm;result:=jsonb_build_object('status','failed','message',reason); end;
  end if;
  update private.lead_import_batches set results=jsonb_set(results,array[row_index::text],result||jsonb_build_object('at',now())) where id=batch.id;
  return result;
end $$;
revoke all on function public.lead_import(jsonb) from public,anon;
grant execute on function public.lead_import(jsonb) to authenticated;

create or replace function public.lead_run_jobs() returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare expired_ticket record; closed_count integer:=0; local_now timestamp:=now() at time zone 'Asia/Ho_Chi_Minh';
begin
  perform pg_advisory_xact_lock(179826221);
  for expired_ticket in select id from public.lead_assignments where status<>'Closed' and expires_at<=now() for update skip locked loop
    perform private.lead_close(expired_ticket.id,'Hết thời hạn phân công 14 ngày'); closed_count:=closed_count+1;
  end loop;
  insert into public.lead_notifications(data)
  select jsonb_build_object('id','reminder-'||ap.id||'-'||k.kind,'recipientId',t.assignee_id::text,'at',now(),
    'leadId',l.id,'appointmentId',ap.id,'href','/assignments/'||t.id||'/show',
    'title',l.data->>'name'||' · '||case when k.kind='hour' then 'Lịch hẹn trong 1 giờ tới' else 'Đã đến giờ hẹn' end||' · '||to_char(ap.due_at at time zone 'Asia/Ho_Chi_Minh','DD/MM HH24:MI'))
  from public.lead_appointments ap join public.lead_assignments t on t.id=ap.assignment_id join public.leads l on l.id=ap.lead_id
  cross join (values ('hour'),('due')) k(kind)
  where ap.status='scheduled' and t.status in ('New','Open') and t.expires_at>now()
    and ((k.kind='hour' and ap.due_at>now() and ap.due_at<=now()+interval '1 hour' and coalesce((ap.data->>'createdAt')::timestamptz,ap.due_at-interval '2 hours')<=ap.due_at-interval '1 hour') or (k.kind='due' and ap.due_at<=now()))
  on conflict(id) do nothing;
  if local_now::time>=time '08:00' then
    insert into public.lead_notifications(data)
    select jsonb_build_object('id','digest-'||local_now::date::text||'-'||s.id::text,'recipientId',s.id::text,'at',now(),'href','/handover','title','Kiểm tra hàng đợi bàn giao phiếu Closed hằng ngày.')
    from public.sales s join public.lead_user_roles r on r.sales_id=s.id
    where not s.disabled and r.role_code in ('admin','intake') and exists(select 1 from public.lead_closure_reviews where not (data ? 'reviewedAt') and (data->>'at')::timestamptz < (local_now::date::timestamp at time zone 'Asia/Ho_Chi_Minh'))
    on conflict(id) do nothing;
  end if;
  return jsonb_build_object('closed',closed_count,'at',now());
end; $$;
revoke all on function public.lead_run_jobs() from public,anon,authenticated;
grant execute on function public.lead_run_jobs() to service_role;
