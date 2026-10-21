-- Supabase provides pg_cron. Other PostgreSQL environments may not: the job
-- function remains callable by the trusted scheduler/service_role in that case.
do $$
begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule('lead-sale-every-minute','* * * * *','select public.lead_run_jobs()');
  end if;
end;
$$;
