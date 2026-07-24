-- Catálogo ampliable de departamentos y roles (panel Usuarios / admin).
create table if not exists public.app_catalogos (
  id text primary key,
  tipo text not null check (tipo in ('departamento', 'rol')),
  label text not null,
  -- Roles personalizados: plantilla de permisos del sistema (app_role real).
  base_role text null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint app_catalogos_rol_base check (
    (tipo = 'departamento' and base_role is null)
    or (tipo = 'rol' and base_role is not null and length(trim(base_role)) > 0)
  )
);

create index if not exists idx_app_catalogos_tipo_activo
  on public.app_catalogos (tipo, activo);

alter table public.app_catalogos enable row level security;

comment on table public.app_catalogos is
  'Departamentos y roles agregados por administrador (además de los fijos en código).';

grant select, insert, update, delete on table public.app_catalogos to service_role;
