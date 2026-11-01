-- Capturas de avances y comunicaciones fuera de la fila del proyecto (31/10/2026).
-- Aplicada en yzmtzyuncekspgtsetwk por Management API.
--
-- Por qué: las capturas viajaban como base64 dentro de projects.data (avances[].shots, comms[].shots):
-- 1,1 MB de 1,2 MB de la tabla. Cada lectura de proyectos (abrir la app, el Realtime de cada cambio,
-- mvp-sync cada 15 min, sf-puente, fathom-sync…) las arrastraba, y eso dejó a la org sin cuota de egress.
--
-- Cómo: un trigger BEFORE saca cualquier `data:` de esos arrays a project_shots (id = sha256 del contenido,
-- así repetir no duplica) y deja `shot:<id>`. Corre en cada escritura, así que una pestaña vieja que vuelva a
-- mandar el base64 no lo reintroduce. La app carga la imagen recién cuando se muestra.

create table if not exists public.project_shots (
  id text primary key,
  project_id text not null,
  data text not null check (data like 'data:image/%'),
  created_at timestamptz not null default now()
);
create index if not exists project_shots_project on public.project_shots (project_id);
alter table public.project_shots enable row level security;
revoke all on public.project_shots from anon;

drop policy if exists project_shots_select on public.project_shots;
create policy project_shots_select on public.project_shots for select to authenticated
  using ((select public.is_team()) or project_id = any ((select public.pm_proyectos(true))::text[]));

create or replace function public.projects_sacar_capturas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  campo text;
  arr jsonb;
  shots jsonb;
  s text;
  sid text;
  i int;
  j int;
begin
  if new.data is null or position('"data:image/' in new.data::text) = 0 then return new; end if;
  foreach campo in array array['avances', 'comms'] loop
    arr := new.data->campo;
    if jsonb_typeof(arr) is distinct from 'array' then continue; end if;
    for i in 0 .. jsonb_array_length(arr) - 1 loop
      if jsonb_typeof(arr->i->'shots') is distinct from 'array' then continue; end if;
      shots := '[]'::jsonb;
      for j in 0 .. jsonb_array_length(arr->i->'shots') - 1 loop
        s := arr->i->'shots'->>j;
        if s like 'data:image/%' then
          sid := encode(extensions.digest(convert_to(s, 'UTF8'), 'sha256'), 'hex');
          insert into public.project_shots (id, project_id, data) values (sid, new.id, s) on conflict (id) do nothing;
          s := 'shot:' || sid;
        end if;
        shots := shots || to_jsonb(s);
      end loop;
      arr := jsonb_set(arr, array[i::text, 'shots'], shots);
    end loop;
    new.data := jsonb_set(new.data, array[campo], arr);
  end loop;
  return new;
end $$;
revoke all on function public.projects_sacar_capturas() from public, anon, authenticated;

drop trigger if exists projects_sacar_capturas on public.projects;
create trigger projects_sacar_capturas before insert or update of data on public.projects
  for each row execute function public.projects_sacar_capturas();

update public.projects set data = data where position('"data:image/' in data::text) > 0;
