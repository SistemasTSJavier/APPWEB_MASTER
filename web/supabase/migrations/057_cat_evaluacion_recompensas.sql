-- Amplía cat_evaluacion para el módulo Recompensas (bonos, empleado del mes, reconocimientos).

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'cat_evaluacion'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%modulo%'
  loop
    execute format('alter table public.cat_evaluacion drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.cat_evaluacion
  add constraint cat_evaluacion_modulo_check
  check (modulo in ('recursos_humanos', 'operaciones', 'enfoque_cliente', 'recompensas'));

comment on constraint cat_evaluacion_modulo_check on public.cat_evaluacion is
  'Módulos de evaluación: RH, operaciones, enfoque al cliente y recompensas.';
