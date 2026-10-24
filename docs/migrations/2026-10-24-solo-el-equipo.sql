-- Sólo el equipo lee y escribe proyectos, clientes, planes y miembros (auditoría 24/10).
--
-- Antes: team_members, projects, clients y plans tenían políticas `true` para
-- `authenticated`. La base es compartida (MyJobs, UGC, backup de Speed Funnels) y el
-- signup está abierto, así que cualquiera con cuenta podía insertarse en team_members
-- (el default del front lo daba por aprobado con acceso full), leer client_surveys,
-- mandarle notas a los closers vía sf_puente_aviso o torcer el mail de un cliente.
--
-- Ahora:
-- * La identidad sale de auth.users (auth.uid() con email confirmado), no del JWT ni
--   de lo que el usuario escribe. `is_team()` exige una fila viva con status
--   'approved' y access 'full' EXPLÍCITOS: sin campo no hay default que apruebe.
-- * Colaboradores ('collab') leen y editan sólo sus proyectos asignados y el cliente y
--   el plan de esos proyectos; clientes del portal ('project') sólo los leen.
-- * Quien no es del equipo sólo puede crear SU fila pendiente (lo que hace el alta del
--   front) y tocar su fila sin cambiar status, access, proyectos asignados, email ni
--   deleted_at (lo frena team_members_guard).
-- * sf_puente_aviso manda como mucho un aviso por proyecto cada 30 s; lo que cae en esa
--   ventana queda marcado y sf_puente_vaciar lo junta en un solo envío por minuto.
-- Las edge functions usan service_role y no pasan por nada de esto.

-- Las dos filas vivas sin status/access (u5 Juan, f9lvnlr3 Agustín) se veían aprobadas
-- por el default del front; quedan explícitas antes de que is_team() exija el campo.
update public.team_members
   set data = data
     || case when data->>'status' is null then '{"status":"approved"}'::jsonb else '{}'::jsonb end
     || case when data->>'access' is null then '{"access":"full"}'::jsonb else '{}'::jsonb end
 where deleted_at is null
   and (data->>'status' is null or data->>'access' is null);

create or replace function public.pm_mi_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = auth.uid()
    and u.email is not null
    and u.email_confirmed_at is not null
    and coalesce(u.is_anonymous, false) = false
$$;

create or replace function public.is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members t
    where t.deleted_at is null
      and t.data->>'status' = 'approved'
      and t.data->>'access' = 'full'
      and lower(t.data->>'email') = public.pm_mi_email()
  )
$$;

-- Espejo de collabProjectIds() de src/lib/visibility.js: el array manda y, vacío o
-- ausente, cae al assignedProjectId viejo.
create or replace function public.pm_ids_asignados(d jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(d->'assignedProjectIds') = 'array'
     and jsonb_array_length(case when jsonb_typeof(d->'assignedProjectIds') = 'array'
                                 then d->'assignedProjectIds' else '[]'::jsonb end) > 0
      then array(select jsonb_array_elements_text(d->'assignedProjectIds'))
    when coalesce(d->>'assignedProjectId', '') <> ''
      then array[d->>'assignedProjectId']
    else '{}'::text[]
  end
$$;

create or replace function public.pm_es_externo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members t
    where t.deleted_at is null
      and t.data->>'status' = 'approved'
      and t.data->>'access' in ('collab', 'project')
      and lower(t.data->>'email') = public.pm_mi_email()
  )
$$;

create or replace function public.pm_es_colaborador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members t
    where t.deleted_at is null
      and t.data->>'status' = 'approved'
      and t.data->>'access' = 'collab'
      and lower(t.data->>'email') = public.pm_mi_email()
  )
$$;

-- p_editar: sólo colaboradores. Sin editar: también el proyecto del portal ('project'),
-- que MemberPortal lee de assignedProjectId (nunca del array).
create or replace function public.pm_proyectos(p_editar boolean)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct x.pid) filter (where x.pid is not null and x.pid <> ''), '{}'::text[])
  from public.team_members t
  cross join lateral unnest(
    case
      when t.data->>'access' = 'collab' then public.pm_ids_asignados(t.data)
      when t.data->>'access' = 'project' and not p_editar then array[t.data->>'assignedProjectId']
      else '{}'::text[]
    end
  ) as x(pid)
  where t.deleted_at is null
    and t.data->>'status' = 'approved'
    and lower(t.data->>'email') = public.pm_mi_email()
$$;

create or replace function public.pm_clientes(p_editar boolean)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct p.data->>'clientId') filter (where coalesce(p.data->>'clientId', '') <> ''), '{}'::text[])
  from public.projects p
  where p.deleted_at is null
    and p.id = any(public.pm_proyectos(p_editar))
$$;

create or replace function public.pm_planes(p_editar boolean)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct p.data->>'planId') filter (where coalesce(p.data->>'planId', '') <> ''), '{}'::text[])
  from public.projects p
  where p.deleted_at is null
    and p.id = any(public.pm_proyectos(p_editar))
$$;

revoke all on function public.pm_mi_email() from public, anon;
revoke all on function public.is_team() from public, anon;
revoke all on function public.pm_ids_asignados(jsonb) from public, anon;
revoke all on function public.pm_es_externo() from public, anon;
revoke all on function public.pm_es_colaborador() from public, anon;
revoke all on function public.pm_proyectos(boolean) from public, anon;
revoke all on function public.pm_clientes(boolean) from public, anon;
revoke all on function public.pm_planes(boolean) from public, anon;
grant execute on function public.pm_mi_email() to authenticated;
grant execute on function public.is_team() to authenticated;
grant execute on function public.pm_ids_asignados(jsonb) to authenticated;
grant execute on function public.pm_es_externo() to authenticated;
grant execute on function public.pm_es_colaborador() to authenticated;
grant execute on function public.pm_proyectos(boolean) to authenticated;
grant execute on function public.pm_clientes(boolean) to authenticated;
grant execute on function public.pm_planes(boolean) to authenticated;

-- La encuesta usa la misma regla. Antes dejaba pasar a los clientes del portal
-- (access 'project') y a cualquier fila sin status.
create or replace function public.survey_is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_team()
$$;
revoke all on function public.survey_is_team() from public, anon;
grant execute on function public.survey_is_team() to authenticated;

-- Invoker a propósito: current_user es 'authenticated' sólo en pedidos de PostgREST con
-- sesión; service_role (edge functions) y postgres (migraciones) pasan derecho.
create or replace function public.team_members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  k text;
begin
  if current_user <> 'authenticated' or public.is_team() then
    return new;
  end if;
  if new.id is distinct from old.id or new.deleted_at is distinct from old.deleted_at then
    raise exception 'Sólo el equipo puede dar de alta o de baja un acceso.' using errcode = '42501';
  end if;
  foreach k in array array['status', 'access', 'assignedProjectId', 'assignedProjectIds', 'email'] loop
    if new.data->k is distinct from old.data->k then
      raise exception 'Sólo el equipo puede cambiar %.', k using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.team_members_guard() from public, anon, authenticated;

drop trigger if exists team_members_guard on public.team_members;
create trigger team_members_guard before update on public.team_members
  for each row execute function public.team_members_guard();

drop policy if exists team_members_auth_read on public.team_members;
drop policy if exists team_members_auth_insert on public.team_members;
drop policy if exists team_members_auth_update on public.team_members;
drop policy if exists team_members_equipo_select on public.team_members;
drop policy if exists team_members_equipo_insert on public.team_members;
drop policy if exists team_members_equipo_update on public.team_members;

-- La propia fila (también con tombstone) la ve siempre: el front la necesita para la
-- pantalla de "pendiente" y para detectar que le dieron de baja.
create policy team_members_equipo_select on public.team_members for select to authenticated
  using (
    (select public.is_team())
    or (deleted_at is null and (select public.pm_es_externo()))
    or lower(data->>'email') = (select public.pm_mi_email())
  );
-- El front guarda todo con upsert (insert ... on conflict do update) y Postgres aplica
-- el WITH CHECK de INSERT a la fila propuesta aunque termine en update: un colaborador
-- que guarda su lastSeenAt manda su fila aprobada. Por eso pasa también la fila propia
-- que ya existe y viene con los mismos campos protegidos.
create or replace function public.pm_fila_propia_igual(p_id text, p_data jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members t
    where t.id = p_id
      and t.deleted_at is null
      and lower(t.data->>'email') = public.pm_mi_email()
      and t.data->'status' is not distinct from p_data->'status'
      and t.data->'access' is not distinct from p_data->'access'
      and t.data->'assignedProjectId' is not distinct from p_data->'assignedProjectId'
      and t.data->'assignedProjectIds' is not distinct from p_data->'assignedProjectIds'
      and t.data->'email' is not distinct from p_data->'email'
  )
$$;
revoke all on function public.pm_fila_propia_igual(text, jsonb) from public, anon;
grant execute on function public.pm_fila_propia_igual(text, jsonb) to authenticated;

create policy team_members_equipo_insert on public.team_members for insert to authenticated
  with check (
    (select public.is_team())
    or (
      deleted_at is null
      and lower(data->>'email') = (select public.pm_mi_email())
      and (
        (data->>'status' = 'pending'
         and data->>'access' = 'project'
         and cardinality(public.pm_ids_asignados(data)) = 0)
        or public.pm_fila_propia_igual(id, data)
      )
    )
  );
create policy team_members_equipo_update on public.team_members for update to authenticated
  using ((select public.is_team()) or lower(data->>'email') = (select public.pm_mi_email()))
  with check ((select public.is_team()) or lower(data->>'email') = (select public.pm_mi_email()));

drop policy if exists projects_auth_read on public.projects;
drop policy if exists projects_auth_insert on public.projects;
drop policy if exists projects_auth_update on public.projects;
drop policy if exists projects_equipo_select on public.projects;
drop policy if exists projects_equipo_insert on public.projects;
drop policy if exists projects_equipo_update on public.projects;
create policy projects_equipo_select on public.projects for select to authenticated
  using ((select public.is_team()) or id = any((select public.pm_proyectos(false))::text[]));
create policy projects_equipo_insert on public.projects for insert to authenticated
  with check ((select public.is_team()));
create policy projects_equipo_update on public.projects for update to authenticated
  using ((select public.is_team()) or id = any((select public.pm_proyectos(true))::text[]))
  with check ((select public.is_team()) or id = any((select public.pm_proyectos(true))::text[]));

drop policy if exists clients_auth_read on public.clients;
drop policy if exists clients_auth_insert on public.clients;
drop policy if exists clients_auth_update on public.clients;
drop policy if exists clients_equipo_select on public.clients;
drop policy if exists clients_equipo_insert on public.clients;
drop policy if exists clients_equipo_update on public.clients;
create policy clients_equipo_select on public.clients for select to authenticated
  using ((select public.is_team()) or id = any((select public.pm_clientes(false))::text[]));
create policy clients_equipo_insert on public.clients for insert to authenticated
  with check ((select public.is_team()));
create policy clients_equipo_update on public.clients for update to authenticated
  using ((select public.is_team()) or id = any((select public.pm_clientes(true))::text[]))
  with check ((select public.is_team()) or id = any((select public.pm_clientes(true))::text[]));

-- Un colaborador puede crear un plan (el Planificador lo hace); lo ve y lo edita recién
-- cuando su proyecto lo enlaza con planId.
drop policy if exists plans_auth_read on public.plans;
drop policy if exists plans_auth_insert on public.plans;
drop policy if exists plans_auth_update on public.plans;
drop policy if exists plans_equipo_select on public.plans;
drop policy if exists plans_equipo_insert on public.plans;
drop policy if exists plans_equipo_update on public.plans;
create policy plans_equipo_select on public.plans for select to authenticated
  using ((select public.is_team()) or id = any((select public.pm_planes(false))::text[]));
create policy plans_equipo_insert on public.plans for insert to authenticated
  with check ((select public.is_team()) or (select public.pm_es_colaborador()));
create policy plans_equipo_update on public.plans for update to authenticated
  using ((select public.is_team()) or id = any((select public.pm_planes(true))::text[]))
  with check ((select public.is_team()) or id = any((select public.pm_planes(true))::text[]));

-- anon no tenía políticas pero sí grants completos; TRUNCATE saltea RLS.
revoke all on public.team_members, public.projects, public.clients, public.plans from anon;
revoke truncate, references, trigger on public.team_members, public.projects, public.clients, public.plans, public.client_surveys from authenticated;

-- Aviso a Speed Funnels con freno por proyecto.
create table if not exists public.sf_puente_cola (
  project_id   text primary key,
  ultimo_envio timestamptz not null,
  pendiente    boolean not null default false
);
alter table public.sf_puente_cola enable row level security;
revoke all on public.sf_puente_cola from public, anon, authenticated;

create or replace function public.sf_puente_aviso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
  v_keys   text[] := array['closerNotes', 'upsell', 'stage', 'stageAt', 'lifecycle', 'planId', 'clientId', 'name', 'kind'];
  v_k      text;
  v_cambio boolean := tg_op = 'INSERT';
  v_ultimo timestamptz;
begin
  if tg_op = 'UPDATE' then
    v_cambio := new.deleted_at is distinct from old.deleted_at;
    if not v_cambio then
      foreach v_k in array v_keys loop
        if new.data->v_k is distinct from old.data->v_k then
          v_cambio := true;
          exit;
        end if;
      end loop;
    end if;
  end if;
  if not v_cambio then
    return null;
  end if;

  -- Nada de esto puede frenar el guardado de un proyecto: cualquier error queda
  -- como warning y la reconciliación de Speed Funnels lo levanta.
  begin
    select ultimo_envio into v_ultimo from sf_puente_cola where project_id = new.id for update;
    if v_ultimo is not null and v_ultimo > clock_timestamp() - interval '30 seconds' then
      update sf_puente_cola set pendiente = true where project_id = new.id;
      return null;
    end if;

    select value into v_url from sf_puente_config where key = 'url';
    select value into v_secret from sf_puente_config where key = 'secret';
    if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
      return null;
    end if;

    insert into sf_puente_cola (project_id, ultimo_envio, pendiente)
    values (new.id, clock_timestamp(), false)
    on conflict (project_id) do update set ultimo_envio = excluded.ultimo_envio, pendiente = false;

    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('ids', jsonb_build_array(new.id)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-puente-secret', v_secret),
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning 'sf_puente_aviso(%): % %', new.id, sqlstate, sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.sf_puente_aviso() from public, anon, authenticated;

-- Junta en un solo envío los proyectos que cambiaron dentro de la ventana de 30 s.
create or replace function public.sf_puente_vaciar()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
  v_ids    jsonb;
begin
  select value into v_url from sf_puente_config where key = 'url';
  select value into v_secret from sf_puente_config where key = 'secret';
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return 0;
  end if;

  with listos as (
    update sf_puente_cola
       set pendiente = false, ultimo_envio = clock_timestamp()
     where pendiente
       and ultimo_envio <= clock_timestamp() - interval '30 seconds'
    returning project_id
  )
  select jsonb_agg(project_id) into v_ids from listos;

  if v_ids is null then
    return 0;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('ids', v_ids),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-puente-secret', v_secret),
    timeout_milliseconds := 15000
  );
  return jsonb_array_length(v_ids);
end;
$$;
revoke all on function public.sf_puente_vaciar() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'sf-puente-vaciar';
select cron.schedule('sf-puente-vaciar', '* * * * *', 'select public.sf_puente_vaciar()');
