create or replace function public.lead_run_jobs() returns jsonb
language plpgsql security definer set search_path=public,private as $$
declare expired_ticket record; closed_count integer:=0; local_now timestamp:=now() at time zone 'Asia/Ho_Chi_Minh';
begin
  for expired_ticket in select id from public.lead_assignments where status<>'Closed' and expires_at<=now() for update skip locked loop
    perform private.lead_close(expired_ticket.id,'Hết thời hạn phân công 14 ngày'); closed_count:=closed_count+1;
  end loop;
  insert into public.lead_notifications(data)
  select jsonb_build_object('id','reminder-'||ap.id||'-'||k.kind,'recipientId',t.assignee_id::text,'at',now(),'title',case when k.kind='hour' then 'Có lịch hẹn trong 1 giờ tới.' else 'Đã đến giờ hẹn. Kiểm tra danh sách lịch hẹn.' end)
  from public.lead_appointments ap join public.lead_assignments t on t.id=ap.assignment_id
  cross join (values ('hour'),('due')) k(kind)
  where ap.status='scheduled' and t.status in ('New','Open') and t.expires_at>now()
    and ((k.kind='hour' and ap.due_at>now() and ap.due_at<=now()+interval '1 hour' and coalesce((ap.data->>'createdAt')::timestamptz,ap.due_at-interval '2 hours')<=ap.due_at-interval '1 hour') or (k.kind='due' and ap.due_at<=now()))
  on conflict(id) do nothing;
  if local_now::time>=time '08:00' then
    insert into public.lead_notifications(data)
    select jsonb_build_object('id','digest-'||local_now::date::text||'-'||s.id::text,'recipientId',s.id::text,'at',now(),'title','Kiểm tra hàng đợi bàn giao phiếu Closed hằng ngày.')
    from public.sales s join public.lead_user_roles r on r.sales_id=s.id
    where not s.disabled and r.role_code in ('admin','intake') and exists(select 1 from public.lead_closure_reviews where not (data ? 'reviewedAt') and (data->>'at')::timestamptz < (local_now::date::timestamp at time zone 'Asia/Ho_Chi_Minh'))
    on conflict(id) do nothing;
  end if;
  return jsonb_build_object('closed',closed_count,'at',now());
end; $$;
revoke all on function public.lead_run_jobs() from public,anon,authenticated;
grant execute on function public.lead_run_jobs() to service_role;
