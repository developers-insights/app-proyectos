-- Catálogo de la web y portafolio en inglés (call del 13/11). Aditiva.
--
-- `portafolio_en`: la traducción al inglés de lo que el portafolio muestra de cada
-- proyecto (queEs, negocio, resumen). Vive aparte de `projects` a propósito: la app
-- guarda la fila entera del proyecto (`{id,data,updated_at}`), así que una clave
-- escrita desde afuera en `projects.data` se pierde con el próximo guardado de una
-- pestaña que no la tenía. `data.fuente` es la huella del español que se tradujo
-- (huellaPortafolio en src/lib/portafolio.js): si el español cambia, la traducción
-- deja de viajar. La escribe scripts/portafolio-traducir.mjs; la leen sf-puente y
-- catalogo-web con service role.
--
-- `catalogo_web_config`: `url` (/api/catalogo/revalidar de la web) y `secret`
-- (el mismo que la web tiene en CATALOGO_WEB_SECRET). Los valores se cargan aparte.
--
-- Trigger `catalogo_web_aviso`: cuando cambia algo de un proyecto que puede meterlo,
-- sacarlo o cambiarlo en la web, le avisa a la web. La web vuelve a pedir el
-- catálogo y revalida sus páginas sólo si cambió de verdad; si el aviso se pierde,
-- la web igual se refresca sola una vez por día.

create table if not exists public.portafolio_en (
  project_id text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.portafolio_en enable row level security;
revoke all on public.portafolio_en from public, anon, authenticated;
grant select, insert, update, delete on public.portafolio_en to service_role;

create table if not exists public.catalogo_web_config (
  key   text primary key,
  value text not null
);
alter table public.catalogo_web_config enable row level security;
revoke all on public.catalogo_web_config from public, anon, authenticated;
grant select on public.catalogo_web_config to service_role;

create or replace function public.catalogo_web_aviso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
  v_keys   text[] := array['stage', 'lifecycle', 'name', 'kind', 'portafolio', 'kickoff', 'stack', 'productionUrl', 'stores'];
  v_k      text;
  v_cambio boolean := tg_op = 'INSERT';
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

  -- Nada de esto puede frenar el guardado de un proyecto.
  begin
    select value into v_url from catalogo_web_config where key = 'url';
    select value into v_secret from catalogo_web_config where key = 'secret';
    if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
      return null;
    end if;
    perform net.http_post(
      url := v_url,
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-catalogo-secret', v_secret),
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning 'catalogo_web_aviso(%): % %', new.id, sqlstate, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.catalogo_web_aviso() from public, anon, authenticated;

drop trigger if exists catalogo_web_aviso on public.projects;
create trigger catalogo_web_aviso after insert or update on public.projects
  for each row execute function public.catalogo_web_aviso();
