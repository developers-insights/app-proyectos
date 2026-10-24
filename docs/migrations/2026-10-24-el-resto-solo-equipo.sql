-- El resto de las tablas de la app con la misma regla que 2026-10-24-solo-el-equipo.sql.
--
-- Antes todas tenían políticas `true` para cualquier `authenticated` de la base compartida
-- (MyJobs, UGC…), y app_secrets dejaba leer el token del generador de carruseles a
-- cualquier cuenta. Ahora:
-- * Sólo equipo (is_team()): app_state, calls, sops_*, assistant_chats, editor_projects,
--   videos, mvps, fathom_calls y wa_* (lo escribe el bot con service_role).
-- * Colaborador: tareas de sus proyectos (o sin proyecto y asignadas a él), actividad
--   propia, wa_groups de sus proyectos, publicar sus planes y marcar leídas sus notas.
--   Es lo que usan sus tres secciones (Proyectos, Tareas, Planificador).
-- * Público (sin cambios en lo que lee el link del plan): published_plans y
--   plan_acceptances se leen sin sesión; plan_notes se lee y se crea sin sesión. Lo que
--   se saca son las escrituras de anon que no usaba nadie.
-- * El token del carrusel sale por carousel_token() (definer, sólo equipo). La lectura
--   directa de app_secrets queda para el equipo hasta que el front nuevo esté en
--   producción; después corre 2026-10-24-app-secrets-sin-sesion.sql.

create or replace function public.pm_mis_ids()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(t.id), '{}'::text[])
  from public.team_members t
  where t.deleted_at is null
    and t.data->>'status' = 'approved'
    and lower(t.data->>'email') = public.pm_mi_email()
$$;

create or replace function public.pm_slugs(p_editar boolean)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct p.data->>'slug') filter (where coalesce(p.data->>'slug', '') <> ''), '{}'::text[])
  from public.plans p
  where p.deleted_at is null
    and p.id = any(public.pm_planes(p_editar))
$$;

revoke all on function public.pm_mis_ids() from public, anon;
revoke all on function public.pm_slugs(boolean) from public, anon;
grant execute on function public.pm_mis_ids() to authenticated;
grant execute on function public.pm_slugs(boolean) to authenticated;

create or replace function public.carousel_token()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_team() then
    raise exception 'Sólo el equipo usa el generador de carruseles.' using errcode = '42501';
  end if;
  return (select s.value from public.app_secrets s where s.key = 'carousel_generator_token');
end;
$$;
revoke all on function public.carousel_token() from public, anon;
grant execute on function public.carousel_token() to authenticated;

-- El front ya llamaba a esta RPC para borrar una nota del link público y no existía:
-- el borrado fallaba en silencio.
create or replace function public.delete_plan_note(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_team() or exists (
    select 1 from public.plan_notes n where n.id = p_id and n.slug = any(public.pm_slugs(true))
  )) then
    raise exception 'Sólo el equipo borra notas.' using errcode = '42501';
  end if;
  update public.plan_notes set deleted_at = now() where id = p_id and deleted_at is null;
  return found;
end;
$$;
revoke all on function public.delete_plan_note(uuid) from public, anon;
grant execute on function public.delete_plan_note(uuid) to authenticated;

-- Tablas sólo del equipo. Se borran todas las políticas viejas por nombre.
drop policy if exists "auth insert" on public.app_state;
drop policy if exists "auth read" on public.app_state;
drop policy if exists "auth update" on public.app_state;
drop policy if exists calls_auth_read on public.calls;
drop policy if exists calls_auth_insert on public.calls;
drop policy if exists calls_auth_update on public.calls;
drop policy if exists sops_categories_auth_read on public.sops_categories;
drop policy if exists sops_categories_auth_insert on public.sops_categories;
drop policy if exists sops_categories_auth_update on public.sops_categories;
drop policy if exists sops_processes_auth_read on public.sops_processes;
drop policy if exists sops_processes_auth_insert on public.sops_processes;
drop policy if exists sops_processes_auth_update on public.sops_processes;
drop policy if exists assistant_chats_auth_read on public.assistant_chats;
drop policy if exists assistant_chats_auth_insert on public.assistant_chats;
drop policy if exists assistant_chats_auth_update on public.assistant_chats;
drop policy if exists editor_projects_auth_read on public.editor_projects;
drop policy if exists editor_projects_auth_insert on public.editor_projects;
drop policy if exists editor_projects_auth_update on public.editor_projects;
drop policy if exists editor_projects_auth_delete on public.editor_projects;
drop policy if exists videos_auth_read on public.videos;
drop policy if exists videos_auth_insert on public.videos;
drop policy if exists videos_auth_update on public.videos;
drop policy if exists mvps_auth_read on public.mvps;
drop policy if exists mvps_auth_insert on public.mvps;
drop policy if exists mvps_auth_update on public.mvps;
drop policy if exists "auth read calls" on public.fathom_calls;
drop policy if exists "auth update calls" on public.fathom_calls;

do $$
declare
  t text;
begin
  foreach t in array array['app_state', 'calls', 'sops_categories', 'sops_processes', 'assistant_chats', 'editor_projects', 'videos', 'mvps'] loop
    execute format('drop policy if exists %I on public.%I', t || '_equipo_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_equipo_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_equipo_update', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_team()))', t || '_equipo_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_team()))', t || '_equipo_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_team())) with check ((select public.is_team()))', t || '_equipo_update', t);
  end loop;
end $$;

drop policy if exists editor_projects_equipo_delete on public.editor_projects;
create policy editor_projects_equipo_delete on public.editor_projects for delete to authenticated
  using ((select public.is_team()));

drop policy if exists fathom_calls_equipo_select on public.fathom_calls;
drop policy if exists fathom_calls_equipo_update on public.fathom_calls;
create policy fathom_calls_equipo_select on public.fathom_calls for select to authenticated using ((select public.is_team()));
create policy fathom_calls_equipo_update on public.fathom_calls for update to authenticated
  using ((select public.is_team())) with check ((select public.is_team()));

drop policy if exists app_secrets_auth_read on public.app_secrets;
drop policy if exists app_secrets_equipo_select on public.app_secrets;
create policy app_secrets_equipo_select on public.app_secrets for select to authenticated using ((select public.is_team()));

-- WhatsApp: el bot escribe con service_role; la pantalla Bot es del equipo. wa_groups lo
-- lee también la lista de Proyectos (último mensaje del equipo), así que el colaborador
-- ve los grupos de sus proyectos.
drop policy if exists wa_alerts_select_auth on public.wa_alerts;
drop policy if exists wa_finanzas_preguntas_select_auth on public.wa_finanzas_preguntas;
drop policy if exists wa_messages_select_auth on public.wa_messages;
drop policy if exists wa_status_select_auth on public.wa_status;
drop policy if exists wa_team_numbers_select_auth on public.wa_team_numbers;
drop policy if exists wa_groups_select_auth on public.wa_groups;
drop policy if exists wa_groups_update_auth on public.wa_groups;

do $$
declare
  t text;
begin
  foreach t in array array['wa_alerts', 'wa_finanzas_preguntas', 'wa_messages', 'wa_status', 'wa_team_numbers'] loop
    execute format('drop policy if exists %I on public.%I', t || '_equipo_select', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_team()))', t || '_equipo_select', t);
  end loop;
end $$;

drop policy if exists wa_groups_equipo_select on public.wa_groups;
drop policy if exists wa_groups_equipo_update on public.wa_groups;
create policy wa_groups_equipo_select on public.wa_groups for select to authenticated
  using ((select public.is_team()) or project_id = any((select public.pm_proyectos(true))::text[]));
create policy wa_groups_equipo_update on public.wa_groups for update to authenticated
  using ((select public.is_team())) with check ((select public.is_team()));

-- Tareas: un colaborador crea tareas con projectId vacío cuando tiene más de un proyecto
-- (TasksView) y asignadas a él; esas también son suyas.
drop policy if exists tasks_auth_read on public.tasks;
drop policy if exists tasks_auth_insert on public.tasks;
drop policy if exists tasks_auth_update on public.tasks;
drop policy if exists tasks_equipo_select on public.tasks;
drop policy if exists tasks_equipo_insert on public.tasks;
drop policy if exists tasks_equipo_update on public.tasks;
create policy tasks_equipo_select on public.tasks for select to authenticated
  using (
    (select public.is_team())
    or ((select public.pm_es_colaborador()) and (
      data->>'projectId' = any((select public.pm_proyectos(true))::text[])
      or (coalesce(data->>'projectId', '') = '' and data->>'assigneeId' = any((select public.pm_mis_ids())::text[]))
    ))
  );
create policy tasks_equipo_insert on public.tasks for insert to authenticated
  with check (
    (select public.is_team())
    or ((select public.pm_es_colaborador()) and (
      data->>'projectId' = any((select public.pm_proyectos(true))::text[])
      or (coalesce(data->>'projectId', '') = '' and data->>'assigneeId' = any((select public.pm_mis_ids())::text[]))
    ))
  );
create policy tasks_equipo_update on public.tasks for update to authenticated
  using (
    (select public.is_team())
    or ((select public.pm_es_colaborador()) and (
      data->>'projectId' = any((select public.pm_proyectos(true))::text[])
      or (coalesce(data->>'projectId', '') = '' and data->>'assigneeId' = any((select public.pm_mis_ids())::text[]))
    ))
  )
  with check (
    (select public.is_team())
    or ((select public.pm_es_colaborador()) and (
      data->>'projectId' = any((select public.pm_proyectos(true))::text[])
      or (coalesce(data->>'projectId', '') = '' and data->>'assigneeId' = any((select public.pm_mis_ids())::text[]))
    ))
  );

-- Actividad: no tiene projectId; el colaborador registra y ve sólo la suya (actorId).
drop policy if exists activity_auth_read on public.activity;
drop policy if exists activity_auth_insert on public.activity;
drop policy if exists activity_auth_update on public.activity;
drop policy if exists activity_equipo_select on public.activity;
drop policy if exists activity_equipo_insert on public.activity;
drop policy if exists activity_equipo_update on public.activity;
create policy activity_equipo_select on public.activity for select to authenticated
  using ((select public.is_team()) or data->>'actorId' = any((select public.pm_mis_ids())::text[]));
create policy activity_equipo_insert on public.activity for insert to authenticated
  with check (
    (select public.is_team())
    or ((select public.pm_es_colaborador()) and data->>'actorId' = any((select public.pm_mis_ids())::text[]))
  );
create policy activity_equipo_update on public.activity for update to authenticated
  using ((select public.is_team())) with check ((select public.is_team()));

-- Planes publicados: el link público los lee sin sesión (pp_public_read queda). Publicar
-- es del equipo o del colaborador sobre sus planes (data es el plan: data->>'id').
drop policy if exists pp_auth_insert on public.published_plans;
drop policy if exists pp_auth_update on public.published_plans;
drop policy if exists pp_auth_delete on public.published_plans;
drop policy if exists published_plans_equipo_insert on public.published_plans;
drop policy if exists published_plans_equipo_update on public.published_plans;
drop policy if exists published_plans_equipo_delete on public.published_plans;
create policy published_plans_equipo_insert on public.published_plans for insert to authenticated
  with check ((select public.is_team()) or data->>'id' = any((select public.pm_planes(true))::text[]));
create policy published_plans_equipo_update on public.published_plans for update to authenticated
  using ((select public.is_team()) or data->>'id' = any((select public.pm_planes(true))::text[]))
  with check ((select public.is_team()) or data->>'id' = any((select public.pm_planes(true))::text[]));
create policy published_plans_equipo_delete on public.published_plans for delete to authenticated
  using ((select public.is_team()) or data->>'id' = any((select public.pm_planes(true))::text[]));

-- Notas del link público: leer y crear sigue abierto (plan_notes_public_*). Marcar leída
-- es del equipo o del colaborador dueño del plan.
drop policy if exists plan_notes_auth_update on public.plan_notes;
drop policy if exists plan_notes_equipo_update on public.plan_notes;
create policy plan_notes_equipo_update on public.plan_notes for update to authenticated
  using ((select public.is_team()) or slug = any((select public.pm_slugs(true))::text[]))
  with check ((select public.is_team()) or slug = any((select public.pm_slugs(true))::text[]));

revoke all on public.app_state, public.calls, public.sops_categories, public.sops_processes,
  public.assistant_chats, public.editor_projects, public.videos, public.mvps, public.fathom_calls,
  public.tasks, public.activity, public.wa_alerts, public.wa_finanzas_preguntas, public.wa_groups,
  public.wa_messages, public.wa_status, public.wa_team_numbers
  from anon;
revoke insert, update, delete on public.published_plans, public.plan_acceptances from anon;
revoke update, delete on public.plan_notes from anon;
revoke truncate, references, trigger on public.app_state, public.app_secrets, public.calls,
  public.sops_categories, public.sops_processes, public.assistant_chats, public.editor_projects,
  public.videos, public.mvps, public.fathom_calls, public.tasks, public.activity,
  public.wa_alerts, public.wa_finanzas_preguntas, public.wa_groups, public.wa_messages,
  public.wa_status, public.wa_team_numbers, public.published_plans, public.plan_acceptances,
  public.plan_notes
  from anon, authenticated;
