-- Planta asociada al servicio en catálogo (opcional).
alter table public.catalogo_servicios
  add column if not exists planta text;

comment on column public.catalogo_servicios.planta is 'Planta o sitio del servicio (opcional).';
