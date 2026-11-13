-- Oportunidades por proyecto (call del 13/11). Aplicada en yzmtzyuncekspgtsetwk por Management API.
--
-- Una fila por oportunidad, patrón por-fila de la app (useRowCollection): id, data, updated_at,
-- deleted_at, sync_at. project_id sale del JSON para poder filtrar por proyecto con índice.
-- Lee quien ve el equipo (pm_puede_ver: Mati y Axel también); escribe el equipo (is_team).
-- La edge function `oportunidades` escribe con service role por las dos funciones de abajo:
-- generar reemplaza las que nadie tocó y "La ofrecí" mezcla su resultado sin pisar el resto.

create table if not exists public.project_opportunities (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_at timestamptz not null default clock_timestamp(),
  project_id text generated always as (data->>'projectId') stored
);

create index if not exists project_opportunities_project_idx
  on public.project_opportunities (project_id) where deleted_at is null;
create index if not exists project_opportunities_sync_at on public.project_opportunities (sync_at);

drop trigger if exists tocar_sync_at on public.project_opportunities;
create trigger tocar_sync_at before insert or update on public.project_opportunities
  for each row execute function public.tocar_sync_at();

alter table public.project_opportunities enable row level security;
alter table public.project_opportunities force row level security;
revoke all on table public.project_opportunities from public, anon, authenticated;
grant select, insert, update on table public.project_opportunities to authenticated;
grant select, insert, update, delete on table public.project_opportunities to service_role;

drop policy if exists project_opportunities_equipo_select on public.project_opportunities;
drop policy if exists project_opportunities_equipo_insert on public.project_opportunities;
drop policy if exists project_opportunities_equipo_update on public.project_opportunities;
create policy project_opportunities_equipo_select on public.project_opportunities
  for select to authenticated using ((select public.pm_puede_ver()));
create policy project_opportunities_equipo_insert on public.project_opportunities
  for insert to authenticated with check ((select public.is_team()));
create policy project_opportunities_equipo_update on public.project_opportunities
  for update to authenticated using ((select public.is_team())) with check ((select public.is_team()));

do $$ begin
  alter publication supabase_realtime add table public.project_opportunities;
exception when duplicate_object then null; end $$;

-- updatedAt avanza siempre por encima del que tenía: la app toma la versión con updatedAt más
-- nuevo, y un navegador con el reloj adelantado ignoraría el resultado si se usara sólo now().
create or replace function public.oportunidad_sello(p_prev text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v timestamptz := clock_timestamp();
begin
  begin
    v := greatest(v, p_prev::timestamptz + interval '1 millisecond');
  exception when others then null;
  end;
  return to_char(v at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
end $$;
revoke all on function public.oportunidad_sello(text) from public, anon, authenticated;

create or replace function public.oportunidades_reemplazar(p_project text, p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if coalesce(p_project, '') !~ '^[A-Za-z0-9_-]{1,80}$' or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'OPORTUNIDADES_INVALIDAS' using errcode = '22023';
  end if;
  update public.project_opportunities
     set deleted_at = now(), updated_at = now()
   where project_id = p_project and deleted_at is null and data->>'estado' = 'nueva';
  insert into public.project_opportunities (id, data, updated_at)
  select f->>'id', f, now()
    from jsonb_array_elements(p_filas) f
   where coalesce(f->>'id', '') ~ '^[A-Za-z0-9_-]{1,80}$' and f->>'projectId' = p_project;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.oportunidades_reemplazar(text, jsonb) from public, anon, authenticated;
grant execute on function public.oportunidades_reemplazar(text, jsonb) to service_role;

create or replace function public.oportunidad_aplicar(p_id text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'PATCH_INVALIDO' using errcode = '22023';
  end if;
  update public.project_opportunities
     set data = data || (p_patch - 'id' - 'projectId')
                     || jsonb_build_object('updatedAt', public.oportunidad_sello(data->>'updatedAt')),
         updated_at = now()
   where id = p_id and deleted_at is null
  returning data into v;
  return v;
end $$;
revoke all on function public.oportunidad_aplicar(text, jsonb) from public, anon, authenticated;
grant execute on function public.oportunidad_aplicar(text, jsonb) to service_role;
