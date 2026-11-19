-- "Agregar a la propuesta" (Nacho, 17/11): "Volver a pensar" reemplaza sólo las nuevas que no
-- están marcadas en la propuesta. Misma regla que quedaAlRepensar en src/lib/oportunidades.js.
create or replace function public.oportunidades_reemplazar(p_project text, p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if coalesce(p_project, '') !~ '^[A-Za-z0-9_-]{1,80}$' or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'OPORTUNIDADES_INVALIDAS' using errcode = '22023';
  end if;
  update public.project_opportunities
     set deleted_at = now(), updated_at = now()
   where project_id = p_project and deleted_at is null and data->>'estado' = 'nueva'
     and coalesce(data->>'enPropuesta', '') <> 'true';
  insert into public.project_opportunities (id, data, updated_at)
  select f->>'id', f, now()
    from jsonb_array_elements(p_filas) f
   where coalesce(f->>'id', '') ~ '^[A-Za-z0-9_-]{1,80}$' and f->>'projectId' = p_project;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.oportunidades_reemplazar(text, jsonb) from public, anon, authenticated;
grant execute on function public.oportunidades_reemplazar(text, jsonb) to service_role;
