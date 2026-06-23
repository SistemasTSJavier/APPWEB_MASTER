-- Parche JT: columnas submodulo + calificado_por en cat_evaluacion (esquema 016).
-- Ejecutar en Supabase → SQL Editor si al guardar un JT aparece:
--   "Could not find the 'calificado_por' column of 'cat_evaluacion' in the schema cache"
--
-- También válido si solo falta una de las dos columnas.

alter table public.cat_evaluacion
  add column if not exists submodulo text not null default '';

alter table public.cat_evaluacion
  add column if not exists calificado_por text not null default '';

update public.cat_evaluacion
set submodulo = 'oficial'
where modulo = 'operaciones' and coalesce(submodulo, '') = '';

comment on column public.cat_evaluacion.submodulo is
  'Vacío para RH y Enfoque. En operaciones: oficial | jefe_turno.';
comment on column public.cat_evaluacion.calificado_por is
  'N.º del oficial que califica al JT. Vacío en RH, enfoque y operaciones-perfil oficial.';

alter table public.cat_evaluacion drop constraint if exists cat_evaluacion_pkey;

alter table public.cat_evaluacion
  add primary key (no_empleado, modulo, submodulo, calificado_por);

-- Refrescar caché de PostgREST (Supabase API)
notify pgrst, 'reload schema';
