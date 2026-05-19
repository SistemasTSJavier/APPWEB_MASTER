-- Catálogo global de vacantes (cuadrícula), compartido entre navegadores y producción.

create table if not exists public.cuadricula_vacantes_catalog (
  catalog_key text not null default 'default',
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (catalog_key)
);

comment on table public.cuadricula_vacantes_catalog is
  'Catálogo de vacantes por planta/servicio/posición. payload.items = array VacanteRegistro.';

grant select, insert, update, delete on table public.cuadricula_vacantes_catalog to service_role;
