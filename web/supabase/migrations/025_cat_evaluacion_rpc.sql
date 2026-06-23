-- Funciones RPC para cat_evaluacion (evita caché PostgREST sin columnas nuevas).
-- Ejecutar en Supabase SQL Editor si tras 023/024 sigue:
--   "Could not find the 'calificado_por' column ... in the schema cache"

alter table public.cat_evaluacion
  add column if not exists submodulo text not null default '';

alter table public.cat_evaluacion
  add column if not exists calificado_por text not null default '';

update public.cat_evaluacion
set submodulo = 'oficial'
where modulo = 'operaciones' and coalesce(submodulo, '') = '';

alter table public.cat_evaluacion drop constraint if exists cat_evaluacion_pkey;

alter table public.cat_evaluacion
  add primary key (no_empleado, modulo, submodulo, calificado_por);

create or replace function public.cat_upsert_evaluacion(
  p_no_empleado text,
  p_modulo text,
  p_submodulo text default '',
  p_calificado_por text default '',
  p_scores jsonb default '{}'::jsonb,
  p_comentarios text default '',
  p_promedio numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.cat_evaluacion;
  v_no text := upper(trim(p_no_empleado));
  v_cal text := upper(trim(coalesce(p_calificado_por, '')));
begin
  insert into public.cat_evaluacion (
    no_empleado,
    modulo,
    submodulo,
    calificado_por,
    scores,
    comentarios,
    promedio,
    updated_at
  ) values (
    v_no,
    p_modulo,
    coalesce(p_submodulo, ''),
    v_cal,
    coalesce(p_scores, '{}'::jsonb),
    coalesce(p_comentarios, ''),
    p_promedio,
    now()
  )
  on conflict (no_empleado, modulo, submodulo, calificado_por)
  do update set
    scores = excluded.scores,
    comentarios = excluded.comentarios,
    promedio = excluded.promedio,
    updated_at = now()
  returning * into r;

  return to_jsonb(r);
end;
$$;

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
      or (
        e.submodulo = p_submodulo
        and (
          (p_submodulo = 'oficial' and e.calificado_por = '')
          or (p_submodulo = 'jefe_turno' and e.calificado_por <> '')
        )
      )
    );
$$;

create or replace function public.cat_get_evaluacion(
  p_no_empleado text,
  p_modulo text,
  p_submodulo text default '',
  p_calificado_por text default ''
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(e)
  from public.cat_evaluacion e
  where e.no_empleado = upper(trim(p_no_empleado))
    and e.modulo = p_modulo
    and e.submodulo = coalesce(p_submodulo, '')
    and e.calificado_por = upper(trim(coalesce(p_calificado_por, '')))
  limit 1;
$$;

grant execute on function public.cat_upsert_evaluacion(
  text, text, text, text, jsonb, text, numeric
) to service_role;

grant execute on function public.cat_list_evaluaciones_modulo(text, text) to service_role;

grant execute on function public.cat_get_evaluacion(text, text, text, text) to service_role;

notify pgrst, 'reload schema';
