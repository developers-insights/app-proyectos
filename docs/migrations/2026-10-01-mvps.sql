-- MVPs / demos comerciales: una fila por repo del org de GitHub de ventas.
-- Mismo patrón por-fila que videos/agency_accounts (useRowCollection en el front).
-- Las filas las crea y refresca la Edge Function `mvp-sync`; el equipo solo edita
-- los campos propios (projectId, notas, demo manual, descartado).

create table if not exists public.mvps (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.mvps enable row level security;

drop policy if exists mvps_auth_read on public.mvps;
drop policy if exists mvps_auth_insert on public.mvps;
drop policy if exists mvps_auth_update on public.mvps;
create policy mvps_auth_read on public.mvps for select to authenticated using (true);
create policy mvps_auth_insert on public.mvps for insert to authenticated with check (true);
create policy mvps_auth_update on public.mvps for update to authenticated using (true) with check (true);

create index if not exists mvps_updated_at_idx on public.mvps (updated_at desc) where deleted_at is null;

do $$ begin
  alter publication supabase_realtime add table public.mvps;
exception when duplicate_object then null; end $$;

-- Cron cada 15 min. La clave del header es el secret MVP_CRON_KEY de la función
-- (se reemplaza al aplicar; no queda en el repo).
-- select cron.schedule('mvp-sync', '*/15 * * * *', $$
--   select net.http_post(
--     url := 'https://yzmtzyuncekspgtsetwk.supabase.co/functions/v1/mvp-sync',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', '<MVP_CRON_KEY>'),
--     body := '{"action":"sync"}'::jsonb,
--     timeout_milliseconds := 60000
--   );
-- $$);

create or replace function public.mvp_apply_sync(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  n integer := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.mvps (id, data, updated_at)
    values (r->>'id', r, now())
    on conflict (id) do update set
      data = public.mvps.data
        || (excluded.data - 'projectId' - 'linkedBy' - 'linkedAt' - 'createdAt' - 'status' - 'notes' - 'demoUrlManual' - 'autoLinkOff')
        || case
             when coalesce(public.mvps.data->>'projectId', '') = ''
              and coalesce((public.mvps.data->>'autoLinkOff')::boolean, false) = false
              and coalesce(excluded.data->>'projectId', '') <> ''
             then jsonb_build_object('projectId', excluded.data->'projectId', 'linkedBy', 'auto', 'linkedAt', excluded.data->'linkedAt')
             else '{}'::jsonb
           end,
      updated_at = now()
    where public.mvps.deleted_at is null;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.mvp_apply_sync(jsonb) from public, anon, authenticated;
grant execute on function public.mvp_apply_sync(jsonb) to service_role;
