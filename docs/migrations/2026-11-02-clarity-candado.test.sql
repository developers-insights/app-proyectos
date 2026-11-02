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

create or replace function pg_temp.espera_ok(sql text, caso text) returns void language plpgsql as $f$
begin
  execute sql;
  raise notice 'ok %', caso;
exception when insufficient_privilege then
  raise exception 'FALLA %: el candado frenó algo que debía pasar', caso;
end;
$f$;

-- Otro compañero del equipo
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"nacho@insightsapps.tech"}', true);

select pg_temp.espera_42501($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'otro mail prende clarity');
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{name}', '"Otro nombre"') where id = 'ensayo-clarity'$$, 'otro mail edita otro campo');
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{clarity}', 'false') where id = 'ensayo-clarity'$$, 'otro mail deja false sobre ausente');
select pg_temp.espera_42501($$update public.wa_groups set clarity_instancia = 'closer-manuel' where group_jid = 'ensayo-clarity@g.us'$$, 'otro mail cambia el número');
select pg_temp.espera_ok($$update public.wa_groups set group_name = 'x' where group_jid = 'ensayo-clarity@g.us'$$, 'otro mail edita otro campo del grupo');
select pg_temp.espera_42501($$insert into public.projects (id, data) values ('ensayo-clarity-2', '{"clarity":true}')$$, 'otro mail inserta con clarity');
select pg_temp.espera_ok($$insert into public.projects (id, data) values ('ensayo-clarity-3', '{"name":"sin clarity"}')$$, 'otro mail inserta sin clarity');
select pg_temp.espera_ok($$insert into public.projects (id, data) values ('ensayo-clarity', '{"name":"upsert sin cambio"}') on conflict (id) do update set data = excluded.data$$, 'otro mail upsert que no toca clarity');
select pg_temp.espera_42501($$insert into public.projects (id, data) values ('ensayo-clarity', '{"clarity":true}') on conflict (id) do update set data = excluded.data$$, 'otro mail upsert que prende clarity');

-- Sin mail en el JWT (token sin email) y sin claims
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.espera_42501($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'JWT sin email');
select set_config('request.jwt.claims', '', true);
select pg_temp.espera_42501($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'authenticated sin claims');

-- Manuel (con mayúsculas, como puede venir en el JWT)
select set_config('request.jwt.claims', '{"role":"authenticated","email":"ManuelNavarro@insightsapps.tech"}', true);
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'Manuel prende clarity');
select pg_temp.espera_ok($$update public.wa_groups set clarity_instancia = 'closer-manuel' where group_jid = 'ensayo-clarity@g.us'$$, 'Manuel cambia el número');

-- Con clarity ya prendido, otro compañero puede seguir editando el resto, pero no apagarlo
select set_config('request.jwt.claims', '{"role":"authenticated","email":"nacho@insightsapps.tech"}', true);
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{name}', '"Sigue andando"') where id = 'ensayo-clarity'$$, 'otro mail edita con clarity prendido');
select pg_temp.espera_42501($$update public.projects set data = jsonb_set(data, '{clarity}', 'false') where id = 'ensayo-clarity'$$, 'otro mail apaga clarity');
select pg_temp.espera_42501($$update public.projects set data = data - 'clarity' where id = 'ensayo-clarity'$$, 'otro mail borra la clave clarity');

-- Anónimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.espera_42501($$update public.projects set data = jsonb_set(data, '{clarity}', 'false') where id = 'ensayo-clarity'$$, 'anon');

-- Service role, postgres y migraciones (sin JWT)
reset role;
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{clarity}', 'false') where id = 'ensayo-clarity'$$, 'postgres sin JWT');
set local role service_role;
select pg_temp.espera_ok($$update public.projects set data = jsonb_set(data, '{clarity}', 'true') where id = 'ensayo-clarity'$$, 'service_role prende clarity');
select pg_temp.espera_ok($$update public.wa_groups set clarity_instancia = null where group_jid = 'ensayo-clarity@g.us'$$, 'service_role cambia el número');

rollback;
