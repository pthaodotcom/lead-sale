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
    'byResultSource',jsonb_build_array(
      jsonb_build_object('id','simulator','registered',count(*) filter(where registered and data->>'activatedSource'='simulator'),'onboarded',count(*) filter(where onboarded and data->>'onboardedSource'='simulator')),
      jsonb_build_object('id','manual','registered',count(*) filter(where registered and data->>'activatedSource' in ('manual','manual_correction')),'onboarded',count(*) filter(where onboarded and data->>'onboardedSource' in ('manual','manual_correction'))),
      jsonb_build_object('id','unverified','registered',count(*) filter(where registered and coalesce(data->>'activatedSource','') not in ('simulator','manual','manual_correction')),'onboarded',count(*) filter(where onboarded and coalesce(data->>'onboardedSource','') not in ('simulator','manual','manual_correction')))
    ),
    'bySource',coalesce((select jsonb_agg(x) from(select source_id as id,count(*) as total,count(*) filter(where registered) as registered from selected group by source_id) x),'[]'::jsonb),
    'byStatus',coalesce((select jsonb_object_agg(status,n) from(select status,count(*) as n from selected group by status) x),'{}'::jsonb),
    'byMember',coalesce((select jsonb_agg(x) from(select coalesce(owner->>'assigneeId','unassigned') as id,count(*) as total,count(*) filter(where registered) as registered from selected group by coalesce(owner->>'assigneeId','unassigned')) x),'[]'::jsonb)
  ) into result from selected;
  return result;
end; $$;

