-- Allow closure of successful Leads while preserving all milestone fields.
-- Patch the delegated command body without replacing the Admin wrapper or grants.
-- Rollback: restore the saved function definition before applying this migration.
do $migration$
declare
  definition text := pg_get_functiondef('private.lead_command_pre_admin(jsonb,uuid,integer)'::regprocedure);
  old_guard text := $old$perform private.lead_assert(l->>'status' not in ('Activated','Onboarded') and not (l ? 'activatedAt') and not (l ? 'onboardedAt'),'Hồ sơ đã thành công; không được xóa mốc bằng rà soát Closed.');$old$;
  new_guard text := $new$perform private.lead_assert(p_command->>'result'='closed' or (l->>'status' not in ('Activated','Onboarded') and not (l ? 'activatedAt') and not (l ? 'onboardedAt')),'Hồ sơ đã thành công; không thể đưa về Đủ điều kiện phân công lại.');$new$;
begin
  if position(new_guard in definition)>0 then return; end if;
  if position(old_guard in definition)=0 then
    raise exception 'Closure guard differs from expected definition; no changes applied';
  end if;
  execute replace(definition,old_guard,new_guard);
end $migration$;
