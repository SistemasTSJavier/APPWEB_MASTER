-- Revierte submodulo y calificado_por (jefe de turno) en cat_evaluacion.
-- Conserva la evaluación de perfil oficial; elimina filas exclusivas de jefe_turno.

delete from public.cat_evaluacion
where modulo = 'operaciones' and submodulo = 'jefe_turno';

alter table public.cat_evaluacion drop constraint if exists cat_evaluacion_pkey;

alter table public.cat_evaluacion drop column if exists calificado_por;
alter table public.cat_evaluacion drop column if exists submodulo;

alter table public.cat_evaluacion
  add primary key (no_empleado, modulo);
