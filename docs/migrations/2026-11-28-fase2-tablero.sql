-- Tablero "Fase 2" del menú (2026-11-28, pedido de Manuel y Nacho).
--
-- Reusa project_fase2 con dos tipos más:
--   'tablero'   → el proyecto está en el tablero (id 'tablero-<proyecto>'); se saca con data.deletedAt.
--   'propuesta' → lo que hablaron, qué venderle y cuánto (id 'propuesta-<proyecto>'), la arma la función
--                 `fase2` (accion armar_propuesta) y Nacho la edita (precios, quitar ítems).
-- Mismas policies de la tabla: ven pm_puede_ver_fase2, escriben pm_puede_editar_fase2.

alter table public.project_fase2 drop constraint if exists project_fase2_kind;
alter table public.project_fase2 add constraint project_fase2_kind
  check (coalesce(data->>'kind', '') in ('nota', 'call', 'plan', 'tablero', 'propuesta'));

-- Crea o mezcla la propuesta del proyecto. Un parche con estado 'lista' trae la propuesta entera y
-- reemplaza el contenido anterior (ítems quitados o editados incluidos); los otros sólo mezclan.
create or replace function public.fase2_guardar_propuesta(p_project text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
  v_id text := 'propuesta-' || coalesce(p_project, '');
  v_limpio jsonb := p_patch - 'id' - 'projectId' - 'kind' - 'updatedAt';
begin
  if coalesce(p_project, '') !~ '^[A-Za-z0-9_-]{1,80}$' or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'PROPUESTA_INVALIDA' using errcode = '22023';
  end if;
  insert into public.project_fase2 (id, data, updated_at)
  values (
    v_id,
    v_limpio || jsonb_build_object('id', v_id, 'projectId', p_project, 'kind', 'propuesta',
      'at', to_jsonb(now()), 'updatedAt', public.oportunidad_sello(null)),
    now()
  )
  on conflict (id) do update
    set data = (case when v_limpio->>'estado' = 'lista'
                     then jsonb_build_object('at', public.project_fase2.data->'at', 'by', public.project_fase2.data->'by')
                     else public.project_fase2.data end)
               || v_limpio
               || jsonb_build_object('id', v_id, 'projectId', p_project, 'kind', 'propuesta', 'deletedAt', null,
                    'updatedAt', public.oportunidad_sello(public.project_fase2.data->>'updatedAt')),
        updated_at = now(),
        deleted_at = null
  returning data into v;
  return v;
end $$;
revoke all on function public.fase2_guardar_propuesta(text, jsonb) from public, anon, authenticated;
grant execute on function public.fase2_guardar_propuesta(text, jsonb) to service_role;
