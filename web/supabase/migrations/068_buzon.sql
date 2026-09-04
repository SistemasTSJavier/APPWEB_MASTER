-- Buzón de quejas / requerimientos (público + panel interno).
-- Acceso a datos solo vía service_role desde la aplicación.
-- Flujo: primero aprobación (pendiente → aprobado | no_aprobado);
-- solo si está aprobado aplican los estatus de seguimiento.

create extension if not exists pgcrypto;

create table if not exists public.buzon_registros (
  id uuid primary key default gen_random_uuid(),
  codigo_seguimiento text not null unique,
  departamento text not null,
  nombre_colaborador text not null,
  queja_requerimiento text not null,
  evidencia_path text not null default '',
  evidencia_url text not null default '',
  aprobacion text not null default 'pendiente'
    check (aprobacion in ('pendiente', 'aprobado', 'no_aprobado')),
  estatus text
    check (estatus is null or estatus in ('recibido', 'en_revision', 'en_proceso', 'resuelto', 'cerrado')),
  notas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_buzon_aprobacion_created
  on public.buzon_registros (aprobacion, created_at desc);

create index if not exists idx_buzon_estatus_created
  on public.buzon_registros (estatus, created_at desc);

create index if not exists idx_buzon_codigo
  on public.buzon_registros (codigo_seguimiento);

create index if not exists idx_buzon_departamento_created
  on public.buzon_registros (departamento, created_at desc);

alter table public.buzon_registros enable row level security;

revoke all on table public.buzon_registros from anon, authenticated;
grant select, insert, update, delete on table public.buzon_registros to service_role;

comment on table public.buzon_registros is
  'Buzón: quejas/requerimientos. Primero aprobación; estatus solo si aprobado.';

-- Bucket de evidencias (lectura pública de URL; subida solo service_role vía API).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buzon-evidencias',
  'buzon-evidencias',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  name = excluded.name,
  file_size_limit = coalesce(excluded.file_size_limit, 5242880),
  allowed_mime_types = coalesce(
    excluded.allowed_mime_types,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  );

drop policy if exists "Publico puede ver evidencias buzon" on storage.objects;
create policy "Publico puede ver evidencias buzon"
on storage.objects
for select
to public
using (bucket_id = 'buzon-evidencias');
