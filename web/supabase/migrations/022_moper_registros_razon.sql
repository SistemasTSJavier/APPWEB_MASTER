alter table public.moper_registros
  add column if not exists razon text not null default '';

comment on column public.moper_registros.razon is 'Razón del movimiento (texto libre, sección B comparativa).';
