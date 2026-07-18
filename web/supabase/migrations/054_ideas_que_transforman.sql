-- Ideas que transforman: propuestas públicas (QR) y revisión por Mejora continua / Admin.
-- Acceso solo vía service_role desde la aplicación.

create extension if not exists pgcrypto;

create table if not exists public.ideas_que_transforman (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  departamento_autor text not null,
  problema text not null,
  solucion text not null,
  beneficio text not null,
  departamento_afectado text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptado')),
  aceptado_at timestamptz,
  aceptado_por_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_ideas_estado_created
  on public.ideas_que_transforman (estado, created_at desc);

create index if not exists idx_ideas_dept_afectado_created
  on public.ideas_que_transforman (departamento_afectado, created_at desc);

alter table public.ideas_que_transforman enable row level security;

revoke all on table public.ideas_que_transforman from anon, authenticated;
grant select, insert, update, delete on table public.ideas_que_transforman to service_role;

comment on table public.ideas_que_transforman is
  'Propuestas de mejora enviadas por QR (Ideas que transforman).';
