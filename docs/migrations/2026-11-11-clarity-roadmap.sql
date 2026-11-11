-- Clarity: asocia al proyecto el roadmap que cargó la edge function cb-roadmap de Speed Funnels
-- (rlausjxxgmtapvozrttw) con la service role de esta base. Contrato: docs/decisiones/clarity/roadmap-automatico.md
-- de speed-funnels.
--
-- Merge atómico sobre data: un PATCH de PostgREST reemplaza el jsonb entero y pisaría lo que la app
-- guardó en el medio. updatedAt avanza para que la app tome esta versión (gana el updatedAt más nuevo).
-- Nunca pisa un planId que ya tenga: un plan hecho a mano manda.

create or replace function public.clarity_plan_asociar(p_project text, p_plan text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_ok boolean;
begin
  update projects
     set data = data || jsonb_build_object(
           'planId', p_plan,
           'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
   where id = p_project
     and deleted_at is null
     and coalesce(data->>'planId', '') = ''
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$fn$;

revoke all on function public.clarity_plan_asociar(text, text) from public, anon, authenticated;
grant execute on function public.clarity_plan_asociar(text, text) to service_role;
