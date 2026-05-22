-- Si PostgREST devuelve "permission denied for table …" (SQLSTATE 42501) con la clave
-- service_role correcta, falta GRANT explícito para ese rol sobre las tablas públicas.
-- Ejecutar en Supabase → SQL Editor (una vez por proyecto).

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.colaboradores to service_role;
grant select, insert, update, delete on table public.moper_historial to service_role;
grant select, insert, update, delete on table public.moper_registros to service_role;
grant select, insert, update, delete on table public.moper_folio_seq to service_role;
grant usage, select on sequence public.moper_registros_id_seq to service_role;
