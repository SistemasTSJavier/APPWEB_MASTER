-- Operaciones: dos perfiles de calificación (oficial vs jefe de turno) en la misma tabla.

alter table public.cat_evaluacion
  add column if not exists submodulo text not null default '';

update public.cat_evaluacion
set submodulo = 'oficial'
where modulo = 'operaciones' and (submodulo is null or submodulo = '');

alter table public.cat_evaluacion drop constraint if exists cat_evaluacion_pkey;

alter table public.cat_evaluacion
  add primary key (no_empleado, modulo, submodulo);

comment on column public.cat_evaluacion.submodulo is
  'Vacío para RH y Enfoque al cliente. En operaciones: oficial | jefe_turno.';
