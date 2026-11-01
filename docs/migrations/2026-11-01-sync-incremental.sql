-- Sincronización incremental de la app (01/11/2026). Aplicada en yzmtzyuncekspgtsetwk por Management API.
--
-- La app bajaba todas las tablas compartidas cada vez que alguien la abría o recargaba. Ahora guarda
-- una copia local y pide sólo las filas con sync_at mayor al último que vio.
-- sync_at lo pone la base con SU reloj en cada insert/update: updated_at lo manda el navegador y un
-- reloj atrasado haría que una fila no apareciera nunca en el incremental. Las bajas son soft
-- (deleted_at) y viajan como cualquier cambio; un DELETE de verdad lo levanta la carga completa diaria.

create or replace function public.tocar_sync_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.sync_at := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects', 'clients', 'team_members', 'calls', 'activity', 'sops_categories',
                           'sops_processes', 'assistant_chats', 'videos', 'mvps', 'plans', 'tasks'] loop
    execute format('alter table public.%I add column if not exists sync_at timestamptz not null default clock_timestamp()', t);
    execute format('create index if not exists %I on public.%I (sync_at)', t || '_sync_at', t);
    execute format('drop trigger if exists tocar_sync_at on public.%I', t);
    execute format('create trigger tocar_sync_at before insert or update on public.%I for each row execute function public.tocar_sync_at()', t);
  end loop;
end $$;
