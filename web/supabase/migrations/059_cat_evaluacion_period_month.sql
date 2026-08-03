-- Calificaciones de categorización por mes (historial).
-- period_month YYYY-MM forma parte de la PK.

alter table public.cat_evaluacion
  add column if not exists period_month text;

-- Filas previas: asignar mes calendario anterior (desfase habitual).
update public.cat_evaluacion
set period_month = to_char((date_trunc('month', timezone('America/Mexico_City', now())) - interval '1 month'), 'YYYY-MM')
where period_month is null or btrim(period_month) = '';

alter table public.cat_evaluacion
  alter column period_month set default '';

alter table public.cat_evaluacion
  alter column period_month set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cat_evaluacion_period_month_chk'
      and conrelid = 'public.cat_evaluacion'::regclass
  ) then
    alter table public.cat_evaluacion
      add constraint cat_evaluacion_period_month_chk
      check (period_month ~ '^[0-9]{4}-[0-9]{2}$');
  end if;
end $$;

alter table public.cat_evaluacion drop constraint if exists cat_evaluacion_pkey;

alter table public.cat_evaluacion
  add primary key (no_empleado, modulo, submodulo, calificado_por, period_month);

comment on column public.cat_evaluacion.period_month is
  'Mes de la calificación (YYYY-MM). Cada mes conserva su propio historial de promedios.';

create index if not exists cat_evaluacion_period_month_idx
  on public.cat_evaluacion (period_month desc);

create index if not exists cat_evaluacion_modulo_period_idx
  on public.cat_evaluacion (modulo, period_month desc);

drop function if exists public.cat_upsert_evaluacion(text, text, text, text, jsonb, text, numeric);

create or replace function public.cat_upsert_evaluacion(
  p_no_empleado text,
  p_modulo text,
  p_submodulo text default '',
  p_calificado_por text default '',
  p_scores jsonb default '{}'::jsonb,
  p_comentarios text default '',
  p_promedio numeric default null,
  p_period_month text default null
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
  v_mes text := nullif(trim(coalesce(p_period_month, '')), '');
begin
  if v_mes is null or v_mes !~ '^[0-9]{4}-[0-9]{2}$' then
    v_mes := to_char(
      (date_trunc('month', timezone('America/Mexico_City', now())) - interval '1 month'),
      'YYYY-MM'
    );
  end if;

  insert into public.cat_evaluacion (
    no_empleado,
    modulo,
    submodulo,
    calificado_por,
    period_month,
    scores,
    comentarios,
    promedio,
    updated_at
  ) values (
    v_no,
    p_modulo,
    coalesce(p_submodulo, ''),
    v_cal,
    v_mes,
    coalesce(p_scores, '{}'::jsonb),
    coalesce(p_comentarios, ''),
    p_promedio,
    now()
  )
  on conflict (no_empleado, modulo, submodulo, calificado_por, period_month)
  do update set
    scores = excluded.scores,
    comentarios = excluded.comentarios,
    promedio = excluded.promedio,
    updated_at = now()
  returning * into r;

  return to_jsonb(r);
end;
$$;

-- Quitar firma anterior (2 args) para no dejar overloads ambiguos.
drop function if exists public.cat_list_evaluaciones_modulo(text, text);
drop function if exists public.cat_list_evaluaciones_modulo(text, text, text);

create or replace function public.cat_list_evaluaciones_modulo(
  p_modulo text,
  p_submodulo text default '',
  p_period_month text default ''
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
      nullif(trim(coalesce(p_period_month, '')), '') is null
      or e.period_month = trim(p_period_month)
    )
    and (
      p_submodulo is null
      or p_submodulo = ''
      or p_modulo <> 'operaciones'
      or (
        e.submodulo = p_submodulo
        and (
          p_submodulo = 'oficial'
          or (p_submodulo = 'jefe_turno' and e.calificado_por <> '')
        )
      )
    );
$$;

drop function if exists public.cat_get_evaluacion(text, text, text, text);
drop function if exists public.cat_get_evaluacion(text, text, text, text, text);

create or replace function public.cat_get_evaluacion(
  p_no_empleado text,
  p_modulo text,
  p_submodulo text default '',
  p_calificado_por text default '',
  p_period_month text default ''
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
    and (
      nullif(trim(coalesce(p_period_month, '')), '') is null
      or e.period_month = trim(p_period_month)
    )
  order by e.period_month desc
  limit 1;
$$;

create or replace function public.cat_list_period_months()
returns setof text
language sql
security definer
set search_path = public
as $$
  select distinct e.period_month
  from public.cat_evaluacion e
  where e.period_month ~ '^[0-9]{4}-[0-9]{2}$'
  order by 1 desc;
$$;

grant execute on function public.cat_upsert_evaluacion(text, text, text, text, jsonb, text, numeric, text) to service_role;
grant execute on function public.cat_list_evaluaciones_modulo(text, text, text) to service_role;
grant execute on function public.cat_get_evaluacion(text, text, text, text, text) to service_role;
grant execute on function public.cat_list_period_months() to service_role;
