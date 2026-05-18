-- Cuadrícula de asistencia (semana + planta) compartida entre entornos (local/producción).

create table if not exists public.cuadricula_asistencia (
  week_start_iso date not null,
  scope_key text not null,
  payload jsonb not null,
  service_no text,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (week_start_iso, scope_key)
);

comment on table public.cuadricula_asistencia is
  'Asistencia semanal por planta (payload = filas cuadrícula JSON). scope_key ej. planta:NOMBRE.';

create index if not exists idx_cuadricula_asistencia_saved_at
  on public.cuadricula_asistencia (saved_at desc);

grant select, insert, update, delete on table public.cuadricula_asistencia to service_role;
