-- Listado operaciones: devolver todas las filas del submódulo (oficial con o sin calificado_por).
-- Complementa el arreglo en servidor que también lee el JSON legacy de JT.
-- Ejecutar en Supabase SQL Editor si las calificaciones oficial→JT no aparecen.

create or replace function public.cat_list_evaluaciones_modulo(
  p_modulo text,
  p_submodulo text default null
)
returns setof jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(e)
  from public.cat_evaluacion e
  where e.modulo = p_modulo
    and (
      p_submodulo is null
      or p_submodulo = ''
      or p_modulo <> 'operaciones'
      or e.submodulo = p_submodulo
    );
$$;

grant execute on function public.cat_list_evaluaciones_modulo(text, text) to service_role;

notify pgrst, 'reload schema';
