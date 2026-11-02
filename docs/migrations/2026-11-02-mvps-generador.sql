-- Clarity (cb-mvps, con la service role) deja o refresca acá el MVP que generó un closer:
-- POST {PROYECTOS_URL}/rest/v1/rpc/mvp_generador_guardar con body {"p": {...}}.
--
-- * id: la misma regla que supabase/functions/mvp-sync; si una cambia sin la otra, mvp-sync duplica la fila.
-- * data.id y data.updatedAt: useRowCollection descarta filas sin id e ignora un evento realtime cuyo
--   updatedAt no supere al que ya tiene la pestaña. Las fechas van como new Date().toISOString(): la
--   vista las ordena y compara como texto.
-- * vinculado: la fila quedó atada a ese proyecto (también si ya lo estaba), no "se ató en esta llamada":
--   repetir la llamada da lo mismo y el barrido de Clarity puede darlo por hecho.
-- * Una fila dada de baja (deleted_at) no se toca ni se resucita, como en mvp_apply_sync.
-- * mvp-sync, en su próxima vuelta, pisa con lo que ve en GitHub los campos que esta función también escribe
--   (source, title, description, repoUrl, demoUrl, repoCreatedAt); origen, generador y evidencia no los toca.
--   Por eso el arranque tiene que dejar homepage y description en el repo: sin homepage, mvp-sync vacía demoUrl.

create or replace function public.mvp_generador_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_full   text;
  v_id     text;
  v_ahora  text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_source text;
  v_entra  jsonb;
  v_viejo  jsonb;
  v_nuevo  jsonb;
  v_baja   timestamptz;
  v_filas  integer;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'p debe ser un objeto json' using errcode = '22023';
  end if;

  v_full := btrim(coalesce(p->>'full_name', ''));
  if v_full !~ '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$' then
    raise exception 'full_name debe ser owner/repo (llegó "%")', v_full using errcode = '22023';
  end if;
  if jsonb_typeof(p->'generador') not in ('object', 'null')
     or jsonb_typeof(p->'evidencia') not in ('object', 'null') then
    raise exception 'generador y evidencia deben ser objetos' using errcode = '22023';
  end if;

  v_id := 'mvp-' || regexp_replace(lower(v_full), '[^a-z0-9]+', '-', 'g');
  v_source := btrim(coalesce(p #>> '{vincular,source_id}', ''));

  v_entra := jsonb_strip_nulls(jsonb_build_object(
    'origen', 'generador',
    'title', nullif(btrim(coalesce(p->>'title', '')), ''),
    'description', nullif(btrim(coalesce(p->>'description', '')), ''),
    'repoUrl', nullif(btrim(coalesce(p->>'repo_url', '')), ''),
    'demoUrl', nullif(btrim(coalesce(p->>'demo_url', '')), ''),
    'generador', nullif(jsonb_strip_nulls(p->'generador'), '{}'::jsonb),
    'evidencia', nullif(jsonb_strip_nulls(p->'evidencia'), '{}'::jsonb)));

  insert into public.mvps (id, data, updated_at)
  values (
    v_id,
    jsonb_build_object(
      'id', v_id, 'source', 'generador',
      'owner', split_part(v_full, '/', 1), 'repo', split_part(v_full, '/', 2), 'fullName', v_full,
      'repoUrl', 'https://github.com/' || v_full,
      'createdAt', v_ahora, 'repoCreatedAt', v_ahora, 'status', 'activo', 'updatedAt', v_ahora)
    || v_entra
    || case when v_source <> ''
         then jsonb_build_object('projectId', v_source, 'linkedBy', 'venta', 'linkedAt', v_ahora)
         else '{}'::jsonb end,
    now())
  on conflict (id) do nothing;
  get diagnostics v_filas = row_count;
  if v_filas = 1 then
    return jsonb_build_object('id', v_id, 'nueva', true, 'vinculado', v_source <> '');
  end if;

  select data, deleted_at into v_viejo, v_baja from public.mvps where id = v_id for update;
  if not found then
    raise exception 'mvps.% se borró mientras se guardaba; reintentar', v_id using errcode = '40001';
  end if;
  if v_baja is not null then
    return jsonb_build_object('id', v_id, 'nueva', false, 'vinculado', false);
  end if;

  v_nuevo := v_viejo || v_entra;
  if v_source <> ''
     and coalesce(v_viejo->>'projectId', '') = ''
     and coalesce(v_viejo->>'autoLinkOff', '') <> 'true' then
    v_nuevo := v_nuevo || jsonb_build_object('projectId', v_source, 'linkedBy', 'venta', 'linkedAt', v_ahora);
  end if;

  if v_nuevo is distinct from v_viejo then
    update public.mvps
       set data = v_nuevo || jsonb_build_object('updatedAt', v_ahora), updated_at = now()
     where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'nueva', false,
    'vinculado', coalesce(v_source <> '' and v_nuevo->>'projectId' = v_source, false));
end;
$fn$;

revoke all on function public.mvp_generador_guardar(jsonb) from public, anon, authenticated;
grant execute on function public.mvp_generador_guardar(jsonb) to service_role;

-- Ensayo: todo lo que crea se deshace con la excepción final (subtransacción); si algo falla, falla la migración.
do $ensayo$
declare
  v_id   constant text := 'mvp-zz-ensayo-generador-test';
  v_iso  constant text := '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$';
  v_base constant jsonb := jsonb_build_object(
    'full_name', 'zz-ensayo/Generador-Test',
    'repo_url', 'https://github.com/zz-ensayo/Generador-Test',
    'demo_url', 'https://zz-ensayo-demo.example.com',
    'title', 'Ensayo Generador',
    'description', 'Fila de ensayo',
    'origen', 'generador',
    'generador', jsonb_build_object(
      'closer', jsonb_build_object('nombre', 'Juan', 'email', 'juan@example.com'),
      'propuesta', jsonb_build_object('id', 'prop-1', 'slug', 'ensayo', 'url', 'https://example.com/propuestas/ensayo'),
      'mvpId', 'mvp-1',
      'panelUrl', 'https://example.com/panel/mvps/mvp-1'),
    'evidencia', jsonb_build_object(
      'movil', 'https://example.com/capturas/375.png',
      'escritorio', 'https://example.com/capturas/1280.png',
      'video', 'https://example.com/capturas/demo.mp4'),
    'vincular', null::jsonb);
  v_venta constant jsonb := v_base || jsonb_build_object('vincular', jsonb_build_object('source_id', 'p-ensayo'));
  r       jsonb;
  d       jsonb;
  d0      jsonb;
  v_baja  timestamptz;
begin
  perform set_config('plpgsql.check_asserts', 'on', true);
  if exists (select 1 from public.mvps where id = v_id) then
    raise exception 'ensayo: ya existe %, no se corre', v_id;
  end if;

  begin
    r := public.mvp_generador_guardar(v_base);
    assert r = jsonb_build_object('id', v_id, 'nueva', true, 'vinculado', false), 'alta: ' || r::text;
    select data into d from public.mvps where id = v_id;
    assert d->>'id' = v_id and d->>'origen' = 'generador' and d->>'source' = 'generador' and d->>'status' = 'activo', 'alta: claves base';
    assert d->>'fullName' = 'zz-ensayo/Generador-Test' and d->>'owner' = 'zz-ensayo' and d->>'repo' = 'Generador-Test', 'alta: repo';
    assert d->>'repoUrl' = 'https://github.com/zz-ensayo/Generador-Test' and d->>'demoUrl' = 'https://zz-ensayo-demo.example.com', 'alta: links';
    assert d->>'title' = 'Ensayo Generador' and d->>'description' = 'Fila de ensayo', 'alta: título y descripción';
    assert d #>> '{generador,closer,nombre}' = 'Juan' and d #>> '{generador,propuesta,url}' = 'https://example.com/propuestas/ensayo', 'alta: generador';
    assert d #>> '{evidencia,movil}' = 'https://example.com/capturas/375.png', 'alta: evidencia';
    assert d->>'createdAt' ~ v_iso and d->>'repoCreatedAt' = d->>'createdAt' and d->>'updatedAt' = d->>'createdAt', 'alta: fechas ISO';
    assert not (d ? 'projectId'), 'alta: sin vínculo';

    d0 := d;
    perform pg_sleep(0.01);
    r := public.mvp_generador_guardar(v_base);
    assert r = jsonb_build_object('id', v_id, 'nueva', false, 'vinculado', false), 'repetida: ' || r::text;
    select data into d from public.mvps where id = v_id;
    assert d = d0, 'repetida: no escribe nada';

    update public.mvps
       set data = data || '{"notes":"a mano","demoUrlManual":"https://manual.example.com","status":"descartado","autoLinkOff":true}'::jsonb
     where id = v_id;
    r := public.mvp_generador_guardar(v_venta || jsonb_build_object(
      'demo_url', 'https://nueva.example.com', 'status', 'activo', 'projectId', 'otro', 'notes', 'pisada',
      'demoUrlManual', 'pisada', 'autoLinkOff', false));
    assert r = jsonb_build_object('id', v_id, 'nueva', false, 'vinculado', false), 'a mano: ' || r::text;
    select data into d from public.mvps where id = v_id;
    assert d->>'notes' = 'a mano' and d->>'demoUrlManual' = 'https://manual.example.com'
       and d->>'status' = 'descartado' and d->>'autoLinkOff' = 'true', 'a mano: lo cargado a mano se conserva';
    assert d->>'demoUrl' = 'https://nueva.example.com', 'a mano: demoUrl nueva';
    assert coalesce(d->>'projectId', '') = '', 'a mano: autoLinkOff frena el vínculo';

    update public.mvps set data = data - 'autoLinkOff' where id = v_id;
    r := public.mvp_generador_guardar(v_venta);
    assert r = jsonb_build_object('id', v_id, 'nueva', false, 'vinculado', true), 'venta: ' || r::text;
    select data into d from public.mvps where id = v_id;
    assert d->>'projectId' = 'p-ensayo' and d->>'linkedBy' = 'venta' and d->>'linkedAt' ~ v_iso, 'venta: vínculo';
    d0 := d;
    perform pg_sleep(0.01);
    r := public.mvp_generador_guardar(v_venta);
    select data into d from public.mvps where id = v_id;
    assert r->>'vinculado' = 'true' and d = d0, 'venta repetida: igual y sin escribir';
    r := public.mvp_generador_guardar(v_base || jsonb_build_object('vincular', jsonb_build_object('source_id', 'p-otro')));
    assert r->>'vinculado' = 'false', 'venta a otro proyecto: ' || r::text;
    assert (select data->>'projectId' from public.mvps where id = v_id) = 'p-ensayo', 'venta: no pisa un vínculo existente';

    r := public.mvp_generador_guardar(jsonb_build_object(
      'full_name', 'ZZ-Ensayo/generador-test',
      'evidencia', jsonb_build_object('movil', 'https://example.com/capturas/nueva.png'),
      'generador', jsonb_build_object('closer', null::jsonb),
      'description', 'Otra descripción',
      'title', ' '));
    assert r = jsonb_build_object('id', v_id, 'nueva', false, 'vinculado', false), 'parcial: ' || r::text;
    select data into d from public.mvps where id = v_id;
    assert d #>> '{evidencia,movil}' = 'https://example.com/capturas/nueva.png' and not (d->'evidencia' ? 'escritorio'), 'parcial: evidencia nueva reemplaza la anterior';
    assert d #>> '{generador,closer,nombre}' = 'Juan' and d->>'title' = 'Ensayo Generador' and d->>'projectId' = 'p-ensayo'
       and d->>'demoUrl' = 'https://zz-ensayo-demo.example.com', 'parcial: vacío y null no borran';
    assert d->>'description' = 'Otra descripción', 'parcial: lo que viene reemplaza';

    perform pg_sleep(0.01);
    d0 := d;
    perform public.mvp_generador_guardar('{"full_name":"zz-ensayo/Generador-Test"}'::jsonb);
    perform public.mvp_generador_guardar(jsonb_build_object('full_name', 'zz-ensayo/Generador-Test',
      'evidencia', '{}'::jsonb, 'generador', null::jsonb, 'vincular', jsonb_build_object('source_id', ''), 'demo_url', ' '));
    select data into d from public.mvps where id = v_id;
    assert d = d0, 'omitido, vacío o null: no cambia nada';

    r := public.mvp_generador_guardar('{"full_name":"ZZ_Ensayo/Raro.Nombre_v2"}'::jsonb);
    assert r->>'id' = 'mvp-zz-ensayo-raro-nombre-v2' and r->>'nueva' = 'true', 'id: ' || r::text;

    r := public.mvp_generador_guardar(jsonb_build_object('full_name', 'zz-ensayo/Alta-Con-Venta',
      'vincular', jsonb_build_object('source_id', 'p-alta')));
    assert r = jsonb_build_object('id', 'mvp-zz-ensayo-alta-con-venta', 'nueva', true, 'vinculado', true), 'alta con venta: ' || r::text;
    select data into d from public.mvps where id = 'mvp-zz-ensayo-alta-con-venta';
    assert d->>'projectId' = 'p-alta' and d->>'linkedBy' = 'venta' and d->>'linkedAt' ~ v_iso, 'alta con venta: vínculo';

    perform public.mvp_apply_sync(jsonb_build_array(jsonb_build_object(
      'id', v_id, 'source', 'github', 'owner', 'zz-ensayo', 'repo', 'Generador-Test', 'fullName', 'zz-ensayo/Generador-Test',
      'title', 'Titulo de GitHub', 'description', 'Descripcion de GitHub', 'demoUrl', 'https://sync.example.com',
      'repoCreatedAt', '2026-11-01T10:00:00.000Z', 'updatedAt', '2026-11-02T10:00:01.000Z')));
    select data into d from public.mvps where id = v_id;
    assert d->>'origen' = 'generador' and d #>> '{generador,closer,nombre}' = 'Juan' and d #>> '{evidencia,movil}' is not null
       and d->>'projectId' = 'p-ensayo' and d->>'linkedBy' = 'venta' and d->>'notes' = 'a mano', 'sync: mvp_apply_sync no borra lo del generador ni lo manual';

    update public.mvps set deleted_at = now() where id = v_id;
    select data into d0 from public.mvps where id = v_id;
    r := public.mvp_generador_guardar(v_venta || jsonb_build_object('title', 'otro'));
    assert r = jsonb_build_object('id', v_id, 'nueva', false, 'vinculado', false), 'baja: ' || r::text;
    select data, deleted_at into d, v_baja from public.mvps where id = v_id;
    assert d = d0 and v_baja is not null, 'baja: no se toca ni se resucita';

    begin
      perform public.mvp_generador_guardar('{"full_name":"sin-barra"}'::jsonb);
      raise exception 'FALLA: aceptó un full_name sin owner/repo';
    exception when invalid_parameter_value then null;
    end;
    begin
      perform public.mvp_generador_guardar('{}'::jsonb);
      raise exception 'FALLA: aceptó una entrada sin full_name';
    exception when invalid_parameter_value then null;
    end;
    begin
      perform public.mvp_generador_guardar('[]'::jsonb);
      raise exception 'FALLA: aceptó un arreglo';
    exception when invalid_parameter_value then null;
    end;
    begin
      perform public.mvp_generador_guardar(null::jsonb);
      raise exception 'FALLA: aceptó null';
    exception when invalid_parameter_value then null;
    end;
    begin
      perform public.mvp_generador_guardar('{"full_name":"a/b","generador":"texto"}'::jsonb);
      raise exception 'FALLA: aceptó un generador que no es objeto';
    exception when invalid_parameter_value then null;
    end;
    begin
      perform public.mvp_generador_guardar('{"full_name":"a/b","evidencia":[]}'::jsonb);
      raise exception 'FALLA: aceptó una evidencia que no es objeto';
    exception when invalid_parameter_value then null;
    end;

    assert not has_function_privilege('anon', 'public.mvp_generador_guardar(jsonb)', 'execute'), 'permisos: anon no ejecuta';
    assert not has_function_privilege('authenticated', 'public.mvp_generador_guardar(jsonb)', 'execute'), 'permisos: authenticated no ejecuta';
    assert has_function_privilege('service_role', 'public.mvp_generador_guardar(jsonb)', 'execute'), 'permisos: service_role ejecuta';
    assert (select prosecdef and proconfig @> array['search_path=public'] from pg_proc
             where oid = 'public.mvp_generador_guardar(jsonb)'::regprocedure), 'definer con search_path fijo';

    raise notice 'mvp_generador_guardar: ensayo ok';
    raise exception 'ensayo-ok';
  exception when raise_exception then
    if sqlerrm <> 'ensayo-ok' then raise; end if;
  end;
end
$ensayo$;
