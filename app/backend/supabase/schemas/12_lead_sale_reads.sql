create or replace function public.lead_report(p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
declare actor jsonb:=private.lead_actor(); result jsonb;
begin
  perform private.lead_assert(coalesce(p_filters->>'from','')='' or coalesce(p_filters->>'to','')='' or (p_filters->>'from')::date<=(p_filters->>'to')::date,'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
  with owners as (
    select distinct on(lead_id) lead_id,data from public.lead_assignments order by lead_id,(data->>'createdAt')::timestamptz desc,sequence desc
  ), selected as (
    select l.*,o.data as owner,
      (l.data ? 'activatedAt' or l.status in ('Activated','Onboarded')) as registered,
      (l.data ? 'onboardedAt' or l.status='Onboarded') as onboarded,
      exists(select 1 from public.lead_appointments ap join public.lead_assignments t on t.id=ap.assignment_id where ap.lead_id=l.id and ap.status='scheduled' and ap.due_at<now() and t.status in ('New','Open') and t.expires_at>now()) as overdue
    from public.leads l left join owners o on o.lead_id=l.id
    where not l.archived and (l.data->>'receivedAt')::timestamptz<=now()
      and (actor->>'role' in ('admin','intake','viewer') or (actor->>'role'='leader' and o.data->>'teamId'=actor->>'teamId') or (actor->>'role'='telesale' and o.data->>'assigneeId'=actor->>'id'))
      and (coalesce(p_filters->>'from','')='' or (l.data->>'receivedAt')::timestamptz >= ((p_filters->>'from')::date::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (coalesce(p_filters->>'to','')='' or (l.data->>'receivedAt')::timestamptz < (((p_filters->>'to')::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
      and (coalesce(p_filters->>'source','')='' or l.source_id=p_filters->>'source')
      and (coalesce(p_filters->>'status','')='' or l.status=p_filters->>'status')
      and (coalesce(p_filters->>'member','')='' or coalesce(o.data->>'assigneeId','unassigned')=p_filters->>'member')
  ) select jsonb_build_object(
    'total',count(*),'registered',count(*) filter(where registered),'onboarded',count(*) filter(where onboarded),'overdue',count(*) filter(where overdue),
    'newToday',count(*) filter(where ((data->>'receivedAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date=(now() at time zone 'Asia/Ho_Chi_Minh')::date),
    'bySource',coalesce((select jsonb_agg(x) from(select source_id as id,count(*) as total,count(*) filter(where registered) as registered from selected group by source_id) x),'[]'::jsonb),
    'byStatus',coalesce((select jsonb_object_agg(status,n) from(select status,count(*) as n from selected group by status) x),'{}'::jsonb),
    'byMember',coalesce((select jsonb_agg(x) from(select coalesce(owner->>'assigneeId','unassigned') as id,count(*) as total,count(*) filter(where registered) as registered from selected group by coalesce(owner->>'assigneeId','unassigned')) x),'[]'::jsonb)
  ) into result from selected;
  return result;
end; $$;

create or replace function public.lead_people() returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
declare actor jsonb:=private.lead_actor(); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id::text,'name',btrim(s.first_name||' '||s.last_name),'role',coalesce(r.role_code,'viewer'),'active',not s.disabled,'teamId',coalesce(r.team_id,'default'))||case when actor->>'role'='admin' then jsonb_build_object('email',s.email) else '{}'::jsonb end),'[]'::jsonb)
  into result from public.sales s left join public.lead_user_roles r on r.sales_id=s.id where actor->>'role'='admin' or r.sales_id is not null;
  return result;
end; $$;

-- SECURITY INVOKER: every resource read below is still subject to table RLS.
-- A scoped snapshot keeps the existing UI working without exposing full data to
-- other roles. UI/server pagination can be split out if volume requires it.
create or replace function public.lead_snapshot() returns jsonb
language plpgsql stable security invoker set search_path=public,private as $$
declare actor jsonb:=private.lead_actor();
begin
  return jsonb_build_object('version',1,'actor',actor,'serverTime',now(),
    'leads',coalesce((select jsonb_agg(data order by data->>'receivedAt' desc) from public.leads),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(data||jsonb_build_object('sequence',sequence) order by (data->>'createdAt')::timestamptz desc,sequence desc) from public.lead_assignments),'[]'::jsonb),
    'activities',coalesce((select jsonb_agg(data order by data->>'at' desc) from public.lead_activities),'[]'::jsonb),
    'appointments',coalesce((select jsonb_agg(data order by due_at) from public.lead_appointments),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(data order by name) from public.lead_sources),'[]'::jsonb),
    'members',public.lead_people(),
    'teams',coalesce((select jsonb_agg(to_jsonb(x)) from public.lead_teams x),'[]'::jsonb),
    'statusCatalog',coalesce((select jsonb_agg(to_jsonb(x)) from public.lead_statuses x),'[]'::jsonb),
    'receptions',coalesce((select jsonb_agg(data order by data->>'at' desc) from public.lead_receptions),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(data order by data->>'at' desc) from public.lead_closure_reviews),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(data order by data->>'at' desc) from public.lead_notifications),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(data order by data->>'at' desc) from public.lead_audit_logs),'[]'::jsonb),
    'report',public.lead_report()
  );
end; $$;
