-- Ensayo de 2026-11-28-tareas-de-los-dos.sql (sin escribir nada: clarity_tachar_en es pura).
do $$
declare
  plan jsonb := '{"weeks":[{"n":6,"tasks":[
    {"id":"i1","text":"De Insights","done":false},
    {"id":"a1","text":"Hacer la prueba final de punta a punta","done":false,"responsable":"ambos"},
    {"id":"a2","text":"Probar con el equipo","done":false,"responsable":"ambos","insightsHechaAt":"2026-11-27T00:00:00.000Z"},
    {"id":"c1","text":"Pasar el logo","done":false,"responsable":"cliente"}]}]}';
  r jsonb;
  t jsonb;
begin
  r := public.clarity_tachar_en(plan, array['i1','a1','a2','c1'], '{"url":"https://github.com/x/y/pull/1"}', '2026-11-28T06:00:00.000Z');
  if jsonb_array_length(r->'tachadas') <> 2 then raise exception 'FALLO 1: tachadas %', r->'tachadas'; end if;
  if not exists (select 1 from jsonb_array_elements(r->'tachadas') x where x->>'id' = 'a1' and (x->>'parcial')::boolean) then
    raise exception 'FALLO 2: la de los dos no volvió como parcial';
  end if;
  select x into t from jsonb_array_elements(r->'data'->'weeks'->0->'tasks') x where x->>'id' = 'a1';
  if coalesce((t->>'done')::boolean, false) or t->>'insightsHechaAt' is null or jsonb_array_length(t->'evidencia') <> 1 then
    raise exception 'FALLO 3: la de los dos quedó %', t;
  end if;
  if (select array_agg(x->>'id' order by x->>'id') from jsonb_array_elements(r->'del_cliente') x) <> array['a2','c1'] then
    raise exception 'FALLO 4: del_cliente %', r->'del_cliente';
  end if;
  select x into t from jsonb_array_elements(r->'data'->'weeks'->0->'tasks') x where x->>'id' = 'i1';
  if not (t->>'done')::boolean then raise exception 'FALLO 5: la de Insights no se tachó'; end if;
  raise notice 'OK';
end $$;
select 'ok' as ensayo;
