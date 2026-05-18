-- N.º de servicio opcional en catálogo (Cuadrícula / asistencia y coincidencias con expedientes).
alter table public.catalogo_servicios
  add column if not exists numero_servicio text;

comment on column public.catalogo_servicios.numero_servicio is 'Identificador corto del servicio (ej. 101, CAT-1); opcional; puede repetirse entre servicios distintos.';
