-- El cliente del portal (team_members.access = 'project') deja de leer filas de projects,
-- clients, plans y del resto del equipo (26/10).
--
-- Antes: projects_equipo_select (y los de clients y plans) usaban pm_proyectos(false), que
-- incluye el assignedProjectId del portal, así que el cliente recibía la fila entera de su
-- proyecto: closerNotes, scopeNotes, sharePassword, totalAmount/paidAmount, vault, accounts,
-- lifecycle.maintenanceAmount, upsell. team_members_equipo_select le mostraba todo el equipo
-- (mails, accesos y proyectos de los demás) porque pm_es_externo() incluye 'project'.
--
-- Ahora:
-- * Los SELECT de projects, clients y plans usan pm_*(true): equipo y colaboradores, como
--   antes; el portal, nada. El portal nunca escribió en estas tablas (UPDATE ya era sólo
--   pm_*(true)).
-- * team_members: fuera del equipo sólo el colaborador ve al resto; el portal, su fila.
-- * portal_projects(): única vía de lectura del portal. Devuelve, por cada proyecto
--   asignado, sólo lo que pinta MemberPortal (src/lib/portal.js lo arma): nombre, etapa,
--   fase del ciclo de vida y sus dos sellos, % legacy, empresa del cliente y las semanas
--   del plan con el texto y el done de cada tarea.
-- project-share y las edge functions usan service_role: no pasan por nada de esto.

create or replace function public.portal_projects()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mios as (
    select distinct t.data->>'assignedProjectId' as pid
    from public.team_members t
    where t.deleted_at is null
      and t.data->>'status' = 'approved'
      and t.data->>'access' = 'project'
      and coalesce(t.data->>'assignedProjectId', '') <> ''
      and lower(t.data->>'email') = public.pm_mi_email()
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', coalesce(p.data->>'name', ''),
      'stage', p.data->>'stage',
      'lifecycle', case when jsonb_typeof(p.data->'lifecycle') = 'object' then jsonb_build_object(
        'phase', p.data->'lifecycle'->'phase',
        'phase2At', p.data->'lifecycle'->'phase2At',
        'phase3At', p.data->'lifecycle'->'phase3At'
      ) end,
      'progress', p.data->'progress',
      'company', c.data->>'company',
      'plan', case when pl.id is not null then jsonb_build_object('weeks', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'n', w->'n',
          'title', case when jsonb_typeof(w->'title') = 'string' then w->>'title' end,
          'tasks', (
            select coalesce(jsonb_agg(
              case when jsonb_typeof(t) = 'string'
                then jsonb_build_object('text', t #>> '{}', 'done', false)
                else jsonb_build_object(
                  'text', coalesce(t->>'text', ''),
                  -- Igual que el !!t.done del front: cualquier valor "truthy" cuenta.
                  'done', coalesce(t->'done' not in ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb), false)
                )
              end order by ti), '[]'::jsonb)
            from jsonb_array_elements(case when jsonb_typeof(w->'tasks') = 'array' then w->'tasks' else '[]'::jsonb end) with ordinality as tt(t, ti)
            where jsonb_typeof(t) in ('string', 'object')
          )
        ) order by wi), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(pl.data->'weeks') = 'array' then pl.data->'weeks' else '[]'::jsonb end) with ordinality as ww(w, wi)
        where jsonb_typeof(w) = 'object'
      )) end
    ) order by p.data->>'name'), '[]'::jsonb)
  from mios m
  join public.projects p on p.id = m.pid and p.deleted_at is null
  left join public.clients c on c.id = p.data->>'clientId' and c.deleted_at is null
  left join public.plans pl on pl.id = p.data->>'planId' and pl.deleted_at is null
$$;
revoke all on function public.portal_projects() from public, anon;
grant execute on function public.portal_projects() to authenticated;

drop policy if exists projects_equipo_select on public.projects;
create policy projects_equipo_select on public.projects for select to authenticated
  using ((select public.is_team()) or id = any((select public.pm_proyectos(true))::text[]));

drop policy if exists clients_equipo_select on public.clients;
create policy clients_equipo_select on public.clients for select to authenticated
  using ((select public.is_team()) or id = any((select public.pm_clientes(true))::text[]));

drop policy if exists plans_equipo_select on public.plans;
create policy plans_equipo_select on public.plans for select to authenticated
  using ((select public.is_team()) or id = any((select public.pm_planes(true))::text[]));

drop policy if exists team_members_equipo_select on public.team_members;
create policy team_members_equipo_select on public.team_members for select to authenticated
  using (
    (select public.is_team())
    or (deleted_at is null and (select public.pm_es_colaborador()))
    or lower(data->>'email') = (select public.pm_mi_email())
  );
