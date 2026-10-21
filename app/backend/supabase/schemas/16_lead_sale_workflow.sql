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
