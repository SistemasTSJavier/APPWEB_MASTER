-- Categorización completa (si falta 016) + columnas JT en cat_evaluacion.
-- Ejecutar en Supabase SQL Editor cuando cat_evaluacion no existe o falta submodulo/calificado_por.

-- ── Tablas base (016) ─────────────────────────────────────────────────────────

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
  submodulo text not null default '',
  calificado_por text not null default '',
  scores jsonb not null default '{}'::jsonb,
  comentarios text not null default '',
  promedio numeric(4, 2),
  updated_at timestamptz not null default now(),
  primary key (no_empleado, modulo, submodulo, calificado_por)
);

comment on table public.cat_evaluacion is 'Calificación 1-5 por módulo (RH, Operaciones, Enfoque al cliente).';
comment on column public.cat_evaluacion.submodulo is
  'Vacío para RH y Enfoque al cliente. En operaciones: oficial | jefe_turno.';
comment on column public.cat_evaluacion.calificado_por is
  'N.º del oficial que califica al JT. Vacío en RH, enfoque y operaciones-perfil oficial.';

create table if not exists public.cat_capacitacion_curso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_inicio date,
  fecha_vencimiento date not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cat_capacitacion_curso
  add column if not exists fecha_inicio date;

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

-- ── Actualizar cat_evaluacion creada por 016 (sin submodulo / calificado_por) ─

alter table public.cat_evaluacion
  add column if not exists submodulo text not null default '';

alter table public.cat_evaluacion
  add column if not exists calificado_por text not null default '';

update public.cat_evaluacion
set submodulo = 'oficial'
where modulo = 'operaciones' and (submodulo is null or submodulo = '');

do $$
declare
  pk_cols text;
begin
  select string_agg(a.attname, ',' order by a.attnum)
  into pk_cols
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = 'public.cat_evaluacion'::regclass
    and c.contype = 'p';

  if pk_cols is not null and pk_cols <> 'no_empleado,modulo,submodulo,calificado_por' then
    alter table public.cat_evaluacion drop constraint if exists cat_evaluacion_pkey;
    alter table public.cat_evaluacion
      add primary key (no_empleado, modulo, submodulo, calificado_por);
  end if;
exception
  when undefined_table then null;
end $$;

-- ── Permisos (service_role vía API) ───────────────────────────────────────────

alter table public.cat_personal enable row level security;
alter table public.cat_evaluacion enable row level security;
alter table public.cat_capacitacion_curso enable row level security;
alter table public.cat_capacitacion_registro enable row level security;

grant select, insert, update, delete on table public.cat_personal to service_role;
grant select, insert, update, delete on table public.cat_evaluacion to service_role;
grant select, insert, update, delete on table public.cat_capacitacion_curso to service_role;
grant select, insert, update, delete on table public.cat_capacitacion_registro to service_role;

-- Refrescar caché de PostgREST tras cambios de columnas
notify pgrst, 'reload schema';
