-- Catálogo de servicios para Altas/MOPER (lista desplegable). Solo service_role vía API.
create table if not exists public.catalogo_servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalogo_servicios_nombre on public.catalogo_servicios (nombre);

alter table public.catalogo_servicios enable row level security;

comment on table public.catalogo_servicios is 'Nombres de servicio disponibles para selección en capturas (nombre en mayúsculas normalizado).';

grant select, insert, update, delete on table public.catalogo_servicios to service_role;
