-- Notas del servicio (pedido de Nacho, call del 26/10): lo que el cliente cuenta en el
-- onboarding y en las calls. Primero vivían en projects.data.serviceNotes, pero un
-- cliente del portal (access 'project') lee por RLS la fila entera de su proyecto, así
-- que vería lo que anotamos de él. Van a una tabla propia que sólo lee el equipo.
--
-- * Una fila por nota. Sin DELETE para nadie de sesión: borrar es poner deleted_at
--   (el front lo deshace con deleted_at = null).
-- * Sólo is_team() (aprobado, access 'full', mail confirmado). Ni colaboradores ni
--   clientes del portal ni anon.
-- * Va a supabase_realtime como el resto de las tablas de la app. Se agrega con ADD
--   TABLE: un SET TABLE reemplazaría la publicación entera.

create table if not exists public.project_service_notes (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  type text not null default 'general'
    check (type in ('onboarding','call','motivo','consumo','idea','general')),
  body text not null default '' check (char_length(body) <= 8000),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  pinned boolean not null default false,
  noted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id text,
  edited_by text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists project_service_notes_project_idx
  on public.project_service_notes (project_id) where deleted_at is null;

alter table public.project_service_notes enable row level security;
alter table public.project_service_notes force row level security;

revoke all on public.project_service_notes from anon, authenticated;
grant select, insert, update on public.project_service_notes to authenticated;

drop policy if exists psn_team_read on public.project_service_notes;
create policy psn_team_read on public.project_service_notes
  for select to authenticated using (public.is_team());

drop policy if exists psn_team_insert on public.project_service_notes;
create policy psn_team_insert on public.project_service_notes
  for insert to authenticated with check (public.is_team());

drop policy if exists psn_team_update on public.project_service_notes;
create policy psn_team_update on public.project_service_notes
  for update to authenticated using (public.is_team()) with check (public.is_team());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_service_notes'
  ) then
    alter publication supabase_realtime add table public.project_service_notes;
  end if;
end
$$;
