-- Congelar evaluaciones en julio 2026 sin chocar con PK
-- (no_empleado, modulo, submodulo, calificado_por, period_month).
-- Úsalo si 061 falló en el UPDATE a 2026-07 por duplicados.

-- 1) Si ya existe fila en 2026-07 para la misma clave, borrar las de otros meses
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

-- 2) Si hay varias filas fuera de julio para la misma clave, dejar solo la más reciente
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

-- 3) Ya sin choques: todo lo restante → julio
update public.cat_evaluacion
set period_month = '2026-07'
where period_month is distinct from '2026-07';

-- 4) Recompensas: mes vacío o >= agosto → julio (sin tocar julio ya fijado)
update public.cat_recompensa
set mes = '2026-07'
where mes is null
   or btrim(mes) = ''
   or mes >= '2026-08';

-- 5) RPC de periodos (por si 061 no llegó aquí)
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
