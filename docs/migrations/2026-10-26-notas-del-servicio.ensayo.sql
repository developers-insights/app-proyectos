-- Ensayo de 2026-10-26-notas-del-servicio.sql: se corre concatenado DESPUÉS de la migración,
-- en un solo lote por la Management API. Termina en raise exception, así que todo se revierte
-- (tabla incluida); los resultados vienen en el mensaje del error. Ningún valor PERMITIDO/FALLO
-- es OK, y todo conteo de alguien que no es del equipo tiene que dar 0.
do $t$
declare
  res jsonb := '{}';
  n int;
  ext uuid := gen_random_uuid();
  man uuid; lau uuid; portal uuid; portal_mail text;
  p1 text; nota uuid;
begin
  select id into man from auth.users where lower(email) = 'manuelnavarro@insightsapps.tech';
  select id into lau from auth.users where lower(email) = 'lautaroggarcia.2003@gmail.com';
  select u.id, u.email into portal, portal_mail
    from public.team_members t join auth.users u on lower(u.email) = lower(t.data->>'email')
   where t.deleted_at is null and t.data->>'access' = 'project' and u.email_confirmed_at is not null
   limit 1;
  select id into p1 from public.projects where deleted_at is null limit 1;
  if portal is null then
    portal := gen_random_uuid();
    portal_mail := 'portal-ensayo-notas@example.com (simulado)';
    insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at) values
      (portal, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'portal-ensayo-notas@example.com', now());
    insert into public.team_members(id, data, updated_at) values ('portal-ensayo-notas',
      jsonb_build_object('id', 'portal-ensayo-notas', 'email', 'portal-ensayo-notas@example.com', 'status', 'approved', 'access', 'project', 'assignedProjectId', p1), now());
  end if;
  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at) values
    (ext, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ext-ensayo-notas@example.com', now());
  insert into public.project_service_notes(project_id, type, body) values (p1, 'call', 'nota sembrada por el ensayo') returning id into nota;
  res := res || jsonb_build_object('_portal_probado', coalesce(portal_mail, 'no hay cliente de portal con cuenta'), '_rls_forzado',
    (select relforcerowsecurity from pg_class where oid = 'public.project_service_notes'::regclass),
    '_en_realtime', exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'project_service_notes'));

  perform set_config('request.jwt.claims', json_build_object('sub', man, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.project_service_notes; res := res || jsonb_build_object('t1_equipo_lee', n);
  begin insert into public.project_service_notes(project_id, type, body, answers, author_id) values (p1, 'onboarding', 'ensayo', '{"porQueAhora":"x"}', 'u3'); res := res || jsonb_build_object('t2_equipo_crea', 'ok'); exception when others then res := res || jsonb_build_object('t2_equipo_crea', 'FALLO ' || sqlerrm); end;
  update public.project_service_notes set pinned = true, updated_at = now() where id = nota; get diagnostics n = row_count; res := res || jsonb_build_object('t3_equipo_fija', n);
  update public.project_service_notes set deleted_at = now() where id = nota; get diagnostics n = row_count; res := res || jsonb_build_object('t4_equipo_borra_suave', n);
  update public.project_service_notes set deleted_at = null where id = nota; get diagnostics n = row_count; res := res || jsonb_build_object('t5_equipo_deshace', n);
  begin delete from public.project_service_notes where id = nota; res := res || jsonb_build_object('t6_delete_fisico', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('t6_delete_fisico', 'denegado ' || sqlstate); end;
  begin insert into public.project_service_notes(project_id, type, body) values (p1, 'raro', 'x'); res := res || jsonb_build_object('t7_tipo_invalido', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('t7_tipo_invalido', 'denegado ' || sqlstate); end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', ext, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.project_service_notes; res := res || jsonb_build_object('o1_ajeno_lee', n);
  begin insert into public.project_service_notes(project_id, body) values (p1, 'x'); res := res || jsonb_build_object('o2_ajeno_crea', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('o2_ajeno_crea', 'denegado ' || sqlstate); end;
  update public.project_service_notes set body = 'pisado'; get diagnostics n = row_count; res := res || jsonb_build_object('o3_ajeno_edita', n);
  execute 'reset role';

  if lau is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', lau, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.project_service_notes; res := res || jsonb_build_object('c1_colaborador_lee', n);
    execute 'reset role';
  end if;

  if portal is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', portal, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.project_service_notes; res := res || jsonb_build_object('p1_portal_lee', n);
    update public.project_service_notes set body = 'pisado'; get diagnostics n = row_count; res := res || jsonb_build_object('p2_portal_edita', n);
    execute 'reset role';
  end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin select count(*) into n from public.project_service_notes; res := res || jsonb_build_object('a1_anon_lee', 'PERMITIDO ' || n); exception when others then res := res || jsonb_build_object('a1_anon_lee', 'denegado ' || sqlstate); end;
  begin insert into public.project_service_notes(project_id, body) values (p1, 'x'); res := res || jsonb_build_object('a2_anon_crea', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('a2_anon_crea', 'denegado ' || sqlstate); end;
  execute 'reset role';

  raise exception 'RESULTADOS %', res;
end
$t$;
