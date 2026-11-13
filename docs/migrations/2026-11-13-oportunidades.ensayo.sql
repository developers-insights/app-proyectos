-- Ensayo de 2026-11-13-oportunidades.sql: se corre concatenado DESPUÉS de la migración, en un
-- solo lote por la Management API. Termina en raise exception, así que todo se revierte (tabla
-- incluida); los resultados vienen en el mensaje del error. Ningún PERMITIDO es OK y todo conteo
-- de alguien de afuera del equipo tiene que dar 0.
do $t$
declare
  res jsonb := '{}';
  n int;
  v jsonb;
  ext uuid := gen_random_uuid();
  man uuid; lec uuid;
  p1 text;
begin
  select id into man from auth.users where lower(email) = 'manuelnavarro@insightsapps.tech';
  select u.id into lec from public.team_members t join auth.users u on lower(u.email) = lower(t.data->>'email')
   where t.deleted_at is null and t.data->>'access' = 'read' and t.data->>'status' = 'approved' limit 1;
  select id into p1 from public.projects where deleted_at is null limit 1;
  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at) values
    (ext, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ext-ensayo-opor@example.com', now());

  n := public.oportunidades_reemplazar(p1, jsonb_build_array(
    jsonb_build_object('id', 'ens-a', 'projectId', p1, 'titulo', 'A', 'estado', 'nueva', 'updatedAt', '2099-01-01T00:00:00.000Z'),
    jsonb_build_object('id', 'ens-b', 'projectId', p1, 'titulo', 'B', 'estado', 'nueva'),
    jsonb_build_object('id', 'ens-x', 'projectId', 'otro', 'titulo', 'X', 'estado', 'nueva')));
  res := res || jsonb_build_object('s1_inserta_solo_del_proyecto', n,
    '_rls_forzado', (select relforcerowsecurity from pg_class where oid = 'public.project_opportunities'::regclass),
    '_en_realtime', exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'project_opportunities'),
    '_project_id', (select project_id from public.project_opportunities where id = 'ens-a') = p1);

  v := public.oportunidad_aplicar('ens-a', jsonb_build_object('estado', 'ofrecida', 'projectId', 'pisado', 'sf', jsonb_build_object('estado', 'ok')));
  res := res || jsonb_build_object('s2_mezcla', v->>'estado' = 'ofrecida' and v->>'titulo' = 'A' and v->>'projectId' = p1,
    's3_sello_sube_sobre_reloj_adelantado', v->>'updatedAt' > '2099-01-01T00:00:00.000Z');

  n := public.oportunidades_reemplazar(p1, jsonb_build_array(jsonb_build_object('id', 'ens-c', 'projectId', p1, 'titulo', 'C', 'estado', 'nueva')));
  res := res || jsonb_build_object('s4_regenerar_deja_la_ofrecida',
    (select count(*) from public.project_opportunities where project_id = p1 and deleted_at is null and id like 'ens-%') = 2
    and (select deleted_at is not null from public.project_opportunities where id = 'ens-b'));

  perform set_config('request.jwt.claims', json_build_object('sub', man, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.project_opportunities where id like 'ens-%'; res := res || jsonb_build_object('t1_equipo_lee', n);
  update public.project_opportunities set data = data || '{"estado":"descartada"}' where id = 'ens-c'; get diagnostics n = row_count; res := res || jsonb_build_object('t2_equipo_edita', n);
  begin insert into public.project_opportunities(id, data) values ('ens-d', jsonb_build_object('projectId', p1)); res := res || jsonb_build_object('t3_equipo_crea', 'ok'); exception when others then res := res || jsonb_build_object('t3_equipo_crea', 'FALLO ' || sqlerrm); end;
  begin delete from public.project_opportunities where id = 'ens-c'; res := res || jsonb_build_object('t4_delete_fisico', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('t4_delete_fisico', 'denegado ' || sqlstate); end;
  begin perform public.oportunidades_reemplazar(p1, '[]'); res := res || jsonb_build_object('t5_sesion_reemplaza', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('t5_sesion_reemplaza', 'denegado ' || sqlstate); end;
  begin perform public.oportunidad_aplicar('ens-a', '{}'); res := res || jsonb_build_object('t6_sesion_aplica', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('t6_sesion_aplica', 'denegado ' || sqlstate); end;
  execute 'reset role';

  if lec is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', lec, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.project_opportunities where id like 'ens-%'; res := res || jsonb_build_object('l1_lector_lee', n);
    update public.project_opportunities set data = data || '{"estado":"nueva"}' where id = 'ens-c'; get diagnostics n = row_count; res := res || jsonb_build_object('l2_lector_edita', n);
    begin insert into public.project_opportunities(id, data) values ('ens-e', '{}'); res := res || jsonb_build_object('l3_lector_crea', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('l3_lector_crea', 'denegado ' || sqlstate); end;
    execute 'reset role';
  else
    res := res || jsonb_build_object('l0_lector', 'no hay lector con cuenta');
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', ext, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.project_opportunities; res := res || jsonb_build_object('o1_ajeno_lee', n);
  update public.project_opportunities set data = '{}'; get diagnostics n = row_count; res := res || jsonb_build_object('o2_ajeno_edita', n);
  execute 'reset role';

  execute 'set local role anon';
  begin select count(*) into n from public.project_opportunities; res := res || jsonb_build_object('a1_anon_lee', 'PERMITIDO ' || n); exception when others then res := res || jsonb_build_object('a1_anon_lee', 'denegado ' || sqlstate); end;
  execute 'reset role';

  raise exception 'ENSAYO %', res;
end $t$;
