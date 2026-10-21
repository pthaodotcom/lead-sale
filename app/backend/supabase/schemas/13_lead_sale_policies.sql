alter table public.sales enable row level security;
alter table public.lead_roles enable row level security;
alter table public.lead_teams enable row level security;
alter table public.lead_user_roles enable row level security;
alter table public.lead_statuses enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;
alter table public.lead_assignments enable row level security;
alter table public.lead_care_rounds enable row level security;
alter table public.lead_activities enable row level security;
alter table public.lead_appointments enable row level security;
alter table public.lead_receptions enable row level security;
alter table public.lead_closure_reviews enable row level security;
alter table public.lead_notifications enable row level security;
alter table public.lead_attachments enable row level security;
alter table public.lead_audit_logs enable row level security;

revoke all on public.sales,public.lead_user_roles,public.lead_roles,public.lead_teams,public.lead_statuses,public.lead_sources,public.leads,public.lead_assignments,public.lead_care_rounds,public.lead_activities,public.lead_appointments,public.lead_receptions,public.lead_closure_reviews,public.lead_notifications,public.lead_attachments,public.lead_audit_logs from anon,authenticated;
grant select on public.lead_sources,public.leads,public.lead_assignments,public.lead_activities,public.lead_appointments,public.lead_receptions,public.lead_closure_reviews,public.lead_notifications,public.lead_audit_logs,public.lead_roles,public.lead_teams,public.lead_statuses,public.lead_attachments to authenticated;
grant usage on schema private to authenticated;

create policy lead_sources_read on public.lead_sources for select to authenticated using(private.lead_actor(false) is not null);
create policy lead_roles_read on public.lead_roles for select to authenticated using(private.lead_actor(false) is not null);
create policy lead_teams_read on public.lead_teams for select to authenticated using(private.lead_actor(false) is not null);
create policy lead_statuses_read on public.lead_statuses for select to authenticated using(private.lead_actor(false) is not null);
create policy leads_read on public.leads for select to authenticated using(private.lead_can_read(id));
create policy lead_assignments_read on public.lead_assignments for select to authenticated using(private.lead_can_ticket(id));
create policy lead_activities_read on public.lead_activities for select to authenticated using(private.lead_can_ticket(assignment_id));
create policy lead_appointments_read on public.lead_appointments for select to authenticated using(private.lead_can_ticket(assignment_id));
create policy lead_receptions_read on public.lead_receptions for select to authenticated using((private.lead_actor(false)->>'role') in ('admin','intake') or ((private.lead_actor(false)->>'role')='leader' and private.lead_can_read(lead_id)));
create policy lead_reviews_read on public.lead_closure_reviews for select to authenticated using((private.lead_actor(false)->>'role') in ('admin','intake') or ((private.lead_actor(false)->>'role')='leader' and private.lead_can_ticket(assignment_id)));
create policy lead_notifications_read on public.lead_notifications for select to authenticated using(recipient_id=(private.lead_actor(false)->>'id')::bigint);
create policy lead_attachments_read on public.lead_attachments for select to authenticated using(exists(select 1 from public.lead_activities a where a.id=activity_id and private.lead_can_ticket(a.assignment_id)));
create policy lead_audit_read on public.lead_audit_logs for select to authenticated using((private.lead_actor(false)->>'role')='admin' or ((private.lead_actor(false)->>'role')='intake' and lead_id is not null));

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.lead_actor(boolean),private.lead_can_read(text),private.lead_can_ticket(text) to authenticated;
revoke all on function public.lead_command(jsonb,uuid,integer),public.lead_report(jsonb),public.lead_snapshot(),public.lead_people() from public,anon;
grant execute on function public.lead_command(jsonb,uuid,integer),public.lead_report(jsonb),public.lead_snapshot(),public.lead_people() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('lead-evidence','lead-evidence',false,20971520,array['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg','audio/webm','image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create policy lead_evidence_upload on storage.objects for insert to authenticated with check(
  bucket_id='lead-evidence' and split_part(name,'/',1)=private.lead_actor(false)->>'id'
  and private.lead_can_ticket(split_part(name,'/',2))
  and exists(select 1 from public.lead_assignments t where t.id=split_part(name,'/',2) and t.status<>'Closed' and t.expires_at>now() and (t.assignee_id=(private.lead_actor(false)->>'id')::bigint or private.lead_actor(false)->>'role'='admin'))
);
create policy lead_evidence_read on storage.objects for select to authenticated using(
  bucket_id='lead-evidence' and exists(select 1 from public.lead_attachments a where a.id=name and private.lead_can_ticket(split_part(name,'/',2)))
);
