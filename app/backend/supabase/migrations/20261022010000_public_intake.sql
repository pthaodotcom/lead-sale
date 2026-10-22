-- Public write-only intake. No anonymous reads or general CRM commands.
create table private.lead_public_requests (
  request_id uuid primary key,
  fingerprint text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
create index lead_public_requests_phone_time on private.lead_public_requests(phone,created_at);
create index lead_public_requests_time on private.lead_public_requests(created_at);
revoke all on private.lead_public_requests from public,anon,authenticated;

create function public.lead_public_intake(p_input jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare
  stamp timestamptz:=now(); phone_value text; lead_value text; old_fingerprint text;
  fingerprint_value text; profile_value jsonb; details text; intake jsonb; was_new boolean;
begin
  perform private.lead_assert(p_request_id is not null and jsonb_typeof(p_input)='object' and octet_length(p_input::text)<=12000,'Thông tin đăng ký không hợp lệ.');
  perform private.lead_assert(coalesce(p_input->>'website','')='' and p_input->'consent'='true'::jsonb,'Vui lòng đồng ý để đội ngũ tuyển tài xế liên hệ tư vấn.');
  phone_value:=regexp_replace(coalesce(p_input->>'phone',''),'[[:space:]().-]','','g');
  if phone_value ~ '^\+?84[0-9]{9}$' then phone_value:='0'||right(phone_value,9); end if;
  perform private.lead_assert(phone_value ~ '^0[0-9]{9}$','Số điện thoại cần có 10 chữ số, bắt đầu bằng 0 hoặc dùng +84.');
  perform private.lead_assert(length(btrim(p_input->>'name')) between 2 and 120,'Vui lòng nhập họ và tên từ 2 đến 120 ký tự.');
  perform private.lead_assert(length(btrim(p_input->>'city')) between 1 and 120,'Vui lòng nhập thành phố đăng ký.');
  perform private.lead_assert(p_input->>'vehicle' in ('Motorbike','Van'),'Vui lòng chọn xe máy hoặc xe Van.');
  perform private.lead_assert(length(coalesce(p_input->>'district',''))<=120 and length(coalesce(p_input->>'note',''))<=2000,'Nội dung đăng ký quá dài.');
  perform private.lead_assert(coalesce(p_input->>'hasVehicle','') in ('','yes','no') and coalesce(p_input->>'callTime','any') in ('any','morning','afternoon','evening'),'Vui lòng kiểm tra tình trạng xe và khung giờ liên hệ.');
  perform private.lead_assert(coalesce(jsonb_typeof(p_input->'documents'),'object')='object','Thông tin giấy tờ không hợp lệ.');
  perform private.lead_assert(not exists (
    select 1 from jsonb_each(coalesce(p_input->'documents','{}')) d
    where d.key not in ('cccd','license','registration') or jsonb_typeof(d.value)<>'boolean'
  ),'Thông tin giấy tờ không hợp lệ.');
  profile_value:=jsonb_build_object('district',btrim(coalesce(p_input->>'district','')),
    'hasVehicle',coalesce(p_input->>'hasVehicle',''),'callTime',coalesce(p_input->>'callTime','any'),
    'documents',coalesce(p_input->'documents','{}'::jsonb));
  intake:=jsonb_build_object('name',btrim(p_input->>'name'),'phone',phone_value,'city',btrim(p_input->>'city'),
    'vehicle',p_input->>'vehicle','profile',profile_value,'note',btrim(coalesce(p_input->>'note','')));
  fingerprint_value:=md5(intake::text);
  -- Serialize retries/rate checks; also serialize with staff writes and migration jobs.
  perform pg_advisory_xact_lock(179826221);
  select fingerprint into old_fingerprint from private.lead_public_requests where request_id=p_request_id;
  if found then
    perform private.lead_assert(old_fingerprint=fingerprint_value,'Mã gửi đã được sử dụng. Vui lòng tải lại trang để đăng ký mới.');
    return jsonb_build_object('accepted',true);
  end if;
  perform private.lead_assert((select count(*) from private.lead_public_requests where phone=phone_value and created_at>stamp-interval '1 hour')<3,
    'Số điện thoại này đã gửi nhiều đăng ký gần đây. Vui lòng thử lại sau 1 giờ.');
  perform private.lead_assert((select count(*) from private.lead_public_requests where created_at>stamp-interval '1 hour')<300,
    'Form đang tiếp nhận nhiều đăng ký. Vui lòng thử lại sau.');
  perform private.lead_assert(exists(select 1 from public.lead_sources where id='web' and data->'active'='true'::jsonb),
    'Form đang tạm ngưng tiếp nhận. Vui lòng thử lại sau.');
  select id into lead_value from public.leads where phone=phone_value for update;
  was_new:=not found;
  if was_new then
    lead_value:='LEAD-'||gen_random_uuid();
    insert into public.leads(data) values(intake||jsonb_build_object('id',lead_value,'sourceId','web',
      'status','New','receivedAt',stamp,'updatedAt',stamp,'version',1,'archived',false,'tags','[]'::jsonb));
  end if;
  -- Existing profiles (including archived/closed ones) are never changed by a public caller.
  details:='Tài xế tự đăng ký: '||(intake->>'name')||' · '||(intake->>'city')||
    case when p_input->>'vehicle'='Van' then ' · Xe Van' else ' · Xe máy' end||
    '. Quận/huyện: '||coalesce(nullif(profile_value->>'district',''),'Chưa cung cấp')||
    '. Tình trạng xe: '||case profile_value->>'hasVehicle' when 'yes' then 'Đã có xe' when 'no' then 'Chưa có xe' else 'Chưa cung cấp' end||
    '. Tiện liên hệ: '||case profile_value->>'callTime' when 'morning' then 'Buổi sáng (8–12h)' when 'afternoon' then 'Buổi chiều (13–17h)' when 'evening' then 'Buổi tối (17–20h)' else 'Bất kỳ lúc nào' end||
    '. Giấy tờ đã có: '||coalesce(nullif(concat_ws(', ',
      case when profile_value->'documents'->>'cccd'='true' then 'CCCD' end,
      case when profile_value->'documents'->>'license'='true' then 'Giấy phép lái xe' end,
      case when profile_value->'documents'->>'registration'='true' then 'Đăng ký xe' end),''),'Chưa cung cấp')||
    '. Ghi chú: '||(intake->>'note');
  perform set_config('lead.edit_only','false',true);
  insert into public.lead_receptions(data) values(jsonb_build_object('id','TN-'||gen_random_uuid(),
    'leadId',lead_value,'sourceId','web','at',stamp,'actorId','public-form','note',details,
    'submission',intake,'consentAt',stamp,'consentVersion','driver-intake-v1'));
  insert into public.lead_audit_logs(data,lead_id) values(jsonb_build_object('id','LOG-'||gen_random_uuid(),
    'at',stamp,'actorId','public-form','action','publicIntake','target',lead_value,
    'detail',case when was_new then 'Tài xế tự đăng ký qua form website' else 'Tiếp nhận lại qua form website; giữ nguyên hồ sơ hiện có' end),lead_value);
  insert into public.lead_notifications(data)
    select jsonb_build_object('id','NOT-'||gen_random_uuid(),'recipientId',s.id::text,'at',stamp,
      'leadId',lead_value,'href','/leads/'||lead_value||'/show',
      'title',case when was_new then 'Đăng ký tài xế mới từ form website' else 'Tài xế gửi lại đăng ký qua form website' end)
    from public.sales s join public.lead_user_roles r on r.sales_id=s.id
    where not s.disabled and r.role_code in ('intake','admin');
  insert into private.lead_public_requests(request_id,fingerprint,phone) values(p_request_id,fingerprint_value,phone_value);
  -- Identical responses for new/existing phones; no profile IDs or private data returned.
  return jsonb_build_object('accepted',true);
end; $$;
revoke all on function public.lead_public_intake(jsonb,uuid) from public;
grant execute on function public.lead_public_intake(jsonb,uuid) to anon,authenticated;
