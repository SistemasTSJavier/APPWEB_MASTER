-- =============================================================================
-- EXPEDIENTES LEGAL — Aumentar límite por archivo a 256 MiB
-- =============================================================================
-- Ejecuta en Supabase SQL Editor si ya aplicaste la 006 con 20 MB.
-- =============================================================================

update storage.buckets
set file_size_limit = 268435456
where id = 'colaboradores-expedientes-legal';
