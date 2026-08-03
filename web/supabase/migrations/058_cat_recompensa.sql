-- Recompensas como registros descriptivos (no calificación 1–5).
-- Bonos, empleado del mes y reconocimientos con mes y detalle.

create table if not exists public.cat_recompensa (
  id uuid primary key default gen_random_uuid(),
  no_empleado text not null,
  tipo text not null check (tipo in ('bono', 'empleado_del_mes', 'reconocimiento')),
  descripcion text not null default '',
  mes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cat_recompensa_mes_chk check (mes ~ '^[0-9]{4}-[0-9]{2}$')
);

create index if not exists cat_recompensa_empleado_idx
  on public.cat_recompensa (no_empleado);

create index if not exists cat_recompensa_tipo_mes_idx
  on public.cat_recompensa (tipo, mes desc);

comment on table public.cat_recompensa is
  'Recompensas del colaborador: bono (de qué), empleado del mes (mes), reconocimiento (de qué + mes).';

alter table public.cat_recompensa enable row level security;

grant select, insert, update, delete on table public.cat_recompensa to service_role;
