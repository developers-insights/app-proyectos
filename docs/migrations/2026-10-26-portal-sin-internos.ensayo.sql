-- Ensayo de 2026-10-26-portal-sin-internos.sql: se corre concatenado DESPUÉS de la migración,
-- en un solo lote por la Management API. Termina en raise exception, así que todo (migración y
-- usuarios de prueba incluidos) se revierte; los resultados vienen en el mensaje del error.
-- Corrido solo (sin la migración) muestra cómo estaba antes.
-- Como no hay clientes del portal reales, crea dos dentro de la transacción: uno aprobado con
-- un proyecto que tiene notas internas, contraseña de share y plan, y uno pendiente.

do $t$
declare
  res jsonb := '{}';
  n int;
  j jsonb;
  txt text;
  por uuid := gen_random_uuid();
  pen uuid := gen_random_uuid();
  man uuid; lau uuid;
  tot_p int; tot_c int; tot_pl int; tot_tm int;
  lau_ids text[]; p_portal text; c_portal text;
begin
  select id into man from auth.users where lower(email) = 'manuelnavarro@insightsapps.tech';
  select id into lau from auth.users where lower(email) = 'lautaroggarcia.2003@gmail.com';
  select public.pm_ids_asignados(data) into lau_ids from team_members where id = 'auto-lautaroggarcia-2003-gmail-com';
  select count(*) into tot_p from projects; select count(*) into tot_c from clients; select count(*) into tot_pl from plans;
  select count(*) into tot_tm from team_members;

  -- El proyecto más "cargado": con contraseña de share, plan y notas internas, si existe.
  select p.id, p.data->>'clientId' into p_portal, c_portal
  from projects p
  where p.deleted_at is null and coalesce(p.data->>'planId', '') <> ''
  order by (p.data ? 'sharePassword') desc, (jsonb_array_length(coalesce(p.data->'scopeNotes', '[]')) > 0) desc, p.id
  limit 1;
  -- Notas para el closer y monto de mantenimiento seguros dentro del ensayo (se revierten).
  update projects set data = data
    || jsonb_build_object('closerNotes', coalesce(data->'closerNotes', '[]'::jsonb) || '[{"text":"NOTA-INTERNA-ENSAYO"}]'::jsonb)
    || jsonb_build_object('sharePassword', coalesce(data->>'sharePassword', 'clave-ensayo'))
    || jsonb_build_object('lifecycle', coalesce(data->'lifecycle', '{}'::jsonb) || '{"maintenanceAmount":97}'::jsonb)
  where id = p_portal;

  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at) values
    (por, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'portal-ensayo@example.com', now()),
    (pen, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pendiente-ensayo@example.com', now());
  insert into team_members(id, data, updated_at) values
    ('auto-portal-ensayo', jsonb_build_object('id','auto-portal-ensayo','name','Portal','email','portal-ensayo@example.com','status','approved','access','project','assignedProjectId', p_portal), now()),
    ('auto-pendiente-ensayo', jsonb_build_object('id','auto-pendiente-ensayo','name','Pend','email','pendiente-ensayo@example.com','status','pending','access','project','assignedProjectId', p_portal), now());
  res := res || jsonb_build_object('_totales', jsonb_build_array(tot_p, tot_c, tot_pl, tot_tm), '_p_portal', p_portal, '_lau_ids', to_jsonb(lau_ids));

  -- Cliente del portal aprobado
  perform set_config('request.jwt.claims', json_build_object('sub', por, 'role', 'authenticated', 'email', 'portal-ensayo@example.com')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from projects; res := res || jsonb_build_object('p1_projects_directo', n);
  select count(*) into n from clients; res := res || jsonb_build_object('p1_clients_directo', n);
  select count(*) into n from plans; res := res || jsonb_build_object('p1_plans_directo', n);
  select count(*) into n from team_members; res := res || jsonb_build_object('p2_team_visible', n);
  begin
    j := public.portal_projects();
    txt := j::text;
    res := res || jsonb_build_object(
      'p3_rpc_cantidad', jsonb_array_length(j),
      'p3_rpc_ids', (select jsonb_agg(e->'id') from jsonb_array_elements(j) e),
      'p3_rpc_claves', (select jsonb_agg(distinct k) from jsonb_array_elements(j) e, jsonb_object_keys(e) k),
      'p3_rpc_claves_tarea', (select jsonb_agg(distinct k) from jsonb_array_elements(j) e, jsonb_array_elements(e->'plan'->'weeks') w, jsonb_array_elements(w->'tasks') tk, jsonb_object_keys(tk) k),
      'p3_rpc_semanas', (select jsonb_array_length(e->'plan'->'weeks') from jsonb_array_elements(j) e limit 1),
      'p3_rpc_company', (select e->'company' from jsonb_array_elements(j) e limit 1),
      'p4_fuga_closerNotes', txt like '%NOTA-INTERNA-ENSAYO%' or txt like '%closerNotes%',
      'p4_fuga_scopeNotes', txt like '%scopeNotes%',
      'p4_fuga_sharePassword', txt like '%sharePassword%',
      'p4_fuga_montos', txt ~ '(totalAmount|paidAmount|maintenanceAmount|billingDay)',
      'p4_fuga_otros', txt ~ '(vault|accounts|upsell|githubRepo|whatsappUrl|riesgo|bloqueo|responsable)'
    );
  exception when others then res := res || jsonb_build_object('p3_rpc', 'FALLO ' || sqlstate || ' ' || sqlerrm);
  end;
  update projects set data = data || '{"ensayo":1}' where id = p_portal; get diagnostics n = row_count; res := res || jsonb_build_object('p5_update_su_proyecto', n);
  update clients set data = data || '{"ensayo":1}' where id = c_portal; get diagnostics n = row_count; res := res || jsonb_build_object('p5_update_su_cliente', n);
  begin update team_members set data = data || '{"access":"full"}' where id = 'auto-portal-ensayo'; res := res || jsonb_build_object('p6_subirse_a_full', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('p6_subirse_a_full', 'denegado ' || sqlstate); end;
  begin update team_members set data = data || '{"assignedProjectId":"otro"}' where id = 'auto-portal-ensayo'; res := res || jsonb_build_object('p7_cambiar_proyecto', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('p7_cambiar_proyecto', 'denegado ' || sqlstate); end;
  execute 'reset role';

  -- Cliente del portal pendiente
  perform set_config('request.jwt.claims', json_build_object('sub', pen, 'role', 'authenticated', 'email', 'pendiente-ensayo@example.com')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from projects; res := res || jsonb_build_object('q1_pendiente_projects', n);
  begin res := res || jsonb_build_object('q2_pendiente_rpc', jsonb_array_length(public.portal_projects())); exception when others then res := res || jsonb_build_object('q2_pendiente_rpc', 'FALLO ' || sqlstate); end;
  execute 'reset role';

  -- Equipo
  perform set_config('request.jwt.claims', json_build_object('sub', man, 'role', 'authenticated', 'email', 'manuelnavarro@insightsapps.tech')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from projects; res := res || jsonb_build_object('t1_projects', n);
  select count(*) into n from clients; res := res || jsonb_build_object('t1_clients', n);
  select count(*) into n from plans; res := res || jsonb_build_object('t1_plans', n);
  select count(*) into n from team_members; res := res || jsonb_build_object('t1_team', n);
  select count(*) into n from projects where id = p_portal and data ? 'closerNotes' and data ? 'sharePassword'; res := res || jsonb_build_object('t2_ve_internos', n);
  update projects set data = data || '{"ensayo":1}' where id = p_portal; get diagnostics n = row_count; res := res || jsonb_build_object('t3_update', n);
  begin res := res || jsonb_build_object('t4_rpc', jsonb_array_length(public.portal_projects())); exception when others then res := res || jsonb_build_object('t4_rpc', 'FALLO ' || sqlstate); end;
  execute 'reset role';

  -- Colaborador
  perform set_config('request.jwt.claims', json_build_object('sub', lau, 'role', 'authenticated', 'email', 'lautaroggarcia.2003@gmail.com')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from projects; res := res || jsonb_build_object('c1_projects', n);
  select count(*) into n from clients; res := res || jsonb_build_object('c1_clients', n);
  select count(*) into n from plans; res := res || jsonb_build_object('c1_plans', n);
  select count(*) into n from team_members; res := res || jsonb_build_object('c1_team', n);
  update projects set data = data || '{"ensayo":1}' where id = any(lau_ids); get diagnostics n = row_count; res := res || jsonb_build_object('c2_update_suyos', n);
  begin res := res || jsonb_build_object('c3_rpc', jsonb_array_length(public.portal_projects())); exception when others then res := res || jsonb_build_object('c3_rpc', 'FALLO ' || sqlstate); end;
  execute 'reset role';

  -- anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin select count(*) into n from projects; res := res || jsonb_build_object('a1_projects', 'PERMITIDO ' || n); exception when others then res := res || jsonb_build_object('a1_projects', 'denegado ' || sqlstate); end;
  begin perform public.portal_projects(); res := res || jsonb_build_object('a2_rpc', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('a2_rpc', 'denegado ' || sqlstate); end;
  select count(*) into n from published_plans; res := res || jsonb_build_object('a3_published_plans', n);
  execute 'reset role';

  raise exception 'RESULTADOS %', res;
end
$t$;
