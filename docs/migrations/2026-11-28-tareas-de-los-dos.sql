-- Las tareas de los dos (responsable 'ambos') frenaban todo el avance de Clarity y se le pedían enteras al PM:
-- en Psycho Selling le llegó a Nacho "hacer la prueba final de punta a punta antes de abrirlo al equipo" como algo
-- suyo (27/11), y es justo lo que Clarity puede hacer. Ahora un pedido publicado que cubre una de los dos no la
-- tacha: le marca `insightsHechaAt` (y la evidencia) y la devuelve en `tachadas` con `parcial: true`. Con esa
-- marca ya no es de Insights y lo que queda (revisar y dar el ok) es del cliente. El % del cliente no cambia: sólo
-- cuenta `done`. Va junto con cb-roadmap.ts de speed-funnels (tareasParaTachar / tareasPendientes): primero esta.

CREATE OR REPLACE FUNCTION public.clarity_tachar_en(p_data jsonb, p_tareas text[], p_evidencia jsonb, p_ahora text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        elsif coalesce(t->>'responsable', '') = 'cliente'
              or (t->>'responsable' = 'ambos' and coalesce(t->>'insightsHechaAt', '') <> '') then
          v_cliente := v_cliente || jsonb_build_object('id', t->>'id', 'text', t->>'text');
        elsif t->>'responsable' = 'ambos' then
          v_ev := case when jsonb_typeof(t->'evidencia') = 'array' then t->'evidencia' else '[]'::jsonb end;
          if v_url is not null and not exists (select 1 from jsonb_array_elements(v_ev) e where e->>'url' = v_url) then
            v_ev := v_ev || jsonb_build_object(
              'tipo', coalesce(nullif(p_evidencia->>'tipo', ''), 'pr'),
              'label', left(coalesce(nullif(p_evidencia->>'label', ''), 'Publicado por Clarity'), 200),
              'url', v_url);
          end if;
          t := t || jsonb_build_object('insightsHechaAt', p_ahora)
               || case when jsonb_array_length(v_ev) > 0 then jsonb_build_object('evidencia', v_ev) else '{}'::jsonb end;
          v_tachadas := v_tachadas || jsonb_build_object('id', t->>'id', 'text', t->>'text', 'semana', w->'n', 'parcial', true);
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
$function$;

revoke all on function public.clarity_tachar_en(jsonb, text[], jsonb, text) from public, anon, authenticated;
grant execute on function public.clarity_tachar_en(jsonb, text[], jsonb, text) to service_role;
