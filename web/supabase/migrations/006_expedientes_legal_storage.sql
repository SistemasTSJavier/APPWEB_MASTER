-- =============================================================================
-- EXPEDIENTES LEGAL — PDF por colaborador (Supabase Storage)
-- =============================================================================
-- Cómo aplicar:
--   1. Supabase Dashboard → SQL → New query
--   2. Pega TODO este archivo y pulsa RUN
--   3. Reinicia "npm run dev" si la app ya estaba abierta
--
-- Ruta de objeto: {NO_EMPLEADO}/{uuid}.pdf (subida directa al Storage con URL firmada)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'colaboradores-expedientes-legal',
  'colaboradores-expedientes-legal',
  true,
  268435456,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = true,
  name = excluded.name,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = coalesce(excluded.allowed_mime_types, array['application/pdf']::text[]);

drop policy if exists "Publico puede ver expedientes legal pdf" on storage.objects;
create policy "Publico puede ver expedientes legal pdf"
on storage.objects
for select
to public
using (bucket_id = 'colaboradores-expedientes-legal');
