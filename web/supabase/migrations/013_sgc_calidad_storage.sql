-- =============================================================================
-- SGC — Sistemas de gestión de calidad (Supabase Storage)
-- =============================================================================
-- Ruta: {categoria}/{departamento}/{uuid}_{nombre-archivo}
-- Ejecutar en SQL Editor de Supabase tras desplegar la app.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'sgc-gestion-calidad',
  'sgc-gestion-calidad',
  true,
  52428800
)
on conflict (id) do update set
  public = true,
  name = excluded.name,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "Publico puede ver archivos SGC" on storage.objects;
create policy "Publico puede ver archivos SGC"
on storage.objects
for select
to public
using (bucket_id = 'sgc-gestion-calidad');
