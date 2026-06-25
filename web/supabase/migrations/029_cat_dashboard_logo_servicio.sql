-- Logo de cliente por servicio (dashboard de categorización — esquina del banner).
create table if not exists public.cat_dashboard_logo_servicio (
  servicio text primary key,
  logo_url text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.cat_dashboard_logo_servicio enable row level security;

comment on table public.cat_dashboard_logo_servicio is
  'URL pública del logo del cliente por servicio para el banner del dashboard de categorización.';

grant select, insert, update, delete on table public.cat_dashboard_logo_servicio to service_role;
