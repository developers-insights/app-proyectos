-- Acceso 'read' (pedido de Manuel, 12/11, para Mati y Axel de Speed Funnels): ven todo lo
-- que ve el equipo y no escriben nada.
--
-- * pm_puede_ver() = is_team() o una fila viva aprobada con access 'read'.
-- * Toda política SELECT de public que usaba is_team() pasa a pm_puede_ver(). Las de
--   INSERT/UPDATE/DELETE siguen con is_team(): un lector no escribe ni por la API.
-- * client_surveys usa survey_is_team() (que \m no matchea): su SELECT se suma aparte.
-- * La bóveda (edge function `boveda`) y las altas siguen exigiendo access 'full':
--   un lector no ve claves de clientes.
-- Idempotente: re-correrla no cambia nada.

create or replace function public.pm_puede_ver()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_team() or exists (
    select 1 from public.team_members t
    where t.deleted_at is null
      and t.data->>'status' = 'approved'
      and t.data->>'access' = 'read'
      and lower(t.data->>'email') = public.pm_mi_email()
  )
$$;
revoke all on function public.pm_puede_ver() from public, anon;
grant execute on function public.pm_puede_ver() to authenticated;

do $$
declare
  r record;
  v_qual text;
begin
  for r in
    select tablename, policyname, qual from pg_policies
    where schemaname = 'public' and cmd = 'SELECT' and qual ~ '\mis_team\(\)'
  loop
    v_qual := regexp_replace(r.qual, '\mis_team\(\) AS is_team\)', 'pm_puede_ver() AS pm_puede_ver)', 'g');
    v_qual := regexp_replace(v_qual, '\mis_team\(\)', 'pm_puede_ver()', 'g');
    execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, v_qual);
  end loop;

  for r in
    select tablename, policyname, qual from pg_policies
    where schemaname = 'public' and tablename = 'client_surveys' and cmd = 'SELECT'
      and qual !~ 'pm_puede_ver'
  loop
    execute format('alter policy %I on public.%I using ((%s) or (select public.pm_puede_ver()))', r.policyname, r.tablename, r.qual);
  end loop;
end $$;

insert into public.team_members (id, data, updated_at)
values
  ('lec-mati', jsonb_build_object('id', 'lec-mati', 'name', 'Matias Molina', 'email', 'matiasm@insightsapps.tech', 'initials', 'MM', 'color', '#14B8A6',
     'role', '', 'status', 'approved', 'access', 'read', 'createdAt', now(), 'updatedAt', now()), now()),
  ('lec-axel', jsonb_build_object('id', 'lec-axel', 'name', 'Axel Navarro', 'email', 'navarraxel00@insightsapps.tech', 'initials', 'AN', 'color', '#EAB308',
     'role', '', 'status', 'approved', 'access', 'read', 'createdAt', now(), 'updatedAt', now()), now())
on conflict (id) do nothing;
