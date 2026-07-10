-- =============================================================================
-- BÚSQUEDA AMPLIA: ¿dónde quedaron las otras calificaciones a JT?
-- (Tras el 032: solo 5231 y 6207 tienen datos; 6754/6422/7485 no)
-- =============================================================================

-- 1) TODAS las calificaciones jefe_turno que existan (cualquier JT)
select
  no_empleado as jt,
  calificado_por as oficial,
  promedio,
  updated_at
from public.cat_evaluacion
where modulo = 'operaciones'
  and submodulo = 'jefe_turno'
order by updated_at desc nulls last
limit 200;

-- 2) ¿Hay JSON legacy en CUALQUIER empleado?
select
  no_empleado,
  submodulo,
  jsonb_object_keys(scores -> '__jt_evaluaciones_oficiales__') as oficial,
  updated_at
from public.cat_evaluacion
where modulo = 'operaciones'
  and scores ? '__jt_evaluaciones_oficiales__'
order by updated_at desc nulls last
limit 200;

-- 3) Filas con criterios típicos de JT (aunque digan oficial)
select
  no_empleado,
  submodulo,
  calificado_por,
  promedio,
  updated_at
from public.cat_evaluacion
where modulo = 'operaciones'
  and (
    scores ? 'explica_funciones_equipo'
    or scores ? 'liderazgo_gestion_equipo'
    or scores ? 'resuelve_dudas_oficiales'
  )
order by updated_at desc nulls last
limit 200;

-- 4) ¿Se guardó al revés? (el N° del oficial como no_empleado y el JT en calificado_por)
--    Busca si 6754, 6422 o 7485 aparecen como CALIFICADOR
select
  no_empleado as evaluado,
  submodulo,
  calificado_por as calificador,
  promedio,
  updated_at
from public.cat_evaluacion
where modulo = 'operaciones'
  and calificado_por in ('6754', '6422', '7485', '5231', '6207')
order by updated_at desc nulls last;

-- 5) Últimas 50 filas de operaciones (para ver actividad reciente)
select
  no_empleado,
  submodulo,
  calificado_por,
  promedio,
  updated_at
from public.cat_evaluacion
where modulo = 'operaciones'
order by updated_at desc nulls last
limit 50;
