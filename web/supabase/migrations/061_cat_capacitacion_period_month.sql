-- Capacitación por mes + congelar datos actuales en julio 2026 (agosto inicia vacío).

-- 1) period_month en registros de capacitación
alter table public.cat_capacitacion_registro
  add column if not exists period_month text;

update public.cat_capacitacion_registro
set period_month = '2026-07'
where period_month is null or btrim(period_month) = '';

alter table public.cat_capacitacion_registro
  alter column period_month set default '';

alter table public.cat_capacitacion_registro
  alter column period_month set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cat_capacitacion_registro_period_month_chk'
      and conrelid = 'public.cat_capacitacion_registro'::regclass
  ) then
    alter table public.cat_capacitacion_registro
      add constraint cat_capacitacion_registro_period_month_chk
      check (period_month ~ '^[0-9]{4}-[0-9]{2}$');
  end if;
end $$;

create index if not exists cat_cap_reg_period_month_idx
  on public.cat_capacitacion_registro (period_month desc);

create index if not exists cat_cap_reg_empleado_period_idx
  on public.cat_capacitacion_registro (no_empleado, period_month desc);

comment on column public.cat_capacitacion_registro.period_month is
  'Mes del registro de capacitación (YYYY-MM) para historial de promedios.';

-- 2) Datos actuales de evaluaciones → julio 2026 (sin duplicar PK)
-- Si ya hay fila en 2026-07 para la misma clave, se descartan los otros meses.
delete from public.cat_evaluacion e
where e.period_month is distinct from '2026-07'
  and exists (
    select 1
    from public.cat_evaluacion x
    where x.no_empleado = e.no_empleado
      and x.modulo = e.modulo
      and coalesce(x.submodulo, '') = coalesce(e.submodulo, '')
      and coalesce(x.calificado_por, '') = coalesce(e.calificado_por, '')
      and x.period_month = '2026-07'
  );

delete from public.cat_evaluacion e
where e.ctid in (
  select ctid
  from (
    select
      ctid,
      row_number() over (
        partition by no_empleado, modulo, coalesce(submodulo, ''), coalesce(calificado_por, '')
        order by updated_at desc nulls last, ctid desc
      ) as rn
    from public.cat_evaluacion
    where period_month is distinct from '2026-07'
  ) t
  where rn > 1
);

update public.cat_evaluacion
set period_month = '2026-07'
where period_month is distinct from '2026-07';

-- 3) Recompensas sin mes o del mes en curso → julio (base)
update public.cat_recompensa
set mes = '2026-07'
where mes is null
   or btrim(mes) = ''
   or mes >= '2026-08';

-- 4) Periodos disponibles: evaluaciones + capacitación
create or replace function public.cat_list_period_months()
returns setof text
language sql
security definer
set search_path = public
as $$
  select m
  from (
    select distinct e.period_month as m
    from public.cat_evaluacion e
    where e.period_month ~ '^[0-9]{4}-[0-9]{2}$'
    union
    select distinct c.period_month as m
    from public.cat_capacitacion_registro c
    where c.period_month ~ '^[0-9]{4}-[0-9]{2}$'
  ) u
  order by 1 desc;
$$;

grant execute on function public.cat_list_period_months() to service_role;
