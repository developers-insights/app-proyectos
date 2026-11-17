-- Clarity tacha en el roadmap la tarea que cubre un pedido ya publicado (Nacho, call del 17/11: "hoy no sé cómo va
-- cada proyecto sin preguntarle al bot"). La llama la edge function cb-roadmap de Speed Funnels (rlausjxxgmtapvozrttw)
-- con la service role de esta base. Contrato: docs/decisiones/clarity/roadmap-tachado.md de speed-funnels.
--
-- Por qué una RPC y no un PATCH: el plan es un jsonb entero (data.weeks[].tasks[]) y un PATCH pisaría lo que el
-- Planificador guardó en el medio. Acá se bloquea la fila, se tocan sólo las tareas pedidas y updatedAt avanza para
-- que la app tome esta versión (gana el updatedAt más nuevo, lo mismo que clarity_plan_asociar).
--
-- Nunca tacha una tarea del cliente (`responsable` cliente o ambos): el % que ve el cliente es "Terminada por
-- Insights", y una tarea suya no la cierra un deploy nuestro. Nunca destacha. Una tarea que ya estaba hecha no se toca.
-- published_plans se tacha sobre SU data, no se le copia la de plans: si alguna vez quedaron distintas, copiar
-- revertiría lo que alguien marcó sólo en el publicado.

create or replace function public.clarity_tachar_en(p_data jsonb, p_tareas text[], p_evidencia jsonb, p_ahora text)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $fn$
declare
  v_weeks     jsonb := '[]'::jsonb;
  v_tasks     jsonb;
  w           jsonb;
  t           jsonb;
  v_tachadas  jsonb := '[]'::jsonb;
  v_ya        jsonb := '[]'::jsonb;
  v_cliente   jsonb := '[]'::jsonb;
  v_vistas    text[] := '{}';
  v_ev        jsonb;
  v_url       text := nullif(btrim(coalesce(p_evidencia->>'url', '')), '');
begin
  for w in select value from jsonb_array_elements(coalesce(p_data->'weeks', '[]'::jsonb)) loop
    if jsonb_typeof(w->'tasks') <> 'array' then
      v_weeks := v_weeks || jsonb_build_array(w);
      continue;
    end if;
    v_tasks := '[]'::jsonb;
    for t in select value from jsonb_array_elements(w->'tasks') loop
      if jsonb_typeof(t) = 'object' and t->>'id' = any(p_tareas) then
        v_vistas := v_vistas || (t->>'id');
        if coalesce((t->>'done')::boolean, false) then
          v_ya := v_ya || jsonb_build_object('id', t->>'id', 'text', t->>'text');
        elsif coalesce(t->>'responsable', '') in ('cliente', 'ambos') then
          v_cliente := v_cliente || jsonb_build_object('id', t->>'id', 'text', t->>'text');
        else
          v_ev := case when jsonb_typeof(t->'evidencia') = 'array' then t->'evidencia' else '[]'::jsonb end;
          if v_url is not null and not exists (select 1 from jsonb_array_elements(v_ev) e where e->>'url' = v_url) then
            v_ev := v_ev || jsonb_build_object(
              'tipo', coalesce(nullif(p_evidencia->>'tipo', ''), 'pr'),
              'label', left(coalesce(nullif(p_evidencia->>'label', ''), 'Publicado por Clarity'), 200),
              'url', v_url);
          end if;
          t := (t - 'estado' - 'bloqueo') || jsonb_build_object('done', true, 'terminadaAt', p_ahora)
               || case when jsonb_array_length(v_ev) > 0 then jsonb_build_object('evidencia', v_ev) else '{}'::jsonb end;
          v_tachadas := v_tachadas || jsonb_build_object('id', t->>'id', 'text', t->>'text', 'semana', w->'n');
        end if;
      end if;
      v_tasks := v_tasks || jsonb_build_array(t);
    end loop;
    v_weeks := v_weeks || jsonb_build_array(jsonb_set(w, '{tasks}', v_tasks));
  end loop;

  return jsonb_build_object(
    'data', case when jsonb_array_length(v_tachadas) > 0
                 then jsonb_set(p_data, '{weeks}', v_weeks) || jsonb_build_object('updatedAt', p_ahora) end,
    'tachadas', v_tachadas,
    'ya_estaban', v_ya,
    'del_cliente', v_cliente,
    'no_estan', to_jsonb(array(select x from unnest(p_tareas) x where x <> all(v_vistas))));
end;
$fn$;

create or replace function public.clarity_plan_tachar(p_plan text, p_tareas text[], p_evidencia jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_data  jsonb;
  v_pub   jsonb;
  v_slug  text;
  r       jsonb;
  rp      jsonb;
  v_ahora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_plan is null or coalesce(array_length(p_tareas, 1), 0) = 0 then
    raise exception 'FALTAN' using errcode = '22023';
  end if;

  select data into v_data from plans where id = p_plan and deleted_at is null for update;
  if v_data is null then
    return jsonb_build_object('plan', null);
  end if;
  v_slug := nullif(v_data->>'slug', '');

  r := clarity_tachar_en(v_data, p_tareas, p_evidencia, v_ahora);
  if r->'data' <> 'null'::jsonb then
    update plans set data = r->'data', updated_at = now() where id = p_plan;
  end if;

  if v_slug is not null and coalesce((v_data->>'published')::boolean, false) then
    select data into v_pub from published_plans where slug = v_slug for update;
    if v_pub is not null then
      rp := clarity_tachar_en(v_pub, p_tareas, p_evidencia, v_ahora);
      if rp->'data' <> 'null'::jsonb then
        update published_plans set data = rp->'data', updated_at = now() where slug = v_slug;
      end if;
    end if;
  end if;

  return (r - 'data') || jsonb_build_object('plan', p_plan, 'slug', v_slug,
                                            'publicado', coalesce(jsonb_array_length(rp->'tachadas'), 0) > 0);
end;
$fn$;

revoke all on function public.clarity_tachar_en(jsonb, text[], jsonb, text) from public, anon, authenticated;
revoke all on function public.clarity_plan_tachar(text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.clarity_plan_tachar(text, text[], jsonb) to service_role;
