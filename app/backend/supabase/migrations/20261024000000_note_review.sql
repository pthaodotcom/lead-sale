-- NOTE SUA 24/10: forward-only, existing resource JSON and IDs are preserved.
alter function public.lead_command(jsonb,uuid,integer) set schema private;
alter function private.lead_command(jsonb,uuid,integer) rename to lead_command_pre_review;
revoke all on function private.lead_command_pre_review(jsonb,uuid,integer) from public,anon,authenticated;

alter table public.lead_appointments drop constraint lead_appointments_status_check;
alter table public.lead_appointments add constraint lead_appointments_status_check check(status in ('scheduled','waiting','succeeded','failed','cancelled','attended','missed'));
alter table public.lead_activities drop constraint lead_activity_outcome;
alter table public.lead_activities add constraint lead_activity_outcome check(data->>'outcome' in ('called','activated','no_answer','unresponsive','overdue','wrong_phone'));

create or replace function private.lead_can_read(p_lead text) returns boolean
language plpgsql stable security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(false); t jsonb;
begin
  if a is null or a->>'role' in ('admin','viewer') then return false; end if;
  if a->>'role'='intake' then return true; end if;
  t:=private.lead_latest(p_lead);
  if a->>'role'='leader' then return coalesce(t->>'teamId'=a->>'teamId',false) or exists(select 1 from public.leads l where l.id=p_lead and l.status='New' and not l.archived and not exists(select 1 from public.lead_assignments x where x.lead_id=l.id and x.status<>'Closed')); end if;
  return coalesce(a->>'role'='telesale' and t->>'assigneeId'=a->>'id' and t->>'status'<>'Closed' and (t->>'expiresAt')::timestamptz>now(),false);
end $$;
create or replace function private.lead_can_ticket(p_ticket text) returns boolean
language plpgsql stable security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(false); t jsonb;
begin
  if a is null or a->>'role' in ('admin','viewer') then return false; end if;
  select data into t from public.lead_assignments where id=p_ticket;
  if t is null then return false; end if;
  if a->>'role'='intake' then return false; end if;
  if a->>'role'='leader' then return coalesce(t->>'teamId'=a->>'teamId',false); end if;
  -- Own ticket history remains readable, including Closed; never another assignee's history.
  return coalesce(a->>'role'='telesale' and t->>'assigneeId'=a->>'id',false);
end $$;
create or replace function private.lead_cancel_appointments(p_ticket text) returns void
language sql security definer set search_path=public,private as $$
update public.lead_appointments set data=data||jsonb_build_object('status','cancelled','resultReason','Phiếu ngừng chăm sóc','resultAt',now())
where assignment_id=p_ticket and status='scheduled' and due_at>now() and not exists(select 1 from public.leads l where l.id=lead_id and l.data ? 'activatedAt' and ((l.data->>'activatedAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date=(due_at at time zone 'Asia/Ho_Chi_Minh')::date);
$$;
-- New tickets carry an immutable minimal profile for the owner's historical read.
create function private.lead_ticket_profile() returns trigger language plpgsql security definer set search_path=public,private as $$
declare l jsonb;
begin
  select data into l from public.leads where id=new.data->>'leadId';
  new.data:=new.data||jsonb_build_object('leadSnapshot',jsonb_build_object('id',l->>'id','name',l->>'name','phone',l->>'phone','city',l->>'city','vehicle',l->>'vehicle','sourceId',l->>'sourceId'));
  return new;
end $$;
create trigger lead_ticket_profile before insert on public.lead_assignments for each row execute function private.lead_ticket_profile();

create function private.lead_settle_appointments(p_now timestamptz) returns void
language plpgsql security definer set search_path=public,private as $$
declare ap record; l jsonb; t jsonb; cutoff timestamptz; ok boolean; stamp timestamptz:=p_now;
begin
  perform pg_advisory_xact_lock(179826221);
  update public.lead_appointments set data=data||'{"status":"waiting"}' where status='scheduled' and due_at<=stamp;
  for ap in select * from public.lead_appointments where status='waiting' for update loop
    cutoff:=(((ap.due_at at time zone 'Asia/Ho_Chi_Minh')::date+1)+time '08:00') at time zone 'Asia/Ho_Chi_Minh';
    if stamp<cutoff then continue; end if;
    select data into l from public.leads where id=ap.lead_id;
    ok:=coalesce((l->>'activatedAt')::timestamptz<=cutoff and ((l->>'activatedAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date=(ap.due_at at time zone 'Asia/Ho_Chi_Minh')::date,false);
    update public.lead_appointments set data=data||jsonb_build_object('status',case when ok then 'succeeded' else 'failed' end,'resultAt',stamp,'resultCutoff',cutoff,'resultReason',case when ok then 'Đã đối chiếu mốc đăng ký trong ngày hẹn' else 'Chưa có mốc đăng ký hợp lệ lúc 08:00 hôm sau' end) where id=ap.id;
    select data into t from public.lead_assignments where id=ap.assignment_id for update;
    if not ok then
      insert into public.lead_activities(data) values(jsonb_build_object('id','HEN-RESULT-'||ap.id,'leadId',ap.lead_id,'assignmentId',ap.assignment_id,'actorId','system','channel','call','at',stamp,'outcome','overdue','decision','none','reason','none','note','Chưa có kết quả đăng ký hợp lệ lúc chốt 08:00','round',coalesce((ap.data->>'round')::int,(select round_no from public.lead_activities where id=ap.data->>'activityId'),(t->>'round')::int,1),'appointmentId',ap.id)) on conflict(appointment_id) do nothing;
      if t->>'status' in ('New','Open') and (t->>'expiresAt')::timestamptz>stamp and (private.lead_counts(ap.assignment_id)->>'overdue')::int>=3 then
        update public.lead_assignments set data=data||jsonb_build_object('status','Solved','updatedAt',stamp,'version',coalesce((data->>'version')::int,1)+1) where id=ap.assignment_id;
        perform private.lead_cancel_appointments(ap.assignment_id);
      end if;
    end if;
  end loop;
end $$;
alter function public.lead_run_jobs() set schema private;
alter function private.lead_run_jobs() rename to lead_jobs_pre_review;
create function public.lead_run_jobs() returns jsonb language plpgsql security definer set search_path=public,private as $$
begin
  perform private.lead_settle_appointments(now());
  return private.lead_jobs_pre_review();
end $$;
create function public.lead_sync() returns void language plpgsql security definer set search_path=public,private as $$
begin perform private.lead_actor(); perform public.lead_run_jobs(); end $$;

create function public.lead_admin_check() returns void language plpgsql stable security definer set search_path=public,private as $$
begin perform private.lead_assert(private.lead_actor()->>'role'='admin','Chỉ quản trị được quản lý tài khoản.'); end $$;

create function public.lead_command(p_command jsonb,p_request_id uuid,p_expected_version integer default null) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare a jsonb:=private.lead_actor(); kind text:=p_command->>'type'; target text:=p_command->>'id';
  prev jsonb; t jsonb; ap jsonb; l jsonb; input jsonb:=p_command->'input'; f jsonb; item jsonb; result jsonb;
  ticket text; lead text; aid text; moment timestamptz; stamp timestamptz:=now(); status_value text; reason text:=btrim(p_command->>'reason');
begin
  perform private.lead_assert(p_request_id is not null and jsonb_typeof(p_command)='object','Yêu cầu không hợp lệ.');
  perform pg_advisory_xact_lock(179826221);
  if a->>'role'='admin' then perform private.lead_assert(kind in ('member','memberProfile','noticeRead'),'Quản trị viên chỉ quản lý tài khoản và phân quyền.'); end if;
  perform private.lead_assert(kind not in ('source','team','statusLabel','voidActivity','attachment'),'Chức năng không còn trong phạm vi; lưu bằng chứng cùng lần liên hệ.');
  select payload into prev from private.lead_requests where actor_id=(a->>'id')::bigint and request_id=p_request_id;
  if found then perform private.lead_assert(prev=p_command,'Mã yêu cầu đã dùng cho nội dung khác.'); return '{"ok":true}'; end if;
  if kind in ('activity','reschedule','appointment') then
    if kind='activity' then ticket:=p_command->>'assignmentId'; else select data into ap from public.lead_appointments where id=target for update; ticket:=ap->>'assignmentId'; end if;
    select data into t from public.lead_assignments where id=ticket for update;
    perform private.lead_assert(t is not null and a->>'role'='telesale' and t->>'assigneeId'=a->>'id' and t->>'status' in ('New','Open') and (t->>'expiresAt')::timestamptz>stamp,'Chỉ chuyên viên được giao được cập nhật phiếu còn hạn.');
    perform private.lead_assert(p_expected_version=coalesce((t->>'version')::int,1),'Phiếu đã thay đổi. Tải lại trước khi lưu.');
    lead:=t->>'leadId'; select data into l from public.leads where id=lead;
    if kind='activity' then
      perform private.lead_assert(l->>'status'='New' and t->>'acceptedAt' is not null,'Nhận việc trên hồ sơ Mới trước khi ghi tư vấn.');
      moment:=(input->>'at')::timestamptz;
      perform private.lead_assert(moment<=stamp and moment>=(t->>'createdAt')::timestamptz and moment>=(select opened_at from public.lead_care_rounds where assignment_id=ticket and round_no=(t->>'round')::int),'Thời điểm liên hệ không thuộc đợt chăm sóc hiện tại.');
      perform private.lead_assert(input->>'channel' in ('call','zalo') and input->>'outcome' in ('called','activated','no_answer','wrong_phone','unresponsive') and input->>'decision' in ('none','agreed','declined','hungup') and input->>'reason' in ('none','no_need','busy','ineligible') and length(btrim(input->>'note'))>0,'Thông tin liên hệ không hợp lệ.');
      perform private.lead_assert(not (input->>'channel'='zalo' and input->>'outcome'='no_answer') and not (input->>'channel'='call' and input->>'outcome'='unresponsive'),'Kết quả không phù hợp kênh liên hệ.');
      perform private.lead_assert(input->>'outcome' in ('called','activated') or input->>'decision'='none','Chưa liên hệ được thì chưa có quyết định.');
      perform private.lead_assert(input->>'decision'<>'declined' or input->>'reason'<>'none','Chọn lý do không đồng ý.');
      perform private.lead_assert(input->>'ticketStatus' in ('Open','Solved'),'Chọn trạng thái phiếu sau khi ghi nhận liên hệ.');
      perform private.lead_assert(jsonb_typeof(input->'attachments')='array' and jsonb_array_length(input->'attachments')>0,'Đính kèm bằng chứng trước khi lưu.');
      for f in select value from jsonb_array_elements(input->'attachments') loop
        perform private.lead_assert(length(f->>'name')>0 and (f->>'size')::bigint between 1 and 20971520 and split_part(f->>'path','/',1)=a->>'id' and split_part(f->>'path','/',2)=ticket,'Bằng chứng không hợp lệ.');
        perform private.lead_assert(exists(select 1 from storage.objects o where bucket_id='lead-evidence' and name=f->>'path' and to_jsonb(o)->'metadata'->>'mimetype'=f->>'type' and (to_jsonb(o)->'metadata'->>'size')::bigint=(f->>'size')::bigint),'Tệp chưa tải lên thành công.');
      end loop;
      perform private.lead_assert(exists(select 1 from jsonb_array_elements(input->'attachments') ev where case when input->>'channel'='zalo' or input->>'outcome' in ('no_answer','wrong_phone') then ev->>'type' like 'image/%' else ev->>'type' like 'audio/%' end),'Cần ghi âm cuộc gọi hoặc ảnh chat/nhật ký cuộc gọi phù hợp.');
      aid:='HD-'||gen_random_uuid();
      item:=jsonb_build_object('id',aid,'leadId',lead,'assignmentId',ticket,'actorId',a->>'id','channel',input->>'channel','at',moment,'outcome',input->>'outcome','decision',input->>'decision','reason',case when input->>'decision'='declined' then input->>'reason' else 'none' end,'note',btrim(input->>'note'),'round',(t->>'round')::int,'attachments',input->'attachments');
      insert into public.lead_activities(data) values(item);
      for f in select value from jsonb_array_elements(input->'attachments') loop insert into public.lead_attachments(data,activity_id,lead_id) values(f,aid,lead); end loop;
      if coalesce(input->>'appointmentAt','')<>'' then
        moment:=(input->>'appointmentAt')::timestamptz;
        perform private.lead_assert(input->>'decision'='agreed' and input->>'outcome'='called' and input->>'ticketStatus'='Open' and moment>stamp and moment<(t->>'expiresAt')::timestamptz,'Lịch hẹn phải trong tương lai, trong hạn phiếu và có quyết định Đồng ý.');
        perform private.lead_assert(input->>'place' in ('văn phòng HN1','văn phòng HN2','văn phòng HCM1','văn phòng HCM2','văn phòng ĐN1','văn phòng ĐN2'),'Chọn văn phòng trong danh sách.');
        perform private.lead_assert(not exists(select 1 from public.lead_appointments where assignment_id=ticket and status in ('scheduled','waiting')),'Phiếu đã có lịch. Dùng Hẹn lại để giữ lịch sử.');
        insert into public.lead_appointments(data,due_at) values(jsonb_build_object('id','HEN-'||gen_random_uuid(),'leadId',lead,'assignmentId',ticket,'activityId',aid,'actorId',a->>'id','at',moment,'place',input->>'place','status','scheduled','createdAt',stamp,'round',(t->>'round')::int),moment);
      end if;
      status_value:=case when input->>'ticketStatus'='Solved' or (private.lead_counts(ticket)->>'noAnswer')::int>=3 or (input->>'decision'='declined' and input->>'reason' in ('no_need','ineligible')) or input->>'outcome'='wrong_phone' then 'Solved' else 'Open' end;
      update public.lead_assignments set data=data||jsonb_build_object('status',status_value,'updatedAt',stamp,'version',(data->>'version')::int+1) where id=ticket;
      if status_value='Solved' then perform private.lead_cancel_appointments(ticket); end if;
      if input->>'outcome'='wrong_phone' then update public.leads set data=data||jsonb_build_object('wrongPhone',true,'updatedAt',stamp,'version',coalesce((data->>'version')::int,1)+1) where id=lead; end if;
    elsif kind='appointment' then
      perform private.lead_assert(p_command->>'status'='cancelled' and ap->>'status' in ('scheduled','waiting'),'Kết quả lịch hẹn được hệ thống đối soát lúc 08:00 hôm sau.');
      update public.lead_appointments set data=data||jsonb_build_object('status','cancelled','resultAt',stamp,'resultReason','Chuyên viên hủy lịch') where id=target;
      update public.lead_assignments set data=data||jsonb_build_object('updatedAt',stamp,'version',(data->>'version')::int+1) where id=ticket;
    else
      perform private.lead_assert(ap->>'status' in ('scheduled','waiting','failed'),'Lịch này không thể hẹn lại.');
      moment:=(p_command->>'at')::timestamptz;
      perform private.lead_assert(moment>stamp and moment<(t->>'expiresAt')::timestamptz and p_command->>'place' in ('văn phòng HN1','văn phòng HN2','văn phòng HCM1','văn phòng HCM2','văn phòng ĐN1','văn phòng ĐN2'),'Chọn văn phòng và ngày giờ trong tương lai, trong hạn phiếu.');
      if ap->>'status'<>'failed' then update public.lead_appointments set data=data||jsonb_build_object('status','cancelled','resultReason','Đổi lịch hẹn','resultAt',stamp) where id=target; end if;
      insert into public.lead_appointments(data,due_at) values((ap-'resultAt'-'resultCutoff'-'resultReason'-'resultHistory')||jsonb_build_object('id','HEN-'||gen_random_uuid(),'at',moment,'place',p_command->>'place','status','scheduled','previousId',target,'createdAt',stamp,'round',(t->>'round')::int),moment);
      update public.lead_assignments set data=data||jsonb_build_object('updatedAt',stamp,'version',(data->>'version')::int+1) where id=ticket;
    end if;
  elsif kind in ('review','amendReview') then
    perform private.lead_assert(a->>'role'='intake','Chỉ tiếp nhận được rà soát bàn giao.');
    select data into ap from public.lead_closure_reviews where id=target for update;
    perform private.lead_assert(ap is not null and p_expected_version=coalesce((ap->>'version')::int,1),'Bàn giao đã thay đổi. Tải lại.');
    perform private.lead_assert((kind='review' and ap->>'reviewedAt' is null) or (kind='amendReview' and ap->>'reviewedAt' is not null and length(reason)>0),'Kết quả đã xác nhận; đính chính cần lý do.');
    perform private.lead_assert(p_command->>'result' in ('eligible','closed') and length(btrim(p_command->>'note'))>0,'Chọn Đủ điều kiện phân công lại hoặc Đóng hồ sơ và nhập căn cứ.');
    lead:=ap->>'leadId'; select data into l from public.leads where id=lead for update;
    perform private.lead_assert(l->>'status' not in ('Activated','Onboarded') and not (l ? 'activatedAt') and not (l ? 'onboardedAt'),'Hồ sơ đã thành công; không được xóa mốc bằng rà soát Closed.');
    perform private.lead_assert(not exists(select 1 from public.lead_assignments where lead_id=lead and status<>'Closed'),'Hồ sơ đang có phiếu hiệu lực; không thể đổi kết quả rà soát.');
    update public.leads set data=data||jsonb_build_object('status',case when p_command->>'result'='eligible' then 'New' else 'Closed' end,'updatedAt',stamp,'version',coalesce((data->>'version')::int,1)+1) where id=lead;
    update public.lead_closure_reviews set data=data||jsonb_build_object('reviewedAt',stamp,'reviewedBy',a->>'id','result',p_command->>'result','note',btrim(p_command->>'note'),'version',coalesce((data->>'version')::int,1)+1,'history',coalesce(data->'history','[]')||jsonb_build_array((ap-'history')||jsonb_build_object('amendReason',reason))) where id=target;
  elsif kind='reconcileAppointment' then
    perform private.lead_assert(a->>'role'='intake' and length(reason)>0,'Chỉ tiếp nhận được đối soát; nhập căn cứ.');
    select data into ap from public.lead_appointments where id=target for update; lead:=ap->>'leadId';
    select data into l from public.leads where id=lead;
    perform private.lead_assert(ap->>'status'='failed' and (l->>'activatedAt')::timestamptz<=(ap->>'resultCutoff')::timestamptz and ((l->>'activatedAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date=((ap->>'at')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date,'Chỉ đối soát lịch thất bại có mốc đăng ký hợp lệ trong ngày hẹn, trước lúc chốt.');
    update public.lead_appointments set data=data||jsonb_build_object('status','succeeded','resultAt',stamp,'resultReason',reason,'resultHistory',coalesce(data->'resultHistory','[]')||jsonb_build_array(jsonb_build_object('status',ap->>'status','at',stamp,'reason',reason))) where id=target;
    update public.lead_activities set data=data||jsonb_build_object('voidedAt',stamp,'voidReason','Đối soát kết quả đến muộn: '||reason) where appointment_id=target and data->>'outcome'='overdue';
  elsif kind='memberProfile' then
    perform public.lead_admin_check();
    perform private.lead_assert(length(btrim(p_command->>'name')) between 2 and 120,'Họ tên từ 2–120 ký tự.');
    perform private.lead_assert(exists(select 1 from public.sales where id::text=target and email=p_command->>'email'),'Email đăng nhập được giữ nguyên; chỉ sửa tên hiển thị.');
    update public.sales set first_name=btrim(p_command->>'name'),last_name='' where id::text=target;
  else
    perform private.lead_assert(kind<>'correctAppointment','Dùng đối soát kết quả đến muộn tại Tiếp nhận.');
    return private.lead_command_pre_review(p_command,p_request_id,p_expected_version);
  end if;
  insert into private.lead_requests(actor_id,request_id,payload) values((a->>'id')::bigint,p_request_id,p_command);
  insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),'at',stamp,'actorId',a->>'id','action',kind,'target',coalesce(ticket,target),'detail',(p_command-'input')::text,'requestId',p_request_id),lead);
  return '{"ok":true}';
end $$;

-- Direct reads must enforce the new Admin boundary as well as the command gate.
drop policy lead_receptions_read on public.lead_receptions;
create policy lead_receptions_read on public.lead_receptions for select to authenticated using((private.lead_actor(false)->>'role')='intake');
drop policy lead_reviews_read on public.lead_closure_reviews;
create policy lead_reviews_read on public.lead_closure_reviews for select to authenticated using((private.lead_actor(false)->>'role')='intake' or ((private.lead_actor(false)->>'role')='leader' and private.lead_can_ticket(assignment_id)));
drop policy lead_audit_read on public.lead_audit_logs;
create policy lead_audit_read on public.lead_audit_logs for select to authenticated using(((private.lead_actor(false)->>'role')='admin' and lead_id is null and data->>'action' in ('member','memberProfile')) or ((private.lead_actor(false)->>'role')='intake' and lead_id is not null));
-- Simulator remains a technical service only; no business role can actuate it.
revoke execute on function public.lead_simulator(jsonb) from authenticated;
revoke all on function public.lead_command(jsonb,uuid,integer),public.lead_sync(),public.lead_admin_check(),public.lead_run_jobs() from public,anon,authenticated;
grant execute on function public.lead_command(jsonb,uuid,integer),public.lead_sync(),public.lead_admin_check() to authenticated;
grant execute on function public.lead_run_jobs() to service_role;
revoke all on function private.lead_settle_appointments(timestamptz),private.lead_jobs_pre_review(),private.lead_ticket_profile() from public,anon,authenticated;

drop policy lead_appointments_read on public.lead_appointments;
create policy lead_appointments_read on public.lead_appointments for select to authenticated using(private.lead_actor(false)->>'role'='intake' or private.lead_can_ticket(assignment_id));

-- Some deployed workspaces have older inbox / Internet-call extensions.
-- Preserve their data and technical functions, remove business/anonymous entry points.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('lead_voice_staff','lead_voice_guest','lead_inbox_snapshot','lead_inbox_command','lead_inbox_reply_target','lead_inbox_receive','lead_public_intake') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
