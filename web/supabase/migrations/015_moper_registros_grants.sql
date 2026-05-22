-- Si ya ejecutaste 014 antes de incluir los GRANT, ejecuta este script (una vez).

grant select, insert, update, delete on table public.moper_registros to service_role;
grant select, insert, update, delete on table public.moper_folio_seq to service_role;
grant usage, select on sequence public.moper_registros_id_seq to service_role;
