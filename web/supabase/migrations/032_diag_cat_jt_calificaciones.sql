-- =============================================================================
-- DIAGNÓSTICO: calificaciones Operaciones → Jefe de turno (oficiales → JT)
-- =============================================================================
-- Cómo usar:
--   1. Supabase Dashboard → SQL → New query
--   2. Pega TODO este archivo y pulsa RUN
--   3. Revisa cada bloque de resultados
--
-- Empleados del ejemplo DANFOSS (ajusta la lista si hace falta):
--   6754, 6422, 5231, 6207, 7485
-- =============================================================================

-- 1) Todas las filas de operaciones de esos JT (estructura moderna)
select
  e.no_empleado,
  e.submodulo,
  e.calificado_por,
  e.promedio,
  e.updated_at,
  e.scores
from public.cat_evaluacion e
where e.modulo = 'operaciones'
  and e.no_empleado in ('6754', '6422', '5231', '6207', '7485')
order by e.no_empleado, e.submodulo, e.calificado_por;

-- 2) Filas marcadas como jefe_turno (con oficial calificador)
select
  e.no_empleado as jt,
  e.calificado_por as oficial,
  e.promedio,
  e.updated_at
from public.cat_evaluacion e
where e.modulo = 'operaciones'
  and e.submodulo = 'jefe_turno'
order by e.updated_at desc nulls last
limit 100;

-- 3) JSON legacy: calificaciones guardadas dentro de scores.__jt_evaluaciones_oficiales__
select
  e.no_empleado as jt,
  e.submodulo,
  jsonb_object_keys(e.scores -> '__jt_evaluaciones_oficiales__') as oficial,
  e.scores -> '__jt_evaluaciones_oficiales__' as bucket_jt,
  e.updated_at
from public.cat_evaluacion e
where e.modulo = 'operaciones'
  and e.scores ? '__jt_evaluaciones_oficiales__'
order by e.no_empleado;

-- 4) Filas que PARECEN calificación a JT (criterios típicos) aunque digan submodulo=oficial
select
  e.no_empleado,
  e.submodulo,
  e.calificado_por,
  e.promedio,
  e.updated_at,
  (e.scores ? 'explica_funciones_equipo') as tiene_criterio_jt,
  (e.scores ? 'liderazgo_gestion_equipo') as tiene_liderazgo
from public.cat_evaluacion e
where e.modulo = 'operaciones'
  and (
    e.scores ? 'explica_funciones_equipo'
    or e.scores ? 'liderazgo_gestion_equipo'
    or e.scores ? 'resuelve_dudas_oficiales'
    or e.scores ? '__jt_evaluaciones_oficiales__'
  )
order by e.updated_at desc nulls last
limit 200;

-- 5) Conteo rápido: cuántas calificaciones JT hay por empleado
select
  e.no_empleado as jt,
  count(*) filter (where e.submodulo = 'jefe_turno' and coalesce(e.calificado_por, '') <> '') as filas_modernas_jt,
  bool_or(e.scores ? '__jt_evaluaciones_oficiales__') as tiene_json_legacy,
  count(*) filter (
    where e.scores ? 'explica_funciones_equipo' or e.scores ? 'liderazgo_gestion_equipo'
  ) as filas_con_criterios_jt
from public.cat_evaluacion e
where e.modulo = 'operaciones'
  and e.no_empleado in ('6754', '6422', '5231', '6207', '7485')
group by e.no_empleado
order by e.no_empleado;
