-- Candado del interruptor "Clarity" (2/11). La UI de app-proyectos sólo lo muestra a
-- manuelnavarro@insightsapps.tech, pero la UI no es el candado: estos triggers rechazan el cambio
-- de projects.data->'clarity' y de wa_groups.clarity_instancia a cualquier otra sesión.
--
-- Pasan sin mirar el mail: service_role, postgres y las migraciones (current_user no es
-- authenticated ni anon). Sólo se controla a quien entra por PostgREST con JWT.
-- Ausente y false cuentan como lo mismo en data->'clarity'; el resto de data no se mira, así que
-- guardar cualquier otro campo del proyecto sigue andando para todo el equipo.
--
-- Cuidado con una pestaña vieja: el guardado de la app escribe el `data` entero. Si Manuel prende
-- Clarity y otro compañero guarda desde una copia anterior al cambio, ese guardado vuelve a mandar
-- clarity en su valor viejo y este candado lo rechaza (42501). Realtime mantiene las copias al día,
-- así que es raro, pero es el costo de rechazar en vez de pisar en silencio.
--
-- Mismo mail que src/lib/clarity.js (CLARITY_ADMIN_EMAIL).

create or replace function public.clarity_candado_proyecto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  v_viejo text;
  v_nuevo text := coalesce(new.data->>'clarity', 'false');
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if lower(coalesce(auth.jwt()->>'email', '')) = 'manuelnavarro@insightsapps.tech' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_viejo := coalesce(old.data->>'clarity', 'false');
  else
    -- INSERT ... ON CONFLICT DO UPDATE dispara este trigger antes de saber que la fila existe: si
    -- existe, lo juzga el trigger de UPDATE que viene después.
    if exists (select 1 from public.projects where id = new.id) then
      return new;
    end if;
    v_viejo := 'false';
  end if;

  if v_nuevo is distinct from v_viejo then
    raise exception 'Clarity lo cambia sólo manuelnavarro@insightsapps.tech'
      using errcode = '42501', hint = 'projects.data.clarity';
  end if;
  return new;
end;
$fn$;

drop trigger if exists clarity_candado on public.projects;
create trigger clarity_candado
  before insert or update on public.projects
  for each row execute function public.clarity_candado_proyecto();

create or replace function public.clarity_candado_grupo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if lower(coalesce(auth.jwt()->>'email', '')) = 'manuelnavarro@insightsapps.tech' then
    return new;
  end if;
  if new.clarity_instancia is distinct from (case when tg_op = 'UPDATE' then old.clarity_instancia else null end) then
    raise exception 'El número que contesta en Clarity lo cambia sólo manuelnavarro@insightsapps.tech'
      using errcode = '42501', hint = 'wa_groups.clarity_instancia';
  end if;
  return new;
end;
$fn$;

drop trigger if exists clarity_candado on public.wa_groups;
create trigger clarity_candado
  before insert or update on public.wa_groups
  for each row execute function public.clarity_candado_grupo();

-- clarity_aviso_proyecto (app-proyectos-alta.sql) ya avisa a cb-proyectos cuando cambia
-- data.clarity: entrar y salir son un cambio de v_new_in contra v_old_in. Lo único que no cumplía
-- era lo que dice bot.md ("salvo pausado, finalizado o cancelado"): dejaba pasar cancelado.
-- Misma función, sólo con 'cancelado' sumado a las etapas que no entran por la marca.
create or replace function public.clarity_aviso_proyecto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_etapas  text[] := array['free', 'plan', 'anual', 'starter', 'kaizen', 'scale'];
  v_fuera   text[] := array['pausado', 'finalizado', 'cancelado'];
  v_stage   text := lower(coalesce(new.data->>'stage', ''));
  v_new_in  boolean := (v_stage = any(v_etapas) or (new.data->>'clarity' = 'true' and not (v_stage = any(v_fuera))))
                       and new.deleted_at is null;
  v_old_in  boolean := false;
  v_url     text;
  v_secret  text;
  v_cliente jsonb;
begin
  if tg_op = 'UPDATE' then
    v_old_in := (lower(coalesce(old.data->>'stage', '')) = any(v_etapas)
                 or (old.data->>'clarity' = 'true' and not (lower(coalesce(old.data->>'stage', '')) = any(v_fuera))))
                and old.deleted_at is null;
    if v_new_in = v_old_in
       and not (v_new_in and v_stage is distinct from lower(coalesce(old.data->>'stage', ''))) then
      return null;
    end if;
  elsif not v_new_in then
    return null;
  end if;

  begin
    select value into v_url from clarity_config where key = 'url';
    select value into v_secret from clarity_config where key = 'secret';
    if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
      return null;
    end if;
    select c.data into v_cliente from clients c where c.id = new.data->>'clientId';
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('record', jsonb_build_object(
                'id', new.id, 'data', new.data, 'deleted_at', new.deleted_at, 'client', v_cliente)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cb-secret', v_secret),
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning 'clarity_aviso_proyecto(%): % %', new.id, sqlstate, sqlerrm;
  end;
  return null;
end;
$fn$;
revoke all on function public.clarity_aviso_proyecto() from public, anon, authenticated;
