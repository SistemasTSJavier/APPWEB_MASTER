-- =============================================================================
-- FOTOS FICHA TÉCNICA — Bucket de Storage en Supabase
-- =============================================================================
-- Cómo aplicar:
--   1. Supabase Dashboard → tu proyecto → SQL → New query
--   2. Pega TODO este archivo y pulsa RUN (o Ctrl+Enter)
--   3. Reinicia "npm run dev" si la app ya estaba abierta
--
-- Alternativa por interfaz: Storage → New bucket → nombre exacto:
--   colaboradores-fotos  → marcar "Public bucket" → Create
--   (luego igual ejecuta la parte de POLICIES de abajo si la lectura pública falla)
-- =============================================================================

-- Bucket público (la app guarda la URL en expediente form.fichaFotoUrl)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'colaboradores-fotos',
  'colaboradores-fotos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  name = excluded.name,
  file_size_limit = coalesce(excluded.file_size_limit, 2097152),
  allowed_mime_types = coalesce(excluded.allowed_mime_types, array['image/jpeg', 'image/png', 'image/webp']::text[]);

-- Lectura pública de archivos (el navegador muestra la foto con getPublicUrl)
drop policy if exists "Publico puede ver fotos ficha" on storage.objects;
create policy "Publico puede ver fotos ficha"
on storage.objects
for select
to public
using (bucket_id = 'colaboradores-fotos');

-- La subida la hace la API con SERVICE_ROLE_KEY: en Supabase suele omitir RLS.
-- Si al subir ves error de RLS/policy, descomenta y ejecuta de nuevo:
--
-- drop policy if exists "Service role fotos ficha insert" on storage.objects;
-- create policy "Service role fotos ficha insert"
-- on storage.objects for insert to service_role
-- with check (bucket_id = 'colaboradores-fotos');
--
-- drop policy if exists "Service role fotos ficha update" on storage.objects;
-- create policy "Service role fotos ficha update"
-- on storage.objects for update to service_role
-- using (bucket_id = 'colaboradores-fotos');
--
-- drop policy if exists "Service role fotos ficha delete" on storage.objects;
-- create policy "Service role fotos ficha delete"
-- on storage.objects for delete to service_role
-- using (bucket_id = 'colaboradores-fotos');
