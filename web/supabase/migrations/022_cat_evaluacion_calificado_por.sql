-- Jefe de turno: una fila por cada oficial que califica (acumulación → promedio final).

alter table public.cat_evaluacion
  add column if not exists calificado_por text not null default '';

alter table public.cat_evaluacion drop constraint if exists cat_evaluacion_pkey;

alter table public.cat_evaluacion
  add primary key (no_empleado, modulo, submodulo, calificado_por);

comment on column public.cat_evaluacion.calificado_por is
  'N.º del oficial que califica. Vacío en RH, enfoque y operaciones-perfil oficial. En jefe_turno: N.º del oficial evaluador.';
