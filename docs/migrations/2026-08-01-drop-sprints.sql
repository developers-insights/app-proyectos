-- ============================================================================
-- 2026-08-01 · Vaciar data->'sprints' de la tabla `projects`
--
-- ⚠️ SE CORRE A MANO desde el SQL Editor de Supabase. No hay runner de
--    migraciones en este repo y este script NO se ejecuta en ningún deploy.
--
-- Contexto: se eliminó el sistema viejo de sprints de Insights OS. El avance de
-- un proyecto ahora sale exclusivamente de las tareas del plan asociado
-- (project.planId → tabla `plans`). La clave `sprints` dentro de `data` quedó
-- muerta: nada de la app la lee ni la escribe.
--
-- Orden: (1) mirar los conteos, (2) backup + borrado en UNA transacción que se
-- aborta sola si el backup no cubre todo. Rollback manual al final.
--
-- ⚠️ El paso 1 y el paso 2 se corren POR SEPARADO. El editor SQL manda todo el
--    contenido del panel como un solo batch y commitea al final: si el select de
--    verificación va adentro del begin/commit, para cuando ves los números ya está
--    todo commiteado y no llegás a decidir nada. Por eso el control que decide si
--    se sigue o no está automatizado adentro de la transacción (el DO de abajo).
-- ============================================================================

-- ── PASO 1 · FOTO PREVIA (correr SOLO este bloque, sin el resto) ─────────────
-- Anotá estos números. `con_sprints` es cuántas filas tienen que quedar
-- respaldadas; el paso 2 lo verifica solo y aborta si no coincide.
select
  (select count(*) from public.projects where data ? 'sprints')           as con_sprints,
  (select count(*) from public.projects
     where jsonb_array_length(coalesce(data->'sprints', '[]'::jsonb)) > 0) as con_sprints_no_vacios,
  (select count(*) from public.projects where data ? '_sprintsImportRDE1') as con_flag_rde;

-- ── PASO 2 · BACKUP + BORRADO (correr SOLO este bloque, después del paso 1) ──

begin;

-- 2a · BACKUP ────────────────────────────────────────────────────────────────
-- Copia de la columna entera (no solo de 'sprints') por si hace falta volver.
-- `projects.id` es TEXT (ids base36 de 8 caracteres), no uuid: con `id uuid` el
-- insert de abajo aborta con "invalid input syntax for type uuid" y se cae toda
-- la migración.
-- Si la tabla ya existe de un intento anterior, este create falla y aborta la
-- transacción: es a propósito, no queremos pisar un backup previo.
create table public.projects_sprints_backup_20260801 (
  id           text primary key,
  data         jsonb not null,
  backed_up_at timestamptz not null default now()
);

insert into public.projects_sprints_backup_20260801 (id, data)
select id, data
from public.projects
where data ? 'sprints';

-- 2b · CONTROL AUTOMÁTICO ────────────────────────────────────────────────────
-- Si el backup no cubre exactamente las filas con 'sprints', esto tira una
-- excepción, la transacción se aborta y el update de abajo NO corre. Es el mismo
-- criterio que se miraba a ojo, pero aplicado antes del commit en vez de después.
do $$
declare
  con_sprints  bigint;
  respaldados  bigint;
begin
  select count(*) into con_sprints from public.projects where data ? 'sprints';
  select count(*) into respaldados from public.projects_sprints_backup_20260801;
  if con_sprints <> respaldados then
    raise exception 'Backup incompleto: % filas con sprints vs % respaldadas. No se borra nada.',
      con_sprints, respaldados;
  end if;
  raise notice 'Backup OK: % filas respaldadas.', respaldados;
end $$;

-- 2c · BORRADO ───────────────────────────────────────────────────────────────
-- Saca la clave 'sprints' del JSON. Se usa `- 'sprints'` (borra la clave) en vez
-- de setearla a '[]' para no dejar basura: la app ya no la mira.
-- También se va la bandera del import one-shot de RDE, que solo servía al
-- sistema viejo.
update public.projects
set data = (data - 'sprints') - '_sprintsImportRDE1'
where data ? 'sprints' or data ? '_sprintsImportRDE1';

commit;

-- ============================================================================
-- ROLLBACK (correr aparte, solo si hace falta restaurar)
-- ============================================================================
-- update public.projects p
-- set data = jsonb_set(p.data, '{sprints}', coalesce(b.data->'sprints', '[]'::jsonb), true)
-- from public.projects_sprints_backup_20260801 b
-- where b.id = p.id;

-- ============================================================================
-- LIMPIEZA (recién cuando el cambio esté verificado en producción, no antes)
-- ============================================================================
-- drop table public.projects_sprints_backup_20260801;
