-- Registros MOPER (formulario, firmas, folio) — API servidor con service_role.

create table if not exists public.moper_folio_seq (
  id int primary key default 1 check (id = 1),
  next_num int not null default 280,
  updated_at timestamptz not null default now()
);

insert into public.moper_folio_seq (id, next_num)
values (1, 280)
on conflict (id) do nothing;

create table if not exists public.moper_registros (
  id bigserial primary key,
  folio text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'cancelado')),
  codigo_acceso text not null,
  oficial_nombre text not null default '',
  curp text not null default '',
  fecha_ingreso date,
  fecha_inicio_efectiva date not null,
  servicio_actual_nombre text not null default '',
  servicio_nuevo_nombre text not null default '',
  puesto_actual_nombre text not null default '',
  puesto_nuevo_nombre text not null default '',
  sueldo_actual numeric,
  sueldo_nuevo numeric not null default 0,
  motivo text not null default '',
  creado_por text,
  solicitado_por text,
  firma_conformidad_at timestamptz,
  firma_conformidad_nombre text,
  firma_conformidad_imagen text,
  firma_rh_at timestamptz,
  firma_rh_nombre text,
  firma_rh_imagen text,
  firma_gerente_at timestamptz,
  firma_gerente_nombre text,
  firma_gerente_imagen text,
  firma_control_at timestamptz,
  firma_control_nombre text,
  firma_control_imagen text,
  completado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_moper_registros_codigo on public.moper_registros (codigo_acceso);
create index if not exists idx_moper_registros_estado on public.moper_registros (estado, created_at desc);
create index if not exists idx_moper_registros_folio on public.moper_registros (folio) where folio is not null;

alter table public.moper_registros enable row level security;
alter table public.moper_folio_seq enable row level security;

comment on table public.moper_registros is 'MOPER workflow: formulario comparativo y cadena de firmas.';
comment on table public.moper_folio_seq is 'Consecutivo folio SPT/No. NNNN/MOP.';

-- Permisos PostgREST para la API (service_role). Sin esto: HTTP 500 "permission denied".
grant select, insert, update, delete on table public.moper_registros to service_role;
grant select, insert, update, delete on table public.moper_folio_seq to service_role;
-- bigserial usa secuencia; sin USAGE/SELECT falla el INSERT con "permission denied for sequence …_id_seq".
grant usage, select on sequence public.moper_registros_id_seq to service_role;
