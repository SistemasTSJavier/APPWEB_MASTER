-- =============================================================================
-- DS3 — Archivos por colaborador (consulta y subida, máx. 5 MB c/u)
-- =============================================================================
-- Ruta: {NO_EMPLEADO}/{uuid}_{nombre_original.ext}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'colaboradores-ds3',
  'colaboradores-ds3',
  true,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  name = excluded.name,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Publico puede ver archivos ds3" on storage.objects;
create policy "Publico puede ver archivos ds3"
on storage.objects
for select
to public
using (bucket_id = 'colaboradores-ds3');
