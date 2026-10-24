-- Puente con Speed Funnels (call del 23/10). Aditiva: una tabla de config + un trigger.
--
-- Cuando cambia algo de un proyecto que le importa al closer (notas para el closer,
-- upsell, etapa, ciclo de vida, plan, cliente, nombre, borrado), este trigger le
-- avisa a la edge function `if-proyectos` de Speed Funnels con el id. Speed Funnels
-- vuelve a pedir la foto de ese proyecto a `sf-puente` (con el mismo secreto) y se
-- la muestra al closer. Cada 15 minutos Speed Funnels reconcilia todo, así que un
-- aviso perdido o un cambio del plan (que no dispara esto) llega igual.
--
-- `sf_puente_config` guarda la URL de Speed Funnels y el secreto compartido. RLS
-- sin políticas y sin grants: sólo la leen este trigger (definer) y la edge
-- function con service role. Los valores se cargan aparte, nunca en el repo.

create table if not exists public.sf_puente_config (
  key   text primary key,
  value text not null
);
alter table public.sf_puente_config enable row level security;
revoke all on public.sf_puente_config from public, anon, authenticated;
grant select on public.sf_puente_config to service_role;

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
    select value into v_url from sf_puente_config where key = 'url';
    select value into v_secret from sf_puente_config where key = 'secret';
    if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
      return null;
    end if;
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

drop trigger if exists sf_puente_aviso on public.projects;
create trigger sf_puente_aviso after insert or update on public.projects
  for each row execute function public.sf_puente_aviso();
