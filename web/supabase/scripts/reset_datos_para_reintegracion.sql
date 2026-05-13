
begin;

truncate table public.moper_historial;
truncate table public.colaboradores;
truncate table public.catalogo_servicios;

commit;

-- Tras ejecutar: vacía el bucket de fotos (arriba), luego importa CSV / catálogo Servicios.
