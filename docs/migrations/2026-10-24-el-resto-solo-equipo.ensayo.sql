-- Ensayo de 2026-10-24-el-resto-solo-equipo.sql: se corre concatenado DESPUÉS de la migración,
-- en un solo lote por la Management API. Termina en raise exception, así que todo se revierte;
-- los resultados vienen en el mensaje del error. Ningún valor PERMITIDO/FALLO es OK, y en
-- "ajeno" todo conteo de tabla privada tiene que dar 0.
do $t$
declare
  res jsonb := '{}';
  n int;
  v text;
  ext uuid := gen_random_uuid();
  man uuid; lau uuid;
  lau_ids text[]; lau_member text[]; lau_planes text[]; p_lau text; p_otro text; plan_otro text;
  tablas text[] := array['tasks','activity','app_state','app_secrets','calls','sops_categories','sops_processes','assistant_chats','editor_projects','videos','mvps','fathom_calls','wa_alerts','wa_finanzas_preguntas','wa_groups','wa_messages','wa_status','wa_team_numbers'];
  tot jsonb := '{}';
  t text;
  exp_tasks int; exp_groups int;
  pn uuid;
begin
  select id into man from auth.users where lower(email)='manuelnavarro@insightsapps.tech';
  select id into lau from auth.users where lower(email)='lautaroggarcia.2003@gmail.com';
  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at) values
    (ext,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ext-ensayo@example.com', now());
  foreach t in array tablas loop
    execute format('select count(*) from public.%I', t) into n; tot := tot || jsonb_build_object(t, n);
  end loop;
  select public.pm_ids_asignados(data) into lau_ids from team_members where id='auto-lautaroggarcia-2003-gmail-com';
  lau_member := array['auto-lautaroggarcia-2003-gmail-com'];
  select coalesce(array_agg(data->>'planId') filter (where coalesce(data->>'planId','')<>''), '{}') into lau_planes from projects where id = any(lau_ids) and deleted_at is null;
  select id into p_lau from projects where id = any(lau_ids) and deleted_at is null limit 1;
  select id into p_otro from projects where deleted_at is null and not (id = any(lau_ids)) limit 1;
  select id into plan_otro from plans where deleted_at is null and not (id = any(lau_planes)) limit 1;
  select count(*) into exp_tasks from tasks where data->>'projectId' = any(lau_ids) or (coalesce(data->>'projectId','')='' and data->>'assigneeId' = any(lau_member));
  select count(*) into exp_groups from wa_groups where project_id = any(lau_ids);
  insert into plan_notes(slug, week, author, body) values ((select slug from published_plans where not (coalesce(data->>'id','') = any(lau_planes)) limit 1), 1, 'Cliente', 'nota de ensayo') returning id into pn;
  res := res || jsonb_build_object('_totales', tot, '_lau_planes', to_jsonb(lau_planes), '_esperado_lau_tasks', exp_tasks, '_esperado_lau_wa_groups', exp_groups);

  perform set_config('request.jwt.claims', json_build_object('sub',ext,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  v := '';
  foreach t in array tablas loop
    execute format('select count(*) from public.%I', t) into n; if n > 0 then v := v || t || '=' || n || ' '; end if;
  end loop;
  res := res || jsonb_build_object('o1_tablas_privadas_con_filas', coalesce(nullif(v,''), 'ninguna'));
  select count(*) into n from published_plans; res := res || jsonb_build_object('o2_published_plans_publico', n);
  begin insert into tasks(id,data) values ('tx', '{"projectId":""}'); res:=res||jsonb_build_object('o3_insert_task','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o3_insert_task','denegado '||sqlstate); end;
  begin perform public.carousel_token(); res:=res||jsonb_build_object('o4_carousel_token','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o4_carousel_token','denegado '||sqlstate); end;
  begin insert into published_plans(slug,data) values ('zz-ensayo','{"id":"x"}'); res:=res||jsonb_build_object('o5_publicar_plan','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o5_publicar_plan','denegado '||sqlstate); end;
  update published_plans set data = data || '{"x":1}'; get diagnostics n = row_count; res := res || jsonb_build_object('o6_pisar_planes_publicados', n);
  update plan_notes set read = true; get diagnostics n = row_count; res := res || jsonb_build_object('o7_marcar_notas', n);
  begin perform public.delete_plan_note(pn); res:=res||jsonb_build_object('o8_borrar_nota','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o8_borrar_nota','denegado '||sqlstate); end;
  begin insert into activity(id,data) values ('ax','{"actorId":"u3"}'); res:=res||jsonb_build_object('o9_insert_activity','PERMITIDO'); exception when others then res:=res||jsonb_build_object('o9_insert_activity','denegado '||sqlstate); end;
  update wa_groups set active = false; get diagnostics n = row_count; res := res || jsonb_build_object('o10_update_wa_groups', n);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',man,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  v := '';
  foreach t in array tablas loop
    execute format('select count(*) from public.%I', t) into n; if n <> (tot->>t)::int then v := v || t || '=' || n || '/' || (tot->>t) || ' '; end if;
  end loop;
  res := res || jsonb_build_object('t1_tablas_con_menos_filas', coalesce(nullif(v,''), 'ninguna'));
  res := res || jsonb_build_object('t2_carousel_token', public.carousel_token() is not null);
  begin insert into tasks(id,data,updated_at) values ('t-ensayo','{"id":"t-ensayo","projectId":""}',now()); res:=res||jsonb_build_object('t3_insert_task','ok'); exception when others then res:=res||jsonb_build_object('t3_insert_task','FALLO '||sqlerrm); end;
  update published_plans set updated_at = updated_at where slug = (select slug from published_plans limit 1); get diagnostics n = row_count; res := res || jsonb_build_object('t4_update_publicado', n);
  update plan_notes set read = read where id = pn; get diagnostics n = row_count; res := res || jsonb_build_object('t5_marcar_nota', n);
  res := res || jsonb_build_object('t6_borrar_nota', public.delete_plan_note(pn));
  update wa_groups set active = active where id = (select id from wa_groups limit 1); get diagnostics n = row_count; res := res || jsonb_build_object('t7_update_wa_groups', n);
  begin insert into activity(id,data,updated_at) values ('a-ensayo','{"actorId":"u3"}',now()); res:=res||jsonb_build_object('t8_insert_activity','ok'); exception when others then res:=res||jsonb_build_object('t8_insert_activity','FALLO '||sqlerrm); end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',lau,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from tasks; res := res || jsonb_build_object('c1_tasks', n);
  select count(*) into n from wa_groups; res := res || jsonb_build_object('c2_wa_groups', n);
  v := '';
  foreach t in array array['app_state','app_secrets','calls','sops_categories','sops_processes','assistant_chats','editor_projects','videos','mvps','fathom_calls','wa_alerts','wa_messages','wa_status','wa_team_numbers','wa_finanzas_preguntas'] loop
    execute format('select count(*) from public.%I', t) into n; if n > 0 then v := v || t || '=' || n || ' '; end if;
  end loop;
  res := res || jsonb_build_object('c3_tablas_de_equipo_con_filas', coalesce(nullif(v,''), 'ninguna'));
  begin insert into tasks(id,data,updated_at) values ('t-lau', jsonb_build_object('id','t-lau','projectId',p_lau,'assigneeId','auto-lautaroggarcia-2003-gmail-com'), now()); res:=res||jsonb_build_object('c4_task_su_proyecto','ok'); exception when others then res:=res||jsonb_build_object('c4_task_su_proyecto','FALLO '||sqlerrm); end;
  begin insert into tasks(id,data,updated_at) values ('t-lau2', jsonb_build_object('id','t-lau2','projectId','','assigneeId','auto-lautaroggarcia-2003-gmail-com'), now()); res:=res||jsonb_build_object('c5_task_sin_proyecto_suya','ok'); exception when others then res:=res||jsonb_build_object('c5_task_sin_proyecto_suya','FALLO '||sqlerrm); end;
  begin insert into tasks(id,data,updated_at) values ('t-lau3', jsonb_build_object('id','t-lau3','projectId',p_otro), now()); res:=res||jsonb_build_object('c6_task_proyecto_ajeno','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c6_task_proyecto_ajeno','denegado '||sqlstate); end;
  begin update tasks set data = jsonb_set(data,'{projectId}',to_jsonb(p_otro)) where id='t-lau'; res:=res||jsonb_build_object('c7_mover_task_a_ajeno','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c7_mover_task_a_ajeno','denegado '||sqlstate); end;
  begin insert into activity(id,data,updated_at) values ('a-lau','{"actorId":"auto-lautaroggarcia-2003-gmail-com"}',now()); res:=res||jsonb_build_object('c8_activity_propia','ok'); exception when others then res:=res||jsonb_build_object('c8_activity_propia','FALLO '||sqlerrm); end;
  begin insert into activity(id,data,updated_at) values ('a-lau2','{"actorId":"u7"}',now()); res:=res||jsonb_build_object('c9_activity_como_otro','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c9_activity_como_otro','denegado '||sqlstate); end;
  update plan_notes set read = true where id = pn; get diagnostics n = row_count; res := res || jsonb_build_object('c13_marcar_nota_ajena', n);
  begin perform public.delete_plan_note(pn); res:=res||jsonb_build_object('c14_borrar_nota_ajena','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c14_borrar_nota_ajena','denegado '||sqlstate); end;
  begin perform public.carousel_token(); res:=res||jsonb_build_object('c10_carousel_token','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c10_carousel_token','denegado '||sqlstate); end;
  if cardinality(lau_planes) > 0 then
    begin insert into published_plans(slug,data,updated_at) values ('lau-ensayo', jsonb_build_object('id', lau_planes[1]), now()) on conflict (slug) do update set data=excluded.data; res:=res||jsonb_build_object('c11_publicar_su_plan','ok'); exception when others then res:=res||jsonb_build_object('c11_publicar_su_plan','FALLO '||sqlerrm); end;
  end if;
  begin insert into published_plans(slug,data,updated_at) values ('otro-ensayo', jsonb_build_object('id', plan_otro), now()); res:=res||jsonb_build_object('c12_publicar_plan_ajeno','PERMITIDO'); exception when others then res:=res||jsonb_build_object('c12_publicar_plan_ajeno','denegado '||sqlstate); end;
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from published_plans; res := res || jsonb_build_object('a1_published_plans', n);
  select count(*) into n from plan_notes; res := res || jsonb_build_object('a2_plan_notes', n);
  select count(*) into n from plan_acceptances; res := res || jsonb_build_object('a3_plan_acceptances', n);
  begin insert into plan_notes(slug, week, author, body) values ((select slug from published_plans limit 1), 1, 'Cliente', 'nota de ensayo'); res:=res||jsonb_build_object('a4_nota_publica','ok'); exception when others then res:=res||jsonb_build_object('a4_nota_publica','FALLO '||sqlerrm); end;
  begin insert into published_plans(slug,data) values ('anon-ensayo','{}'); res:=res||jsonb_build_object('a5_publicar','PERMITIDO'); exception when others then res:=res||jsonb_build_object('a5_publicar','denegado '||sqlstate); end;
  begin select count(*) into n from tasks; res:=res||jsonb_build_object('a6_tasks','PERMITIDO '||n); exception when others then res:=res||jsonb_build_object('a6_tasks','denegado '||sqlstate); end;
  begin select count(*) into n from wa_groups; res:=res||jsonb_build_object('a7_wa_groups','PERMITIDO '||n); exception when others then res:=res||jsonb_build_object('a7_wa_groups','denegado '||sqlstate); end;
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  select count(*) into n from wa_messages; res := res || jsonb_build_object('s1_bot_lee_wa_messages', n = (tot->>'wa_messages')::int);
  select count(*) into n from app_secrets; res := res || jsonb_build_object('s2_service_lee_app_secrets', n);
  execute 'reset role';

  raise exception 'RESULTADOS %', res;
end
$t$;
