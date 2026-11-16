-- Ensayo de 2026-11-16-logos-de-proyectos.sql: se corre concatenado DESPUÉS de la migración, en un
-- solo lote por la Management API. Termina en raise exception, así que todo se revierte (bucket y
-- políticas incluidos); los resultados vienen en el mensaje del error. Ningún PERMITIDO es OK y todo
-- conteo de alguien de afuera del equipo tiene que dar 0.
do $t$
declare
  res jsonb := '{}';
  n int;
  ext uuid := gen_random_uuid();
  man uuid; lec uuid;
begin
  select id into man from auth.users where lower(email) = 'manuelnavarro@insightsapps.tech';
  select u.id into lec from public.team_members t join auth.users u on lower(u.email) = lower(t.data->>'email')
   where t.deleted_at is null and t.data->>'access' = 'read' and t.data->>'status' = 'approved' limit 1;
  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at) values
    (ext, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ext-ensayo-logos@example.com', now());
  res := res || jsonb_build_object('_bucket_privado', (select not public from storage.buckets where id = 'project-logos'),
    '_limite', (select file_size_limit from storage.buckets where id = 'project-logos'),
    '_sin_svg', (select not ('image/svg+xml' = any(allowed_mime_types)) from storage.buckets where id = 'project-logos'));

  perform set_config('request.jwt.claims', json_build_object('sub', man, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin insert into storage.objects(bucket_id, name, owner) values ('project-logos', 'ens/aaaaaaaaaaaaaaaa.webp', man); res := res || jsonb_build_object('t1_equipo_sube', 'ok'); exception when others then res := res || jsonb_build_object('t1_equipo_sube', 'FALLO ' || sqlerrm); end;
  select count(*) into n from storage.objects where bucket_id = 'project-logos' and name like 'ens/%'; res := res || jsonb_build_object('t2_equipo_lee', n);
  update storage.objects set metadata = '{"x":1}' where bucket_id = 'project-logos' and name like 'ens/%'; get diagnostics n = row_count; res := res || jsonb_build_object('t3_equipo_cambia', n);
  begin insert into storage.objects(bucket_id, name, owner) values ('wa-media', 'ens/no.webp', man); res := res || jsonb_build_object('t4_equipo_otro_bucket', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('t4_equipo_otro_bucket', 'denegado ' || sqlstate); end;
  execute 'reset role';

  if lec is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', lec, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from storage.objects where bucket_id = 'project-logos' and name like 'ens/%'; res := res || jsonb_build_object('l1_lector_lee', n);
    begin insert into storage.objects(bucket_id, name, owner) values ('project-logos', 'ens/bbbbbbbbbbbbbbbb.webp', lec); res := res || jsonb_build_object('l2_lector_sube', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('l2_lector_sube', 'denegado ' || sqlstate); end;
    update storage.objects set metadata = '{}' where bucket_id = 'project-logos' and name like 'ens/%'; get diagnostics n = row_count; res := res || jsonb_build_object('l3_lector_cambia', n);
    execute 'reset role';
  else
    res := res || jsonb_build_object('l0_lector', 'no hay lector con cuenta');
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', ext, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'project-logos'; res := res || jsonb_build_object('o1_ajeno_lee', n);
  begin insert into storage.objects(bucket_id, name, owner) values ('project-logos', 'ens/cccccccccccccccc.webp', ext); res := res || jsonb_build_object('o2_ajeno_sube', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('o2_ajeno_sube', 'denegado ' || sqlstate); end;
  update storage.objects set metadata = '{}' where bucket_id = 'project-logos'; get diagnostics n = row_count; res := res || jsonb_build_object('o3_ajeno_cambia', n);
  execute 'reset role';

  execute 'set local role anon';
  begin select count(*) into n from storage.objects where bucket_id = 'project-logos'; res := res || jsonb_build_object('a1_anon_lee', n); exception when others then res := res || jsonb_build_object('a1_anon_lee', 'denegado ' || sqlstate); end;
  begin insert into storage.objects(bucket_id, name) values ('project-logos', 'ens/dddddddddddddddd.webp'); res := res || jsonb_build_object('a2_anon_sube', 'PERMITIDO'); exception when others then res := res || jsonb_build_object('a2_anon_sube', 'denegado ' || sqlstate); end;
  execute 'reset role';

  raise exception 'ENSAYO %', res;
end $t$;
