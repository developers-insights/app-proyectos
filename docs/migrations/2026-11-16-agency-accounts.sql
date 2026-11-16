-- Cuentas de la agencia (sección "Cuentas"): el front ya usaba useRowCollection('agency_accounts')
-- pero la tabla nunca se creó, así que lo cargado quedaba sólo en el localStorage de quien lo cargó.
-- Mismo patrón que videos, salvo el SELECT: guarda contraseñas, así que lo ve sólo el equipo full
-- (is_team), no un lector (pm_puede_ver) ni un colaborador.

create table if not exists public.agency_accounts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.agency_accounts enable row level security;

revoke all on public.agency_accounts from anon;
grant select, insert, update, delete on public.agency_accounts to authenticated, service_role;

drop policy if exists agency_accounts_equipo_select on public.agency_accounts;
create policy agency_accounts_equipo_select on public.agency_accounts
  for select to authenticated using ((select public.is_team()));

drop policy if exists agency_accounts_equipo_insert on public.agency_accounts;
create policy agency_accounts_equipo_insert on public.agency_accounts
  for insert to authenticated with check ((select public.is_team()));

drop policy if exists agency_accounts_equipo_update on public.agency_accounts;
create policy agency_accounts_equipo_update on public.agency_accounts
  for update to authenticated using ((select public.is_team())) with check ((select public.is_team()));

do $$ begin
  alter publication supabase_realtime add table public.agency_accounts;
exception when duplicate_object then null; end $$;
