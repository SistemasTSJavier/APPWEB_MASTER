-- Pruebas de Efectividad Operativa: intentos históricos y puntajes normalizados.
-- La aplicación accede únicamente mediante service_role; no hay acceso directo desde navegador.

create extension if not exists pgcrypto;

create table if not exists public.peo_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (
    categoria in (
      'extorsion_simulada',
      'paquete_sospechoso_ctpat',
      'identificacion_falsa',
      'visitante_sospechoso'
    )
  ),
  plantilla_version smallint not null default 1 check (plantilla_version > 0),
  tipo text not null default 'simulacion' check (tipo in ('simulacion', 'real')),
  no_empleado text not null,
  nombre_snapshot text not null,
  servicio_snapshot text not null,
  planta_snapshot text not null default '',
  puesto_snapshot text not null default '',
  evaluador_user_id uuid not null,
  evaluador_email text not null default '',
  evaluada_en date not null default current_date,
  observaciones text not null default '',
  total numeric(5,2) not null check (total >= 0 and total <= 100),
  created_at timestamptz not null default now()
);

create table if not exists public.peo_evaluacion_puntajes (
  evaluacion_id uuid not null references public.peo_evaluaciones(id) on delete cascade,
  criterio text not null,
  etiqueta_snapshot text not null,
  orden smallint not null check (orden > 0),
  maximo numeric(5,2) not null check (maximo > 0),
  obtenido numeric(5,2) not null check (obtenido >= 0 and obtenido <= maximo),
  primary key (evaluacion_id, criterio),
  unique (evaluacion_id, orden)
);

create index if not exists idx_peo_eval_empleado_fecha
  on public.peo_evaluaciones (no_empleado, evaluada_en desc, created_at desc);
create index if not exists idx_peo_eval_servicio_fecha
  on public.peo_evaluaciones (servicio_snapshot, evaluada_en desc);
create index if not exists idx_peo_eval_categoria_fecha
  on public.peo_evaluaciones (categoria, evaluada_en desc);
create index if not exists idx_peo_eval_tipo_fecha
  on public.peo_evaluaciones (tipo, evaluada_en desc);
create index if not exists idx_peo_eval_empleado_tipo_fecha
  on public.peo_evaluaciones (no_empleado, tipo, evaluada_en desc);
create index if not exists idx_peo_puntajes_criterio
  on public.peo_evaluacion_puntajes (criterio, obtenido);

alter table public.peo_evaluaciones enable row level security;
alter table public.peo_evaluacion_puntajes enable row level security;

revoke all on table public.peo_evaluaciones from anon, authenticated;
revoke all on table public.peo_evaluacion_puntajes from anon, authenticated;
grant select, insert, update, delete on table public.peo_evaluaciones to service_role;
grant select, insert, update, delete on table public.peo_evaluacion_puntajes to service_role;

comment on table public.peo_evaluaciones is
  'Intentos históricos de Pruebas de Efectividad Operativa con snapshots del colaborador.';
comment on table public.peo_evaluacion_puntajes is
  'Puntaje obtenido por criterio para cada intento PEO.';
