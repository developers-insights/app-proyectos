-- Ensayo de 2026-10-24-solo-el-equipo.sql: se corre concatenado DESPUÉS de la migración, en un
-- solo lote por la Management API. Termina en raise exception, así que todo (migración incluida)
-- se revierte; los resultados vienen en el mensaje del error. Ningún valor PERMITIDO/FALLO es OK.

do $t$
declare
  res jsonb := '{}';
  n int;
  b boolean;
  ext uuid := gen_random_uuid();
  unc uuid := gen_random_uuid();
  man uuid; lau uuid;
  tot_p int; tot_c int; tot_pl int; tot_tm int;
  lau_ids text[]; p_team text; p_lau text; q0 int; q1 int; tok text;
  ext_row jsonb := jsonb_build_object('id','auto-ext-ensayo-example-com','name','Ext','email','ext-ensayo@example.com','status','pending','access','project','assignedProjectId','');
begin
  select id into man from auth.users where lower(email)='manuelnavarro@insightsapps.tech';
  select id into lau from auth.users where lower(email)='lautaroggarcia.2003@gmail.com';
  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at) values
    (ext,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ext-ensayo@example.com', now()),
    (unc,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','agustinromero@insightsapps.tech', null);
  select count(*) into tot_p from projects; select count(*) into tot_c from clients; select count(*) into tot_pl from plans;
  select count(*) into tot_tm from team_members where deleted_at is null;
  select public.pm_ids_asignados(data) into lau_ids from team_members where id='auto-lautaroggarcia-2003-gmail-com';
  select id into p_lau from projects where id = any(lau_ids) and deleted_at is null limit 1;
  select id into p_team from projects where deleted_at is null and not (id = any(lau_ids)) limit 1;
  res := res || jsonb_build_object('_totales', jsonb_build_array(tot_p, tot_c, tot_pl, tot_tm), '_lau_ids', to_jsonb(lau_ids), '_p_lau', p_lau);

  perform set_config('request.jwt.claims', json_build_object('sub',ext,'role','authenticated','email','ext-ensayo@example.com')::text, true);
  execute 'set local role authenticated';
  begin insert into team_members(id,data) values ('x1', jsonb_build_object('email','ext-ensayo@example.com','status','approved','access','full')); res:=res||jsonb_build_object('o1_insert_aprobado','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o1_insert_aprobado','denegado '||sqlstate); end;
  begin insert into team_members(id,data) values ('x2', jsonb_build_object('email','ext-ensayo@example.com')); res:=res||jsonb_build_object('o2_insert_sin_status','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o2_insert_sin_status','denegado '||sqlstate); end;
  begin insert into team_members(id,data,updated_at) values ('auto-ext-ensayo-example-com', ext_row, now()); res:=res||jsonb_build_object('o3_alta_pendiente','ok'); exception when others then res:=res||jsonb_build_object('o3_alta_pendiente','FALLO '||sqlerrm); end;
  res := res || jsonb_build_object('o4_is_team', public.is_team());
  select count(*) into n from team_members; res := res || jsonb_build_object('o5_team_visible', n);
  select count(*) into n from projects; res := res || jsonb_build_object('o6_projects', n);
  select count(*) into n from clients; res := res || jsonb_build_object('o6_clients', n);
  select count(*) into n from plans; res := res || jsonb_build_object('o6_plans', n);
  select count(*) into n from client_surveys; res := res || jsonb_build_object('o6_surveys', n);
  update projects set data = jsonb_set(data,'{closerNotes}','[{"text":"phish"}]'); get diagnostics n = row_count; res := res || jsonb_build_object('o7_update_projects', n);
  begin insert into projects(id,data) values ('px', '{}'); res:=res||jsonb_build_object('o8_insert_project','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o8_insert_project','denegado '||sqlstate); end;
  update clients set data = jsonb_set(data,'{email}','"x@x.com"'); get diagnostics n = row_count; res := res || jsonb_build_object('o9_update_clients', n);
  begin insert into team_members(data,id,updated_at) values (ext_row || '{"lastSeenAt":"2026-10-24T20:00:00Z"}', 'auto-ext-ensayo-example-com', now()) on conflict (id) do update set data=excluded.data, id=excluded.id, updated_at=excluded.updated_at; res:=res||jsonb_build_object('o10_upsert_propio_lastSeen','ok'); exception when others then res:=res||jsonb_build_object('o10_upsert_propio_lastSeen','FALLO '||sqlerrm); end;
  begin insert into team_members(data,id,updated_at) values (ext_row || '{"status":"approved","access":"full"}', 'auto-ext-ensayo-example-com', now()) on conflict (id) do update set data=excluded.data, id=excluded.id, updated_at=excluded.updated_at; res:=res||jsonb_build_object('o11_upsert_autoaprobarse','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o11_upsert_autoaprobarse','denegado '||sqlstate); end;
  begin update team_members set data = data || '{"access":"collab","assignedProjectIds":["p1"]}' where id='auto-ext-ensayo-example-com'; res:=res||jsonb_build_object('o12_update_access','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o12_update_access','denegado '||sqlstate); end;
  begin update team_members set data = data || '{"email":"nachocachaza@insightsapps.tech"}' where id='auto-ext-ensayo-example-com'; res:=res||jsonb_build_object('o13_update_email','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o13_update_email','denegado '||sqlstate); end;
  update team_members set data = data || '{"status":"pending"}' where id='u3'; get diagnostics n = row_count; res := res || jsonb_build_object('o14_update_otro_miembro', n);
  begin insert into team_members(id,data) values ('x3', jsonb_build_object('email','otro@example.com','status','pending','access','project')); res:=res||jsonb_build_object('o15_insert_mail_ajeno','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o15_insert_mail_ajeno','denegado '||sqlstate); end;
  begin insert into plans(id,data) values ('plx','{}'); res:=res||jsonb_build_object('o16_insert_plan','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o16_insert_plan','denegado '||sqlstate); end;
  begin insert into client_surveys(project_id) values ('zz'); res:=res||jsonb_build_object('o17_insert_survey','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o17_insert_survey','denegado '||sqlstate); end;
  begin update team_members set deleted_at = now() where id='auto-ext-ensayo-example-com'; res:=res||jsonb_build_object('o18_tocar_deleted_at','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o18_tocar_deleted_at','denegado '||sqlstate); end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',unc,'role','authenticated','email','agustinromero@insightsapps.tech')::text, true);
  execute 'set local role authenticated';
  res := res || jsonb_build_object('u1_is_team_sin_confirmar', public.is_team());
  select count(*) into n from projects; res := res || jsonb_build_object('u2_projects', n);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',man,'role','authenticated','email','manuelnavarro@insightsapps.tech')::text, true);
  execute 'set local role authenticated';
  res := res || jsonb_build_object('t1_is_team', public.is_team());
  select count(*) into n from projects; res := res || jsonb_build_object('t2_projects', n);
  select count(*) into n from clients; res := res || jsonb_build_object('t2_clients', n);
  select count(*) into n from plans; res := res || jsonb_build_object('t2_plans', n);
  select count(*) into n from team_members where deleted_at is null; res := res || jsonb_build_object('t2_team_vivos', n);
  execute 'reset role'; select count(*) into q0 from net.http_request_queue; execute 'set local role authenticated';
  update projects set data = jsonb_set(data,'{closerNotes}', coalesce(data->'closerNotes','[]'::jsonb) || '[{"text":"ensayo"}]') where id = p_team; get diagnostics n = row_count; res := res || jsonb_build_object('t3_update_project', n);
  update projects set data = jsonb_set(data,'{closerNotes}', coalesce(data->'closerNotes','[]'::jsonb) || '[{"text":"ensayo2"}]') where id = p_team;
  execute 'reset role';
  select count(*) into q1 from net.http_request_queue; select pendiente into b from sf_puente_cola where project_id = p_team;
  res := res || jsonb_build_object('sf1_avisos_por_2_cambios_seguidos', q1 - q0, 'sf1_quedo_pendiente', b);
  update sf_puente_cola set ultimo_envio = clock_timestamp() - interval '31 seconds' where project_id = p_team;
  res := res || jsonb_build_object('sf2_vaciar_envia', public.sf_puente_vaciar());
  select count(*) into n from net.http_request_queue; res := res || jsonb_build_object('sf2_avisos_total', n - q0);
  res := res || jsonb_build_object('sf3_vaciar_otra_vez', public.sf_puente_vaciar());
  execute 'set local role authenticated';
  begin insert into clients(id,data,updated_at) values ('cl-ensayo','{"id":"cl-ensayo","name":"Ensayo"}',now()); res:=res||jsonb_build_object('t4_insert_client','ok'); exception when others then res:=res||jsonb_build_object('t4_insert_client','FALLO '||sqlerrm); end;
  begin insert into team_members(data,id,updated_at) values (ext_row || '{"status":"approved","assignedProjectId":"p1"}', 'auto-ext-ensayo-example-com', now()) on conflict (id) do update set data=excluded.data, id=excluded.id, updated_at=excluded.updated_at; res:=res||jsonb_build_object('t5_aprobar_pendiente','ok'); exception when others then res:=res||jsonb_build_object('t5_aprobar_pendiente','FALLO '||sqlerrm); end;
  begin insert into team_members(id,data,updated_at) values ('nuevo1', '{"id":"nuevo1","name":"Nuevo","email":"nuevo@example.com","status":"approved","access":"full"}', now()); res:=res||jsonb_build_object('t6_alta_por_equipo','ok'); exception when others then res:=res||jsonb_build_object('t6_alta_por_equipo','FALLO '||sqlerrm); end;
  begin insert into client_surveys(project_id, created_by) values (p_team, 'u3') returning token into tok; select count(*) into n from client_surveys; res:=res||jsonb_build_object('t7_survey_insert_y_lee', n); exception when others then res:=res||jsonb_build_object('t7_survey','FALLO '||sqlerrm); end;
  begin update team_members set deleted_at = now() where id = 'nuevo1'; get diagnostics n = row_count; res:=res||jsonb_build_object('t8_baja_por_equipo', n); exception when others then res:=res||jsonb_build_object('t8_baja','FALLO '||sqlerrm); end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',lau,'role','authenticated','email','lautaroggarcia.2003@gmail.com')::text, true);
  execute 'set local role authenticated';
  res := res || jsonb_build_object('c1_is_team', public.is_team());
  select count(*) into n from projects; res := res || jsonb_build_object('c2_projects', n);
  select count(*) into n from clients; res := res || jsonb_build_object('c3_clients', n);
  select count(*) into n from plans; res := res || jsonb_build_object('c3_plans', n);
  update projects set data = data || '{"ensayo":1}' where id = p_lau; get diagnostics n = row_count; res := res || jsonb_build_object('c4_update_su_proyecto', n);
  update projects set data = data || '{"ensayo":1}' where id = p_team; get diagnostics n = row_count; res := res || jsonb_build_object('c5_update_ajeno', n);
  update clients set data = data || '{"ensayo":1}' where id = any(public.pm_clientes(true)); get diagnostics n = row_count; res := res || jsonb_build_object('c5b_update_su_cliente', n);
  select count(*) into n from client_surveys; res := res || jsonb_build_object('c6_surveys', n);
  select count(*) into n from team_members where deleted_at is null; res := res || jsonb_build_object('c7_team_vivos', n);
  begin insert into team_members(id,data) values ('x4', '{"id":"x4","name":"Amigo","email":"amigo@example.com","status":"approved","access":"full"}'); res:=res||jsonb_build_object('c8_alta_de_otro','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c8_alta_de_otro','denegado '||sqlstate); end;
  select data into ext_row from team_members where id='auto-lautaroggarcia-2003-gmail-com';
  begin insert into team_members(data,id,updated_at) values (ext_row || '{"lastSeenAt":"2026-10-24T20:00:00Z"}', 'auto-lautaroggarcia-2003-gmail-com', now()) on conflict (id) do update set data=excluded.data, id=excluded.id, updated_at=excluded.updated_at; res:=res||jsonb_build_object('c9_upsert_propio','ok'); exception when others then res:=res||jsonb_build_object('c9_upsert_propio','FALLO '||sqlerrm); end;
  begin update team_members set data = data || '{"access":"full"}' where id='auto-lautaroggarcia-2003-gmail-com'; res:=res||jsonb_build_object('c10_subirse_a_full','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c10_subirse_a_full','denegado '||sqlstate); end;
  begin insert into team_members(data,id,updated_at) values (ext_row || '{"access":"full"}', 'auto-lautaroggarcia-2003-gmail-com', now()) on conflict (id) do update set data=excluded.data, id=excluded.id, updated_at=excluded.updated_at; res:=res||jsonb_build_object('c12_upsert_a_full','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c12_upsert_a_full','denegado '||sqlstate); end;
  begin insert into team_members(data,id,updated_at) values (jsonb_set(ext_row,'{assignedProjectIds}','["p-otro"]'), 'auto-lautaroggarcia-2003-gmail-com', now()) on conflict (id) do update set data=excluded.data, id=excluded.id, updated_at=excluded.updated_at; res:=res||jsonb_build_object('c13_upsert_otros_proyectos','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c13_upsert_otros_proyectos','denegado '||sqlstate); end;
  begin insert into team_members(data,id,updated_at) values (ext_row, 'x-copia-identica', now()); res:=res||jsonb_build_object('c14_copia_aprobada_otro_id','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c14_copia_aprobada_otro_id','denegado '||sqlstate); end;
  begin insert into plans(id,data,updated_at) values ('pl-ensayo','{"id":"pl-ensayo"}',now()); res:=res||jsonb_build_object('c11_insert_plan','ok'); exception when others then res:=res||jsonb_build_object('c11_insert_plan','FALLO '||sqlerrm); end;
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  begin insert into team_members(id,data,updated_at,deleted_at) values ('auto-svc-ensayo','{"email":"svc@example.com","status":"pending","access":"project"}',now(),null) on conflict (id) do update set data=excluded.data, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at; res:=res||jsonb_build_object('s1_register_user','ok'); exception when others then res:=res||jsonb_build_object('s1_register_user','FALLO '||sqlerrm); end;
  begin insert into clients(id,data,updated_at) values ('cl-svc','{}',now()); insert into projects(id,data,updated_at) values ('pr-svc','{"name":"x"}',now()); res:=res||jsonb_build_object('s2_onboarding_signup','ok'); exception when others then res:=res||jsonb_build_object('s2_onboarding_signup','FALLO '||sqlerrm); end;
  select count(*) into n from projects; res := res || jsonb_build_object('s3_service_lee_projects', n);
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  res := res || jsonb_build_object('a1_survey_get', public.survey_public_get(tok)->'ok', 'a1_survey_project_ok', (public.survey_public_get(tok)->>'project') <> '');
  res := res || jsonb_build_object('a2_survey_save', public.survey_public_save(tok, '{"q1":"si"}', 'es', false)->'ok');
  begin select count(*) into n from projects; res:=res||jsonb_build_object('a3_anon_projects','PERMITIDO '||n); exception when others then res:=res||jsonb_build_object('a3_anon_projects','denegado '||sqlstate); end;
  begin perform public.is_team(); res:=res||jsonb_build_object('a4_anon_is_team','PERMITIDO'); exception when others then res:=res||jsonb_build_object('a4_anon_is_team','denegado '||sqlstate); end;
  execute 'reset role';

  raise exception 'RESULTADOS %', res;
end
$t$;
