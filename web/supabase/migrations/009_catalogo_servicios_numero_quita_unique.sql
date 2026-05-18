-- El mismo N.º puede asignarse a varios servicios del catálogo (import CSV, plantillas compartidas).
drop index if exists public.idx_catalogo_servicios_numero_unique;

comment on column public.catalogo_servicios.numero_servicio is 'Identificador corto del servicio (ej. 101, CAT-1); opcional; puede repetirse entre servicios distintos.';
