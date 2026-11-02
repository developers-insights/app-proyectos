-- Prueba de 2026-11-02-clarity-candado.sql. Se corre DESPUÉS de la migración, en la misma sesión, y
-- todo queda dentro de begin ... rollback. Cada caso falla con raise exception si no se cumple.
-- Crea su propio proyecto y grupo de prueba: no toca filas reales.
-- Necesita los roles authenticated/anon/service_role y auth.jwt() de Supabase.

begin;

insert into public.projects (id, data) values ('ensayo-clarity', '{"name":"Ensayo","stage":"desarrollo"}');
insert into public.wa_groups (group_jid, project_id) values ('ensayo-clarity@g.us', 'ensayo-clarity');

create or replace function pg_temp.espera_42501(sql text, caso text) returns void language plpgsql as $f$
begin
  execute sql;
  raise exception 'FALLA %: el candado dejó pasar', caso;
exception when insufficient_privilege then
  raise notice 'ok % (42501)', caso;
end;
$f$;

create or replace function pg_temp.espera_conserva(sql text, caso text, consulta text) returns void language plpgsql as $f$
declare antes text; despues text; n int;
begin
  execute consulta into antes;
  execute sql;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'FALLA %: no tocó ninguna fila (RLS)', caso; end if;
  execute consulta into despues;
  if antes is distinct from despues then
    raise exception 'FALLA %: el candado dejó cambiar (% -> %)', caso, antes, despues;
  end if;
  raise notice 'ok % (conservado)', caso;
end $f$;

create or replace function pg_temp.espera_sin_cambio(sql text, caso text, consulta text) returns void language plpgsql as $f$
declare antes text; despues text;
begin
  reset role;
  execute consulta into antes;
  execute format('set local role %I', current_setting('clarity.rol'));
  begin
    execute sql;
  exception when insufficient_privilege then null;
  end;
  reset role;
  execute consulta into despues;
  execute format('set local role %I', current_setting('clarity.rol'));
  if antes is distinct from despues then
    raise exception 'FALLA %: cambió (% -> %)', caso, antes, despues;
  end if;
end $f$;

create or replace function pg_temp.espera_ok(sql text, caso text) returns void language plpgsql as $f$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'FALLA %: no tocó ninguna fila (RLS)', caso; end if;
  raise notice 'ok %', caso;
exception when insufficient_privilege then
  raise exception 'FALLA %: el candado frenó algo que debía pasar', caso;
end;
$f$;

-- Otro compañero del equipo
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"80bb4142-84d9-48d3-8c28-647eb4fc458e","email":"nachocachaza@insightsapps.tech"}', true);

select pg_temp.espera_conserva($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'otro mail prende clarity', $$select coalesce(data->>'clarity','~')||'|'||coalesce(data->>'clarityAt','~') from public.projects where id = 'ensayo-clarity'$$);
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{name}', '"Otro nombre"') where id = 'ensayo-clarity'$$, 'otro mail edita otro campo');
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{clarity}', 'false') where id = 'ensayo-clarity'$$, 'otro mail deja false sobre ausente');
select pg_temp.espera_conserva($$update public.wa_groups set clarity_instancia = 'closer-manuel' where group_jid = 'ensayo-clarity@g.us'$$, 'otro mail cambia el número', $$select coalesce(clarity_instancia,'~') from public.wa_groups where group_jid = 'ensayo-clarity@g.us'$$);
select pg_temp.espera_ok($$update public.wa_groups set group_name = 'x' where group_jid = 'ensayo-clarity@g.us'$$, 'otro mail edita otro campo del grupo');
select pg_temp.espera_42501($$insert into public.projects (id, data) values ('ensayo-clarity-2', '{"clarity":true}')$$, 'otro mail inserta con clarity');
select pg_temp.espera_ok($$insert into public.projects (id, data) values ('ensayo-clarity-3', '{"name":"sin clarity"}')$$, 'otro mail inserta sin clarity');
select pg_temp.espera_ok($$insert into public.projects (id, data) values ('ensayo-clarity', '{"name":"upsert sin cambio"}') on conflict (id) do update set data = excluded.data$$, 'otro mail upsert que no toca clarity');
select pg_temp.espera_conserva($$insert into public.projects (id, data) values ('ensayo-clarity', '{"clarity":true}') on conflict (id) do update set data = excluded.data$$, 'otro mail upsert que prende clarity', $$select coalesce(data->>'clarity','~')||'|'||coalesce(data->>'clarityAt','~') from public.projects where id = 'ensayo-clarity'$$);

-- Sin mail en el JWT (token sin email) y sin claims: RLS ya no los deja ver la fila
select set_config('clarity.rol', 'authenticated', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.espera_sin_cambio($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'JWT sin email', $$select coalesce(data->>'clarity','~')||'|'||coalesce(data->>'clarityAt','~') from public.projects where id = 'ensayo-clarity'$$);
select set_config('request.jwt.claims', '', true);
select pg_temp.espera_sin_cambio($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'authenticated sin claims', $$select coalesce(data->>'clarity','~')||'|'||coalesce(data->>'clarityAt','~') from public.projects where id = 'ensayo-clarity'$$);

-- Manuel (con mayúsculas, como puede venir en el JWT)
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"403f2bfd-6a03-49c5-b74f-7c39b3c99377","email":"ManuelNavarro@insightsapps.tech"}', true);
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'Manuel prende clarity');
select pg_temp.espera_ok($$update public.wa_groups set clarity_instancia = 'closer-manuel' where group_jid = 'ensayo-clarity@g.us'$$, 'Manuel cambia el número');

-- Con clarity ya prendido, otro compañero puede seguir editando el resto, pero no apagarlo
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"80bb4142-84d9-48d3-8c28-647eb4fc458e","email":"nachocachaza@insightsapps.tech"}', true);
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{name}', '"Sigue andando"') where id = 'ensayo-clarity'$$, 'otro mail edita con clarity prendido');
select pg_temp.espera_conserva($$update public.projects set data = jsonb_set(data, '{clarity}', 'false') where id = 'ensayo-clarity'$$, 'otro mail apaga clarity', $$select coalesce(data->>'clarity','~')||'|'||coalesce(data->>'clarityAt','~') from public.projects where id = 'ensayo-clarity'$$);
select pg_temp.espera_conserva($$update public.projects set data = data - 'clarity' where id = 'ensayo-clarity'$$, 'otro mail borra la clave clarity', $$select coalesce(data->>'clarity','~')||'|'||coalesce(data->>'clarityAt','~') from public.projects where id = 'ensayo-clarity'$$);

-- Anónimo
reset role;
set local role anon;
select set_config('clarity.rol', 'anon', true);
select set_config('request.jwt.claims', '', true);
select pg_temp.espera_sin_cambio($$update public.projects set data = jsonb_set(data, '{clarity}', 'false') where id = 'ensayo-clarity'$$, 'anon', $$select coalesce(data->>'clarity','~')||'|'||coalesce(data->>'clarityAt','~') from public.projects where id = 'ensayo-clarity'$$);

-- Service role, postgres y migraciones (sin JWT)
reset role;
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{clarity}', 'false') where id = 'ensayo-clarity'$$, 'postgres sin JWT');
set local role service_role;
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'service_role prende clarity');
select pg_temp.espera_ok($$update public.wa_groups set clarity_instancia = null where group_jid = 'ensayo-clarity@g.us'$$, 'service_role cambia el número');

rollback;
