create or replace function private.lead_assert(ok boolean, message text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message using errcode='P0001'; end if; end; $$;

create or replace function private.lead_actor(required boolean default true) returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
declare result jsonb;
begin
  select jsonb_build_object('id',s.id::text,'name',btrim(s.first_name||' '||s.last_name),'role',r.role_code,'active',not s.disabled,'teamId',r.team_id)
  into result from public.sales s join public.lead_user_roles r on r.sales_id=s.id
  where s.user_id=auth.uid() and not s.disabled;
  if required then perform private.lead_assert(result is not null,'Tài khoản chưa được cấp quyền hoặc đã tạm ngưng.'); end if;
  return result;
end; $$;

create or replace function private.lead_latest(p_lead text) returns jsonb
language sql stable security definer set search_path=public,private as $$
select data from public.lead_assignments where lead_id=p_lead order by (data->>'createdAt')::timestamptz desc,sequence desc limit 1;
$$;
create or replace function private.lead_can_read(p_lead text) returns boolean
language plpgsql stable security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(false); t jsonb;
begin
  if a is null then return false; end if;
  if a->>'role' in ('admin','intake') then return true; end if;
  t:=private.lead_latest(p_lead);
  if a->>'role'='leader' then
    return coalesce(t->>'teamId'=a->>'teamId',false) or exists(select 1 from public.leads l where l.id=p_lead and l.status='New' and not l.archived and not exists(select 1 from public.lead_assignments x where x.lead_id=l.id and x.status<>'Closed' and x.expires_at>now()));
  end if;
  return coalesce(a->>'role'='telesale' and t->>'assigneeId'=a->>'id' and t->>'status'<>'Closed' and (t->>'expiresAt')::timestamptz>now(),false);
end; $$;
create or replace function private.lead_can_ticket(p_ticket text) returns boolean
language plpgsql stable security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(false); t jsonb; last_ticket jsonb;
begin
  if a is null then return false; end if;
  if a->>'role' in ('admin','intake') then return true; end if;
  select data into t from public.lead_assignments where id=p_ticket;
  if t is null then return false; end if;
  last_ticket:=private.lead_latest(t->>'leadId');
  if a->>'role'='leader' then return coalesce(last_ticket->>'teamId'=a->>'teamId',false); end if;
  return coalesce(a->>'role'='telesale' and t->>'assigneeId'=a->>'id' and t->>'status'<>'Closed' and (t->>'expiresAt')::timestamptz>now(),false);
end; $$;
create or replace function private.lead_cancel_appointments(p_ticket text) returns void
language sql security definer set search_path=public,private as $$
update public.lead_appointments set data=data||'{"status":"cancelled"}'::jsonb where assignment_id=p_ticket and status='scheduled';
$$;
create or replace function private.lead_close(p_ticket text, p_reason text, p_actor text default 'system') returns void
language plpgsql security definer set search_path=public,private as $$
declare t jsonb;
begin
  update public.lead_assignments set data=data||jsonb_build_object('status','Closed','closeReason',p_reason,'updatedAt',now(),'version',coalesce((data->>'version')::int,1)+1) where id=p_ticket and status<>'Closed' returning data into t;
  if t is null then return; end if;
  perform private.lead_cancel_appointments(p_ticket);
  insert into public.lead_closure_reviews(data) values(jsonb_build_object('id','BG-'||gen_random_uuid(),'assignmentId',p_ticket,'leadId',t->>'leadId','at',now(),'reason',p_reason)||case when p_reason='Chuyển người phụ trách' then jsonb_build_object('reviewedAt',now(),'reviewedBy',p_actor,'result','transferred') else '{}'::jsonb end) on conflict(assignment_id) do nothing;
  insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',now(),'actorId',p_actor,'action','Đóng phiếu','target',p_ticket,'detail',p_reason),t->>'leadId');
end; $$;
create or replace function private.lead_counts(p_ticket text) returns jsonb
language sql stable security definer set search_path=public,private as $$
select jsonb_build_object('noAnswer',count(*) filter(where a.data->>'outcome'='no_answer'),'overdue',count(*) filter(where a.data->>'outcome'='overdue'))
from public.lead_activities a join public.lead_assignments t on t.id=a.assignment_id
where a.assignment_id=p_ticket and a.round_no=coalesce((t.data->>'round')::int,1);
$$;

create or replace function public.lead_command(p_command jsonb, p_request_id uuid, p_expected_version integer default null) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare
  actor jsonb:=private.lead_actor(); actor_id text:=actor->>'id'; role text:=actor->>'role';
  kind text:=p_command->>'type'; target text:=p_command->>'id'; input jsonb:=p_command->'input';
  l jsonb; t jsonb; ap jsonb; item jsonb; old jsonb; member jsonb; numbers jsonb; attachment jsonb;
  entity_id text; lead_id_value text; ticket_id text; activity_id text; phone_value text; status_value text; reason text;
  stamp timestamptz:=now(); moment timestamptz; expires timestamptz; round_value integer;
  writable boolean; previous_request jsonb;
begin
  perform private.lead_assert(p_request_id is not null and jsonb_typeof(p_command)='object','Yêu cầu không hợp lệ.');
  -- Serialize commands in this small workspace. Uniqueness remains enforced by
  -- indexes, and readers are not blocked. Can be refined to per-Lead locks later.
  perform pg_advisory_xact_lock(179826221);
  select r.payload into previous_request from private.lead_requests r where r.actor_id=(actor->>'id')::bigint and r.request_id=p_request_id;
  if found then
    perform private.lead_assert(previous_request=p_command,'Mã yêu cầu đã được dùng cho nội dung khác.');
    return '{"ok":true}'::jsonb;
  end if;
  if kind in ('saveLead','leadStatus','archiveLead') and target is not null then
    select data into l from public.leads where id=target for update;
    perform private.lead_assert(l is not null and role in ('admin','intake'),'Bạn không có quyền sửa hồ sơ Lead.');
    perform private.lead_assert(p_expected_version=coalesce((l->>'version')::int,1),'Dữ liệu đã thay đổi. Tải lại trước khi lưu.');
  end if;
  ticket_id:=case when kind in ('ticketStatus','accept') then target else p_command->>'assignmentId' end;
  if kind in ('appointment','reschedule') then
    select data into ap from public.lead_appointments where id=target for update;
    ticket_id:=ap->>'assignmentId';
  elsif kind='attachment' then
    select data into item from public.lead_activities where id=p_command->>'activityId';
    ticket_id:=item->>'assignmentId';
  end if;
  if ticket_id is not null then
    select data into t from public.lead_assignments where id=ticket_id for update;
    perform private.lead_assert(t is not null and private.lead_can_ticket(ticket_id),'Bạn không có quyền truy cập phiếu.');
    perform private.lead_assert(p_expected_version=coalesce((t->>'version')::int,1),'Phiếu đã thay đổi. Tải lại trước khi lưu.');
    perform private.lead_assert(t->>'status'<>'Closed' and (t->>'expiresAt')::timestamptz>stamp,'Phiếu đã đóng hoặc hết hạn.');
    select data into l from public.leads where id=t->>'leadId';
    lead_id_value:=l->>'id';
    writable:=role='admin' or (role='telesale' and t->>'assigneeId'=actor_id);
  end if;

  case kind
  when 'team' then
    perform private.lead_assert(role='admin' and length(btrim(p_command->>'name')) between 2 and 120,'Chỉ quản trị được tạo nhóm có tên hợp lệ.');
    entity_id:='TEAM-'||gen_random_uuid();
    insert into public.lead_teams(id,name) values(entity_id,btrim(p_command->>'name'));
  when 'statusLabel' then
    perform private.lead_assert(role='admin' and length(btrim(p_command->>'label')) between 1 and 120,'Chỉ quản trị được sửa nhãn trạng thái.');
    update public.lead_statuses set label=btrim(p_command->>'label') where code=p_command->>'code';
    perform private.lead_assert(found,'Mã trạng thái không hợp lệ.');entity_id:=p_command->>'code';
  when 'saveLead' then
    perform private.lead_assert(role in ('admin','intake'),'Bạn không có quyền tiếp nhận hồ sơ.');
    phone_value:=regexp_replace(coalesce(input->>'phone',''),'[[:space:]().-]','','g');
    if phone_value ~ '^\+?84[0-9]{9}$' then phone_value:='0'||right(phone_value,9); end if;
    perform private.lead_assert(phone_value ~ '^0[0-9]{9}$','Số điện thoại cần có 10 chữ số, bắt đầu bằng 0 hoặc dùng +84.');
    perform private.lead_assert(length(btrim(input->>'name')) between 2 and 120 and length(btrim(input->>'city')) between 1 and 120 and input->>'vehicle' in ('Van','Motorbike') and jsonb_typeof(input->'tags')='array','Họ tên, thành phố, phương tiện và nhãn không hợp lệ.');
    perform private.lead_assert(exists(select 1 from public.lead_sources where id=input->>'sourceId' and ((data->>'active')::boolean or l->>'sourceId'=id)),'Chọn nguồn Lead đang sử dụng.');
    perform private.lead_assert(not exists(select 1 from public.leads where public.leads.phone=phone_value and id is distinct from target),'Số điện thoại đã có trong hồ sơ. Mở hồ sơ hiện có để bổ sung.');
    entity_id:=coalesce(target,'LEAD-'||gen_random_uuid());
    item:=jsonb_build_object('id',entity_id,'name',btrim(input->>'name'),'phone',phone_value,'city',btrim(input->>'city'),'vehicle',input->>'vehicle','sourceId',input->>'sourceId','tags',input->'tags','note',coalesce(input->>'note',''),'updatedAt',stamp,'version',coalesce((l->>'version')::int,0)+1);
    if target is null then
      item:=item||jsonb_build_object('status','New','receivedAt',stamp,'archived',false);
      insert into public.leads(data) values(item);
    else
      perform private.lead_assert(not (l->>'archived')::boolean,'Khôi phục hồ sơ trước khi chỉnh sửa.');
      update public.leads set data=l||item||jsonb_build_object('sourceId',l->>'sourceId') where id=target;
    end if;
    insert into public.lead_receptions(data) values(jsonb_build_object('id','TN-'||gen_random_uuid(),'leadId',entity_id,'sourceId',input->>'sourceId','at',stamp,'actorId',actor_id));
    lead_id_value:=entity_id;

  when 'leadStatus' then
    perform private.lead_assert(not (l->>'archived')::boolean,'Hồ sơ đã lưu trữ.');
    status_value:=p_command->>'status'; reason:=btrim(p_command->>'reason');
    perform private.lead_assert(length(reason)>0,'Nhập căn cứ cập nhật trạng thái.');
    perform private.lead_assert((l->>'status'='New' and status_value in ('Activated','Closed')) or (l->>'status'='Activated' and status_value='Onboarded') or (l->>'status'='Closed' and status_value='New'),'Chuyển trạng thái hồ sơ không hợp lệ.');
    moment:=coalesce((p_command->>'occurredAt')::timestamptz,stamp);
    perform private.lead_assert(moment<=stamp and moment>=(l->>'receivedAt')::timestamptz,'Thời điểm xác nhận không hợp lệ.');
    item:=l||jsonb_build_object('status',status_value,'updatedAt',stamp,'version',(l->>'version')::int+1);
    if status_value='Activated' then item:=item||jsonb_build_object('activatedAt',moment); end if;
    if status_value='Onboarded' then
      perform private.lead_assert(moment>=(l->>'activatedAt')::timestamptz,'Đơn đầu phải sau đăng ký.');
      item:=item||jsonb_build_object('onboardedAt',moment);
    end if;
    update public.leads set data=item where id=target;
    if status_value in ('Activated','Closed') then
      for t in select data from public.lead_assignments where public.lead_assignments.lead_id=target and status in ('New','Open') loop
        update public.lead_assignments set data=data||jsonb_build_object('status','Solved','updatedAt',stamp,'version',coalesce((data->>'version')::int,1)+1) where id=t->>'id';
        perform private.lead_cancel_appointments(t->>'id');
      end loop;
    end if;
    lead_id_value:=target; entity_id:=target;

  when 'archiveLead' then
    perform private.lead_assert(not exists(select 1 from public.lead_assignments where public.lead_assignments.lead_id=target and status<>'Closed'),'Đóng các phiếu đang hiệu lực trước khi lưu trữ hồ sơ.');
    update public.leads set data=data||jsonb_build_object('archived',not (data->>'archived')::boolean,'updatedAt',stamp,'version',(data->>'version')::int+1) where id=target;
    lead_id_value:=target; entity_id:=target;

  when 'assign' then
    perform private.lead_assert(role in ('admin','leader'),'Chỉ trưởng nhóm hoặc quản trị được phân công.');
    lead_id_value:=p_command->>'leadId';
    select data into l from public.leads where id=lead_id_value for update;
    perform private.lead_assert(l is not null and l->>'status'='New' and not (l->>'archived')::boolean and private.lead_can_read(lead_id_value),'Chỉ phân công hồ sơ Mới thuộc phạm vi của bạn.');
    select jsonb_build_object('id',s.id::text,'teamId',r.team_id) into member from public.sales s join public.lead_user_roles r on r.sales_id=s.id where s.id::text=p_command->>'assigneeId' and not s.disabled and r.role_code='telesale';
    perform private.lead_assert(member is not null and (role='admin' or member->>'teamId'=actor->>'teamId'),'Chọn nhân viên Telesale đang hoạt động trong nhóm.');
    -- Expired rows are closed atomically before assigning again.
    for old in select data from public.lead_assignments where public.lead_assignments.lead_id=lead_id_value and status<>'Closed' and expires_at<=stamp loop
      perform private.lead_close(old->>'id','Hết thời hạn phân công 14 ngày',actor_id);
    end loop;
    select data into old from public.lead_assignments where public.lead_assignments.lead_id=lead_id_value and status<>'Closed';
    perform private.lead_assert(old is null or coalesce((p_command->>'transfer')::boolean,false),'Lead đã có phiếu đang hiệu lực. Dùng chuyển người phụ trách.');
    perform private.lead_assert(old is null or (old->>'assigneeId'<>member->>'id' and (role='admin' or old->>'teamId'=actor->>'teamId')),'Không thể chuyển cho cùng nhân viên hoặc ngoài nhóm.');
    if old is not null then perform private.lead_close(old->>'id','Chuyển người phụ trách',actor_id); end if;
    entity_id:='PC-'||gen_random_uuid(); expires:=stamp+interval '14 days';
    item:=jsonb_build_object('id',entity_id,'leadId',lead_id_value,'assigneeId',member->>'id','teamId',member->>'teamId','assignedBy',actor_id,'createdAt',stamp,'updatedAt',stamp,'expiresAt',expires,'status','New','closeReason','','round',1,'version',1);
    if old is not null then item:=item||jsonb_build_object('previousId',old->>'id'); end if;
    insert into public.lead_assignments(data,expires_at) values(item,expires);
    insert into public.lead_care_rounds(assignment_id,round_no,actor_id,reason) values(entity_id,1,actor_id::bigint,'Phân công mới');

  when 'accept' then
    perform private.lead_assert(t->>'assigneeId'=actor_id,'Chỉ người được giao được nhận việc.');
    item:=t||jsonb_build_object('acceptedAt',coalesce(t->'acceptedAt',to_jsonb(stamp)),'updatedAt',stamp,'version',(t->>'version')::int+1);
    update public.lead_assignments set data=item where id=ticket_id; entity_id:=ticket_id;

  when 'ticketStatus' then
    perform private.lead_assert(writable or (role='leader' and t->>'teamId'=actor->>'teamId'),'Bạn không có quyền xử lý phiếu này.');
    status_value:=p_command->>'status'; reason:=btrim(p_command->>'reason');
    perform private.lead_assert(length(reason)>0 and status_value<>t->>'status','Nhập lý do và trạng thái mới hợp lệ.');
    if status_value='Closed' then
      perform private.lead_assert(role in ('admin','leader'),'Chỉ trưởng nhóm được đóng phiếu.');
      perform private.lead_close(ticket_id,reason,actor_id);
    else
      perform private.lead_assert(status_value='Solved' or (status_value='Open' and t->>'status'='Solved' and l->>'status'='New'),'Chuyển trạng thái phiếu không hợp lệ.');
      round_value:=coalesce((t->>'round')::int,1)+case when status_value='Open' then 1 else 0 end;
      update public.lead_assignments set data=data||jsonb_build_object('status',status_value,'round',round_value,'updatedAt',stamp,'version',(data->>'version')::int+1) where id=ticket_id;
      if status_value='Open' then insert into public.lead_care_rounds(assignment_id,round_no,actor_id,reason) values(ticket_id,round_value,actor_id::bigint,reason); else perform private.lead_cancel_appointments(ticket_id); end if;
    end if;
    entity_id:=ticket_id;

  when 'activity' then
    perform private.lead_assert(writable and t->>'status' in ('New','Open') and l->>'status'='New','Chỉ ghi tư vấn trên phiếu của bạn đang xử lý.');
    perform private.lead_assert(t->>'acceptedAt' is not null or role='admin','Nhận việc trước khi ghi tư vấn.');
    moment:=(input->>'at')::timestamptz;
    perform private.lead_assert(moment<=stamp and moment>=(t->>'createdAt')::timestamptz and moment>=(select opened_at from public.lead_care_rounds where assignment_id=ticket_id and round_no=(t->>'round')::int),'Thời điểm liên hệ phải trong đợt chăm sóc hiện tại và không ở tương lai.');
    perform private.lead_assert(input->>'channel' in ('call','zalo') and input->>'outcome' in ('called','no_answer','wrong_phone') and input->>'decision' in ('none','agreed','declined','hungup') and input->>'reason' in ('none','no_need','busy','ineligible') and length(btrim(input->>'note'))>0,'Thông tin hoạt động không hợp lệ. Ghi quá hẹn qua kết quả lịch hẹn.');
    perform private.lead_assert(input->>'outcome'='called' or input->>'decision'='none','Không ghi quyết định khi chưa liên hệ được.');
    perform private.lead_assert(input->>'decision'<>'declined' or input->>'reason'<>'none','Chọn lý do không đồng ý.');
    activity_id:='HD-'||gen_random_uuid();
    item:=jsonb_build_object('id',activity_id,'leadId',lead_id_value,'assignmentId',ticket_id,'actorId',actor_id,'channel',input->>'channel','at',moment,'outcome',input->>'outcome','decision',input->>'decision','reason',case when input->>'decision'='declined' then input->>'reason' else 'none' end,'note',btrim(input->>'note'),'round',(t->>'round')::int);
    insert into public.lead_activities(data) values(item);
    if coalesce(input->>'appointmentAt','')<>'' then
      moment:=(input->>'appointmentAt')::timestamptz;
      perform private.lead_assert(input->>'decision'='agreed' and moment>stamp and moment<(t->>'expiresAt')::timestamptz and length(btrim(input->>'place'))>0,'Lịch hẹn cần tương lai, trong hạn phiếu, địa điểm và quyết định Đồng ý.');
      perform private.lead_assert(not exists(select 1 from public.lead_appointments where assignment_id=ticket_id and status='scheduled'),'Phiếu đã có lịch hẹn. Dùng Hẹn lại để giữ lịch sử.');
      insert into public.lead_appointments(data,due_at) values(jsonb_build_object('id','HEN-'||gen_random_uuid(),'leadId',lead_id_value,'assignmentId',ticket_id,'activityId',activity_id,'actorId',t->>'assigneeId','at',moment,'place',btrim(input->>'place'),'status','scheduled','createdAt',stamp),moment);
    end if;
    numbers:=private.lead_counts(ticket_id);
    status_value:=case when (numbers->>'noAnswer')::int>=3 or (input->>'decision'='declined' and input->>'reason' in ('no_need','ineligible')) or input->>'outcome'='wrong_phone' then 'Solved' else 'Open' end;
    update public.lead_assignments set data=data||jsonb_build_object('status',status_value,'updatedAt',stamp,'version',(data->>'version')::int+1) where id=ticket_id;
    if status_value='Solved' then perform private.lead_cancel_appointments(ticket_id); end if;
    entity_id:=ticket_id;

  when 'appointment' then
    perform private.lead_assert(writable and t->>'status' in ('New','Open') and ap->>'status'='scheduled','Bạn không có quyền xử lý lịch hẹn này.');
    status_value:=p_command->>'status';
    perform private.lead_assert(status_value in ('attended','missed','cancelled'),'Kết quả lịch hẹn không hợp lệ.');
    if status_value in ('attended','missed') then perform private.lead_assert((ap->>'at')::timestamptz<=stamp,'Lịch hẹn chưa đến giờ.'); end if;
    update public.lead_appointments set data=data||jsonb_build_object('status',status_value,'resultAt',stamp,'resultBy',actor_id) where id=target;
    if status_value='missed' then
      insert into public.lead_activities(data) values(jsonb_build_object('id','HD-'||gen_random_uuid(),'leadId',lead_id_value,'assignmentId',ticket_id,'actorId',actor_id,'channel','call','at',stamp,'outcome','overdue','decision','none','reason','none','note','Không đến lịch hẹn','round',(t->>'round')::int,'appointmentId',target));
      numbers:=private.lead_counts(ticket_id);
      if (numbers->>'overdue')::int>=3 then update public.lead_assignments set data=data||'{"status":"Solved"}' where id=ticket_id; perform private.lead_cancel_appointments(ticket_id); end if;
    end if;
    update public.lead_assignments set data=data||jsonb_build_object('updatedAt',stamp,'version',(data->>'version')::int+1) where id=ticket_id;
    entity_id:=target;

  when 'reschedule' then
    perform private.lead_assert(writable and t->>'status' in ('New','Open') and ap->>'status'='scheduled','Bạn không có quyền hẹn lại lịch này.');
    moment:=(p_command->>'at')::timestamptz;
    perform private.lead_assert(moment>stamp and moment<(t->>'expiresAt')::timestamptz and length(btrim(p_command->>'place'))>0,'Ngày giờ hẹn phải trong tương lai, trong hạn phiếu và có địa điểm.');
    update public.lead_appointments set data=data||'{"status":"cancelled"}' where id=target;
    entity_id:='HEN-'||gen_random_uuid();
    insert into public.lead_appointments(data,due_at) values(ap||jsonb_build_object('id',entity_id,'at',moment,'place',btrim(p_command->>'place'),'status','scheduled','previousId',target,'createdAt',stamp),moment);
    update public.lead_assignments set data=data||jsonb_build_object('updatedAt',stamp,'version',(data->>'version')::int+1) where id=ticket_id;

  when 'review' then
    perform private.lead_assert(role in ('admin','intake') and length(btrim(p_command->>'note'))>0,'Chỉ tiếp nhận được rà soát bàn giao; nhập kết quả.');
    update public.lead_closure_reviews set data=data||jsonb_build_object('reviewedAt',stamp,'reviewedBy',actor_id,'result','reviewed','note',btrim(p_command->>'note')) where id=target returning lead_id into lead_id_value;
    perform private.lead_assert(found,'Không tìm thấy bàn giao.'); entity_id:=target;

  when 'noticeRead' then
    update public.lead_notifications set data=data||jsonb_build_object('readAt',stamp) where id=target and recipient_id=actor_id::bigint;
    perform private.lead_assert(found,'Không tìm thấy thông báo.'); entity_id:=target;

  when 'attachment' then
    perform private.lead_assert(writable,'Bạn không có quyền đính kèm.');
    attachment:=p_command->'attachment';
    perform private.lead_assert(length(attachment->>'name')>0 and (attachment->>'size')::bigint between 1 and 20971520 and attachment->>'path' like actor_id||'/'||ticket_id||'/%','Tệp đính kèm không hợp lệ.');
    perform private.lead_assert(exists(select 1 from storage.objects where bucket_id='lead-evidence' and name=attachment->>'path'),'Không tìm thấy tệp đã tải lên.');
    insert into public.lead_attachments(data,activity_id,lead_id) values(attachment,p_command->>'activityId',lead_id_value);
    update public.lead_activities set data=data||jsonb_build_object('attachments',coalesce(data->'attachments','[]'::jsonb)||jsonb_build_array(attachment)) where id=p_command->>'activityId';
    entity_id:=p_command->>'activityId';

  when 'source' then
    perform private.lead_assert(role='admin' and length(btrim(p_command->>'name')) between 2 and 120,'Chỉ quản trị được quản lý danh mục; tên từ 2–120 ký tự.');
    entity_id:=coalesce(target,'NGUON-'||gen_random_uuid());
    insert into public.lead_sources(data) values(jsonb_build_object('id',entity_id,'name',btrim(p_command->>'name'),'active',coalesce((p_command->>'active')::boolean,true))) on conflict(id) do update set data=excluded.data;

  when 'member' then
    perform private.lead_assert(role='admin' and target<>actor_id,'Chỉ quản trị được đổi tài khoản khác.');
    perform private.lead_assert(p_command->>'role' in ('admin','intake','leader','telesale','viewer') and jsonb_typeof(p_command->'active')='boolean','Vai trò/trạng thái tài khoản không hợp lệ.');
    perform private.lead_assert(not exists(select 1 from public.lead_assignments where assignee_id=target::bigint and status<>'Closed') or ((p_command->>'active')::boolean and p_command->>'role'='telesale' and not (p_command ? 'teamId')),'Chuyển các phiếu đang hiệu lực trước khi đổi quyền/nhóm hoặc tạm ngưng.');
    perform private.lead_assert(exists(select 1 from public.sales where id=target::bigint),'Không tìm thấy tài khoản.');
    insert into public.lead_user_roles(sales_id,role_code,team_id) values(target::bigint,p_command->>'role',coalesce(p_command->>'teamId',(select team_id from public.lead_user_roles where sales_id=target::bigint),'default')) on conflict(sales_id) do update set role_code=excluded.role_code,team_id=excluded.team_id;
    update public.sales set disabled=not (p_command->>'active')::boolean,administrator=p_command->>'role'='admin' where id=target::bigint;
    entity_id:=target;

  else raise exception 'Lệnh nghiệp vụ không hợp lệ.';
  end case;
  insert into private.lead_requests(actor_id,request_id,payload) values(actor_id::bigint,p_request_id,p_command);
  insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',stamp,'actorId',actor_id,'action',kind,'target',coalesce(entity_id,target,ticket_id,''),'detail',(p_command-'attachment')::text,'requestId',p_request_id),lead_id_value);
  return '{"ok":true}'::jsonb;
end; $$;
