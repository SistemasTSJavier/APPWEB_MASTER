-- Tipo de prueba: simulación vs real (historial y dashboard separados).
alter table public.peo_evaluaciones
  add column if not exists tipo text not null default 'simulacion'
  check (tipo in ('simulacion', 'real'));

-- Filas previas quedan como simulación (valor por defecto).
update public.peo_evaluaciones
set tipo = 'simulacion'
where tipo is null or btrim(tipo) = '';

create index if not exists idx_peo_eval_tipo_fecha
  on public.peo_evaluaciones (tipo, evaluada_en desc);

create index if not exists idx_peo_eval_empleado_tipo_fecha
  on public.peo_evaluaciones (no_empleado, tipo, evaluada_en desc);

comment on column public.peo_evaluaciones.tipo is
  'simulacion = ejercicio controlado; real = incidente/operación real.';
