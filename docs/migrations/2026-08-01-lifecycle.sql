-- ============================================================================
-- 2026-08-01 · Insights OS — ciclo de vida de proyectos + roles del equipo
--
-- Correr a mano en el SQL editor de Supabase (proyecto yzmtzyuncekspgtsetwk).
-- Todo es IDEMPOTENTE: se puede correr N veces sin efectos distintos.
--
-- Modelo de datos: cada entidad es una fila { id text, data jsonb,
-- updated_at timestamptz, deleted_at timestamptz }. Todo lo de negocio vive
-- dentro de `data`, así que estas migraciones son UPDATEs de jsonb, no DDL.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1) projects.data.lifecycle — backfill para los proyectos que no lo tienen
--
--    { phase: 1, startedAt: <createdAt>, phase2At: null, phase3At: null,
--      trialDays: 30, maintenanceAmount: null, billingDay: null,
--      lastNoticeSentAt: null }
--
--    Fase 1 (Desarrollo) para todos: es la única fase que podemos afirmar sin
--    inventar. El pase a prueba/mantenimiento lo hace una persona con el botón.
--    startedAt sale de data->>'createdAt'; si un proyecto viejo no lo tiene,
--    cae a now() para que el contador de días arranque en 0 en vez de romperse.
--
--    El filtro usa jsonb_typeof: cubre a la vez la clave ausente, el valor
--    JSON null y un lifecycle corrupto que no sea objeto. Los proyectos que YA
--    tienen un lifecycle válido no se tocan (no se pisa nada cargado a mano).
-- ────────────────────────────────────────────────────────────────────────────

UPDATE projects
SET data = data || jsonb_build_object(
      'lifecycle', jsonb_build_object(
        'phase',             1,
        'startedAt',         COALESCE(
                               NULLIF(data->>'createdAt', ''),
                               to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                             ),
        'phase2At',          NULL,
        'phase3At',          NULL,
        'trialDays',         30,
        'maintenanceAmount', NULL,
        'billingDay',        NULL,
        'lastNoticeSentAt',  NULL
      )
    ),
    updated_at = now()
WHERE deleted_at IS NULL
  AND jsonb_typeof(data->'lifecycle') IS DISTINCT FROM 'object';

-- Verificación (debe devolver 0 filas):
--   SELECT id FROM projects
--   WHERE deleted_at IS NULL
--     AND jsonb_typeof(data->'lifecycle') IS DISTINCT FROM 'object';


-- ────────────────────────────────────────────────────────────────────────────
-- NOTA · data.sprints NO se toca acá.
--
-- El sistema de sprints queda LEGACY: el % de avance ahora sale del plan
-- asociado (data->>'planId'), no de los sprints. La limpieza de la clave
-- `sprints` es OTRA TAREA, y va después de que la UI esté recableada al plan.
-- Borrarla ahora dejaría el detalle del proyecto sin datos que mostrar.
-- ────────────────────────────────────────────────────────────────────────────


-- ============================================================================
-- 2) team_members.data.role — normalización de roles
--
--    El rol define la visibilidad del panel de Proyectos: un 'dev' ve solo los
--    proyectos donde está asignado como dev; el resto ve todo.
--
--    ⚠ MATCH POR EMAIL, NUNCA POR ID: hay filas DUPLICADAS por persona
--    (Manuel figura como 'u3' y como 'pddxnpid'; Nacho como 'u7' y como
--    'auto-ignaciocachaza-insightsapps-tech'). Si se matchea por id, la mitad
--    de las filas queda con el rol viejo y la visibilidad sale mal según con
--    qué fila se loguee cada uno.
--
--    ⚠ Las duplicadas NO se borran acá. Deduplicar es otra tarea: hay que
--    decidir qué id sobrevive antes de tocar las referencias
--    (assignments.pm.userId / assignments.dev.userId de los proyectos).
--
--    lower(...) en el WHERE por si algún email quedó cargado con mayúsculas.
-- ============================================================================

-- Devs
UPDATE team_members
SET data = jsonb_set(data, '{role}', '"dev"'::jsonb, true),
    updated_at = now()
WHERE deleted_at IS NULL
  AND lower(data->>'email') IN (
        'manuelnavarro@insightsapps.tech',
        'lisandropiva@insightsapps.tech'
      )
  AND data->>'role' IS DISTINCT FROM 'dev';

-- PM
UPDATE team_members
SET data = jsonb_set(data, '{role}', '"pm"'::jsonb, true),
    updated_at = now()
WHERE deleted_at IS NULL
  AND lower(data->>'email') = 'nachocachaza@insightsapps.tech'
  AND data->>'role' IS DISTINCT FROM 'pm';

-- Fundadores
UPDATE team_members
SET data = jsonb_set(data, '{role}', '"fundador"'::jsonb, true),
    updated_at = now()
WHERE deleted_at IS NULL
  AND lower(data->>'email') IN (
        'federicog@insightsapps.tech',
        'juanp@insightsapps.tech'
      )
  AND data->>'role' IS DISTINCT FROM 'fundador';

-- Verificación (revisar a ojo; deben aparecer TODAS las filas de cada persona,
-- duplicadas incluidas, con el mismo rol):
--   SELECT id, data->>'name' AS nombre, data->>'email' AS email, data->>'role' AS rol
--   FROM team_members
--   WHERE deleted_at IS NULL
--   ORDER BY lower(data->>'email'), id;
