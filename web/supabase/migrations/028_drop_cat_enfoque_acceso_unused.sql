-- Limpieza: accesos temporales de cliente enfoque se guardan en Supabase Auth (user_metadata).
-- Ya no se usa la tabla cat_enfoque_acceso_cliente ni sus funciones RPC.
-- Ejecutar en Supabase SQL Editor (seguro si nunca aplicó 026/027: usa IF EXISTS).

drop function if exists public.cat_list_enfoque_accesos();
drop function if exists public.cat_get_enfoque_acceso_by_user(uuid);
drop function if exists public.cat_get_enfoque_acceso_by_email(text);
drop function if exists public.cat_revocar_enfoque_acceso(uuid);
drop function if exists public.cat_insert_enfoque_acceso(text, text, uuid, date, date, text, text);

drop table if exists public.cat_enfoque_acceso_cliente cascade;

notify pgrst, 'reload schema';
