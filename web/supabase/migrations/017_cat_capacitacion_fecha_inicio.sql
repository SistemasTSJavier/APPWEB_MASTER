-- Fecha de inicio en catálogo de capacitaciones (complementa 016_categorizacion.sql).

alter table public.cat_capacitacion_curso
  add column if not exists fecha_inicio date;

comment on column public.cat_capacitacion_curso.fecha_inicio is 'Fecha programada de inicio o impartición de la capacitación.';
