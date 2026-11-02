-- Account administration: atomic profile/access updates and account-only history.
-- Existing accounts, roles, catalogs and business records are preserved.
alter function public.lead_command(jsonb,uuid,integer) set schema private;
alter function private.lead_command(jsonb,uuid,integer) rename to lead_command_pre_admin;
revoke all on function private.lead_command_pre_admin(jsonb,uuid,integer) from public,anon,authenticated;

create function public.lead_command(p_command jsonb,p_request_id uuid,p_expected_version integer default null) returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare a jsonb; target text:=p_command->>'id'; prior jsonb; current_member jsonb; result jsonb;
begin
  if p_command->>'type' is distinct from 'member' then
    return private.lead_command_pre_admin(p_command,p_request_id,p_expected_version);
  end if;
  a:=private.lead_actor();
  perform private.lead_assert(a->>'role'='admin' and target<>a->>'id','Chỉ quản trị được đổi tài khoản khác.');
  perform private.lead_assert(p_request_id is not null,'Yêu cầu không hợp lệ.');
  perform pg_advisory_xact_lock(179826221);
  select payload into prior from private.lead_requests where actor_id=(a->>'id')::bigint and request_id=p_request_id;
  if found then
    perform private.lead_assert(prior=p_command,'Mã yêu cầu đã dùng cho nội dung khác.');
    return '{"ok":true}';
  end if;
  select jsonb_build_object('name',btrim(s.first_name||' '||s.last_name),'role',coalesce(r.role_code,'viewer'),'active',not s.disabled,'teamId',coalesce(r.team_id,'default'))
  into current_member from public.sales s left join public.lead_user_roles r on r.sales_id=s.id where s.id::text=target;
  perform private.lead_assert(current_member is not null,'Không tìm thấy tài khoản.');
  if p_command ? 'expected' then
    perform private.lead_assert(current_member=p_command->'expected','Tài khoản đã thay đổi. Đóng form và tải lại danh sách trước khi sửa.');
  end if;
  perform private.lead_assert(p_command->>'role' in ('admin','intake','leader','telesale'),'Chọn một trong bốn vai trò hiện hành.');
  perform private.lead_assert(jsonb_typeof(p_command->'active')='boolean','Trạng thái tài khoản không hợp lệ.');
  if p_command ? 'name' then
    perform private.lead_assert(length(btrim(p_command->>'name')) between 2 and 120,'Họ tên từ 2–120 ký tự.');
  end if;
  if p_command->>'role' in ('leader','telesale') then
    perform private.lead_assert(exists(select 1 from public.lead_teams where id=coalesce(p_command->>'teamId',current_member->>'teamId')),'Chọn nhóm làm việc hợp lệ.');
  end if;
  if current_member->>'role'='admin' and (current_member->>'active')::boolean and
    (p_command->>'role'<>'admin' or not (p_command->>'active')::boolean) then
    perform private.lead_assert((select count(*) from public.sales s join public.lead_user_roles r on r.sales_id=s.id where not s.disabled and r.role_code='admin')>1,'Không thể vô hiệu hóa quản trị viên hoạt động cuối cùng.');
  end if;
  -- Delegate access rules (including transfer-before-disable) and the audit event;
  -- an error rolls back profile and access together in this RPC transaction.
  result:=private.lead_command_pre_admin(p_command,p_request_id,p_expected_version);
  if p_command ? 'name' then
    update public.sales set first_name=btrim(p_command->>'name'),last_name='' where id::text=target;
  end if;
  return result;
end $$;
revoke all on function public.lead_command(jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.lead_command(jsonb,uuid,integer) to authenticated;

create or replace function public.lead_snapshot() returns jsonb
language plpgsql stable security invoker set search_path=public,private as $$
declare a jsonb:=private.lead_actor();
begin
  if a->>'role'='admin' then
    return jsonb_build_object('version',1,'actor',a,'serverTime',now(),
      'members',public.lead_people(),
      'teams',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.lead_teams t),
      'leads','[]'::jsonb,'assignments','[]'::jsonb,'activities','[]'::jsonb,'appointments','[]'::jsonb,
      'sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.lead_sources s),
      'receptions','[]'::jsonb,'reviews','[]'::jsonb,'notices','[]'::jsonb,
      'audit',(select coalesce(jsonb_agg(data order by data->>'at' desc),'[]') from public.lead_audit_logs
        where lead_id is null and data->>'action' in ('member','memberProfile')));
  end if;
  return private.lead_snapshot_pre_review();
end $$;
revoke all on function public.lead_snapshot() from public,anon,authenticated;
grant execute on function public.lead_snapshot() to authenticated;

-- The Admin UI has no operational report scope; enforce it at the API as well.
alter function public.lead_report(jsonb) set schema private;
alter function private.lead_report(jsonb) rename to lead_report_pre_admin;
revoke all on function private.lead_report_pre_admin(jsonb) from public,anon,authenticated;
create function public.lead_report(p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
begin
  perform private.lead_assert(private.lead_actor()->>'role'<>'admin','Quản trị viên chỉ quản lý tài khoản và phân quyền.');
  return private.lead_report_pre_admin(p_filters);
end $$;
revoke all on function public.lead_report(jsonb) from public,anon,authenticated;
grant execute on function public.lead_report(jsonb) to authenticated;
