-- =============================================================================
-- RECUPERAR calificaciones oficial → JT ocultas
-- =============================================================================
-- Ejecutar DESPUÉS de revisar 032_diag_cat_jt_calificaciones.sql
-- Qué hace:
--   A) Expande scores.__jt_evaluaciones_oficiales__ a filas submodulo=jefe_turno
--   B) Reetiqueta filas con criterios JT que quedaron como submodulo=oficial
-- =============================================================================

-- A) Expandir JSON legacy a filas modernas (una por oficial calificador)
insert into public.cat_evaluacion (
  no_empleado,
  modulo,
  submodulo,
  calificado_por,
  scores,
  comentarios,
  promedio,
  updated_at
)
select
  upper(trim(e.no_empleado)) as no_empleado,
  'operaciones' as modulo,
  'jefe_turno' as submodulo,
  upper(trim(oficial_key)) as calificado_por,
  coalesce(entry -> 'scores', '{}'::jsonb) as scores,
  coalesce(entry ->> 'comentarios', '') as comentarios,
  case
    when entry ? 'promedio' and (entry ->> 'promedio') ~ '^-?[0-9]+(\\.[0-9]+)?$'
      then (entry ->> 'promedio')::numeric
    else null
  end as promedio,
  coalesce(e.updated_at, now()) as updated_at
from public.cat_evaluacion e
cross join lateral jsonb_each(e.scores -> '__jt_evaluaciones_oficiales__') as j(oficial_key, entry)
where e.modulo = 'operaciones'
  and e.scores ? '__jt_evaluaciones_oficiales__'
  and coalesce(trim(oficial_key), '') <> ''
on conflict (no_empleado, modulo, submodulo, calificado_por)
do update set
  scores = excluded.scores,
  comentarios = excluded.comentarios,
  promedio = coalesce(excluded.promedio, public.cat_evaluacion.promedio),
  updated_at = greatest(public.cat_evaluacion.updated_at, excluded.updated_at);

-- B) Reetiquetar filas planas con criterios JT mal marcadas como oficial
update public.cat_evaluacion e
set submodulo = 'jefe_turno'
where e.modulo = 'operaciones'
  and e.submodulo = 'oficial'
  and (
    e.scores ? 'explica_funciones_equipo'
    or e.scores ? 'liderazgo_gestion_equipo'
    or e.scores ? 'resuelve_dudas_oficiales'
  )
  and not (e.scores ? '__jt_evaluaciones_oficiales__')
  and not exists (
    select 1
    from public.cat_evaluacion x
    where x.no_empleado = e.no_empleado
      and x.modulo = 'operaciones'
      and x.submodulo = 'jefe_turno'
      and x.calificado_por = e.calificado_por
  );

-- C) Verificación rápida
select
  no_empleado as jt,
  calificado_por as oficial,
  promedio,
  updated_at
from public.cat_evaluacion
where modulo = 'operaciones'
  and submodulo = 'jefe_turno'
order by no_empleado, calificado_por;

notify pgrst, 'reload schema';
