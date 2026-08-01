-- Informe ejecutivo PEO: acciones correctivas, seguimiento y evidencias.

alter table public.peo_evaluaciones
  add column if not exists acciones_correctivas text[] not null default '{}';

alter table public.peo_evaluaciones
  add column if not exists acciones_seguimiento jsonb not null default '[]'::jsonb;

comment on column public.peo_evaluaciones.acciones_correctivas is
  'Lista de acciones correctivas inmediatas capturadas en la evaluación.';
comment on column public.peo_evaluaciones.acciones_seguimiento is
  'JSON array: [{accion, responsable, fecha_compromiso}].';

create table if not exists public.peo_evaluacion_evidencias (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.peo_evaluaciones(id) on delete cascade,
  storage_path text not null,
  nombre_archivo text not null,
  mime text not null default 'application/octet-stream',
  created_at timestamptz not null default now(),
  unique (evaluacion_id, storage_path)
);

create index if not exists idx_peo_evidencias_evaluacion
  on public.peo_evaluacion_evidencias (evaluacion_id, created_at desc);

alter table public.peo_evaluacion_evidencias enable row level security;

revoke all on table public.peo_evaluacion_evidencias from anon, authenticated;
grant select, insert, update, delete on table public.peo_evaluacion_evidencias to service_role;

comment on table public.peo_evaluacion_evidencias is
  'Metadatos de evidencias (storage peo-evidencias) ligadas a una evaluación PEO.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'peo-evidencias',
  'peo-evidencias',
  true,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  name = excluded.name,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Publico puede ver evidencias peo" on storage.objects;
create policy "Publico puede ver evidencias peo"
on storage.objects
for select
to public
using (bucket_id = 'peo-evidencias');
