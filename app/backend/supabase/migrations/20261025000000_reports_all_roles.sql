create or replace function public.lead_report(p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=public,private as $$
declare actor jsonb:=private.lead_actor(); result jsonb; extra jsonb;
begin
  perform private.lead_assert(coalesce(p_filters->>'from','')='' or coalesce(p_filters->>'to','')='' or (p_filters->>'from')::date<=(p_filters->>'to')::date,'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
  result:=private.lead_report_pre_review(p_filters);
  with owners as (
    select distinct on(lead_id) lead_id,data from public.lead_assignments order by lead_id,(data->>'createdAt')::timestamptz desc,sequence desc
  ), scoped_leads as (
    select l.*,o.data owner,
      (select data->>'assigneeId' from public.lead_assignments t where t.lead_id=l.id and (t.data->>'createdAt')::timestamptz<=coalesce((l.data->>'onboardedAt')::timestamptz,(l.data->>'activatedAt')::timestamptz,now()) order by (t.data->>'createdAt')::timestamptz desc,t.sequence desc limit 1) credited
    from public.leads l left join owners o on o.lead_id=l.id
    where not l.archived and (actor->>'role' in ('admin','intake','viewer') or (actor->>'role'='leader' and (o.data->>'teamId'=actor->>'teamId' or (o.data is null and l.status='New'))) or (actor->>'role'='telesale' and o.data->>'assigneeId'=actor->>'id'))
      and (coalesce(p_filters->>'city','')='' or case l.data->>'city' when 'HN' then 'Hà Nội' when 'HCM' then 'Hồ Chí Minh' when 'ĐN' then 'Đà Nẵng' else l.data->>'city' end=p_filters->>'city')
      and (coalesce(p_filters->>'source','')='' or l.source_id=p_filters->>'source')
      and (coalesce(p_filters->>'status','')='' or l.status=p_filters->>'status')
  ), ls as (
    select *,exists(select 1 from public.lead_activities a where a.lead_id=scoped_leads.id and a.data->>'decision'='agreed' and not (a.data ? 'voidedAt')) agreed
    from scoped_leads where
      (coalesce(p_filters->>'from','')='' or ((data->>'receivedAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date>=(p_filters->>'from')::date)
      and (coalesce(p_filters->>'to','')='' or ((data->>'receivedAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date<=(p_filters->>'to')::date)
      and (coalesce(p_filters->>'member','')='' or coalesce(credited,'unassigned')=p_filters->>'member')
  ), ts as (
    select t.*,l.data lead_data,
      (select a.data from public.lead_activities a where a.assignment_id=t.id and not (a.data ? 'voidedAt') order by (a.data->>'at')::timestamptz desc,a.id desc limit 1) latest,
      (select x.id from public.lead_assignments x where x.lead_id=t.lead_id and (x.data->>'createdAt')::timestamptz<=coalesce((l.data->>'onboardedAt')::timestamptz,now()) order by (x.data->>'createdAt')::timestamptz desc,x.sequence desc limit 1) onboard_owner
    from public.lead_assignments t join public.leads l on l.id=t.lead_id
    where (actor->>'role' in ('admin','intake','viewer') or (actor->>'role'='leader' and t.team_id=actor->>'teamId') or (actor->>'role'='telesale' and t.assignee_id::text=actor->>'id'))
      and (coalesce(p_filters->>'from','')='' or ((t.data->>'createdAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date>=(p_filters->>'from')::date)
      and (coalesce(p_filters->>'to','')='' or ((t.data->>'createdAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date<=(p_filters->>'to')::date)
      and (coalesce(p_filters->>'member','')='' or t.assignee_id::text=p_filters->>'member')
      and (coalesce(p_filters->>'source','')='' or l.source_id=p_filters->>'source')
      and (coalesce(p_filters->>'city','')='' or l.data->>'city'=p_filters->>'city')
  ), perf as (
    select assignee_id::text id,count(*) total,
      count(*) filter(where status='New') "New",count(*) filter(where status='Open') "Open",count(*) filter(where status='Solved') "Solved",count(*) filter(where status='Closed') "Closed",
      count(*) filter(where latest->>'outcome' in ('called','activated') and latest->>'decision'<>'hungup') called,
      count(*) filter(where latest->>'outcome'='no_answer') no_answer,count(*) filter(where latest->>'outcome'='wrong_phone') wrong_phone,
      count(*) filter(where latest->>'decision'='agreed') agreed,count(*) filter(where latest->>'decision'='declined') declined,count(*) filter(where latest->>'decision'='hungup') hungup,
      count(distinct lead_id) "assignedLeads",count(distinct lead_id) filter(where lead_data ? 'onboardedAt' and ts.id=onboard_owner) converted,
      (select count(*) from public.lead_assignments b where b.assignee_id=ts.assignee_id and b.status<>'Closed') backlog
    from ts group by assignee_id
  ), src as (
    select source_id id,count(*) total,count(*) filter(where status='New') "New",count(*) filter(where status='Activated') "Activated",count(*) filter(where status='Onboarded') "Onboarded",count(*) filter(where status='Closed') "Closed",count(*) filter(where coalesce((data->>'wrongPhone')::boolean,false) or exists(select 1 from public.lead_activities a where a.lead_id=ls.id and a.data->>'outcome'='wrong_phone' and not (a.data ? 'voidedAt'))) "wrongPhone" from ls group by source_id
  ), conv as (
    select credited id,count(*) total,count(*) filter(where agreed) agreed,count(*) filter(where data ? 'activatedAt' or status in ('Activated','Onboarded')) registered,count(*) filter(where data ? 'onboardedAt' or status='Onboarded') onboarded from ls group by credited
  ) select jsonb_build_object(
    'performance',coalesce((select jsonb_agg(to_jsonb(p)) from perf p),'[]'),
    'conversion',coalesce((select jsonb_agg(to_jsonb(c)) from conv c),'[]'),
    'sources',coalesce((select jsonb_agg(to_jsonb(s)) from src s),'[]'),
    'totals',jsonb_build_object('total',(select count(*) from ls),'agreed',(select count(*) from ls where agreed),'registered',(select count(*) from ls where data ? 'activatedAt' or status in ('Activated','Onboarded')),'onboarded',(select count(*) from ls where data ? 'onboardedAt' or status='Onboarded'),
      'unassigned',(select count(*) from scoped_leads l where status='New' and not exists(select 1 from public.lead_assignments t where t.lead_id=l.id and t.status<>'Closed') and not exists(select 1 from public.lead_closure_reviews r where r.lead_id=l.id and r.data->>'reviewedAt' is null)),
      'reviewPending',(select count(distinct r.lead_id) from public.lead_closure_reviews r join scoped_leads l on l.id=r.lead_id where r.data->>'reviewedAt' is null),
      'consulting',(select count(*) from public.lead_assignments t join scoped_leads l on l.id=t.lead_id where t.status='Open' and t.expires_at>now()))
  ) into extra;
  return result||jsonb_build_object('analytics',extra);
end $$;

create or replace function public.lead_snapshot() returns jsonb language plpgsql stable security invoker set search_path=public,private as $$
declare a jsonb:=private.lead_actor(); result jsonb;
begin
  if a->>'role'='admin' then
    return jsonb_build_object('version',1,'actor',a,'serverTime',now(),'members',public.lead_people(),'teams',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.lead_teams t),'leads','[]'::jsonb,'assignments','[]'::jsonb,'activities','[]'::jsonb,'appointments','[]'::jsonb,'sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.lead_sources s),'receptions','[]'::jsonb,'reviews','[]'::jsonb,'notices','[]'::jsonb,'audit','[]'::jsonb);
  end if;
  result:=private.lead_snapshot_pre_review();
  return result;
end $$;

revoke all on function public.lead_report(jsonb),public.lead_snapshot() from public,anon,authenticated;
grant execute on function public.lead_report(jsonb),public.lead_snapshot() to authenticated;
