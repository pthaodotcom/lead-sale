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
