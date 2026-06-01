-- Categorización: personal, evaluaciones 1-5, capacitaciones y resúmenes.
-- Ejecutar en Supabase SQL Editor. RLS sin políticas → solo service_role (API servidor).

create table if not exists public.cat_personal (
  no_empleado text primary key,
  periodo_evaluacion text not null default '',
  fecha_ingreso text not null default '',
  nombre text not null default '',
  servicio text not null default '',
  puesto text not null default '',
  fecha_nacimiento text not null default '',
  edad text not null default '',
  escolaridad text not null default '',
  estatus text not null default '',
  fecha_baja text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cat_personal_periodo on public.cat_personal (periodo_evaluacion);
create index if not exists idx_cat_personal_nombre on public.cat_personal (nombre);

comment on table public.cat_personal is 'Personal inscrito en programa de categorización / capacitación.';

create table if not exists public.cat_evaluacion (
  no_empleado text not null references public.cat_personal (no_empleado) on delete cascade,
  modulo text not null check (modulo in ('recursos_humanos', 'operaciones', 'enfoque_cliente')),
  scores jsonb not null default '{}'::jsonb,
  comentarios text not null default '',
  promedio numeric(4, 2),
  updated_at timestamptz not null default now(),
  primary key (no_empleado, modulo)
);

comment on table public.cat_evaluacion is 'Calificación 1-5 por módulo (RH, Operaciones, Enfoque al cliente).';

create table if not exists public.cat_capacitacion_curso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_inicio date,
  fecha_vencimiento date not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_cat_cap_curso_vence on public.cat_capacitacion_curso (fecha_vencimiento);

create table if not exists public.cat_capacitacion_registro (
  id uuid primary key default gen_random_uuid(),
  no_empleado text not null references public.cat_personal (no_empleado) on delete cascade,
  curso_id uuid not null references public.cat_capacitacion_curso (id) on delete restrict,
  asistencia smallint check (asistencia between 1 and 5),
  desempeno smallint check (desempeno between 1 and 5),
  promedio numeric(4, 2),
  comentarios text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cat_cap_reg_no on public.cat_capacitacion_registro (no_empleado);

alter table public.cat_personal enable row level security;
alter table public.cat_evaluacion enable row level security;
alter table public.cat_capacitacion_curso enable row level security;
alter table public.cat_capacitacion_registro enable row level security;

grant select, insert, update, delete on table public.cat_personal to service_role;
grant select, insert, update, delete on table public.cat_evaluacion to service_role;
grant select, insert, update, delete on table public.cat_capacitacion_curso to service_role;
grant select, insert, update, delete on table public.cat_capacitacion_registro to service_role;
