-- Lista de personas a vigilar en recepción (renuncia / comparecencia / finiquito).
-- Recepción marca «llegó a firmar» y se envía correo inmediato a Legal.

create table if not exists public.alertas_legal_watchlist (
  id uuid primary key default gen_random_uuid(),
  no_empleado text not null,
  nombre text not null default '',
  servicio text not null default '',
  motivo text not null default 'renuncia'
    check (motivo in ('renuncia', 'finiquito', 'convenio', 'comparecencia', 'otro')),
  notas text not null default '',
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'llego', 'cancelado')),
  created_by_email text not null default '',
  created_at timestamptz not null default now(),
  llego_at timestamptz null,
  llego_by_email text null,
  email_enviado_at timestamptz null,
  email_error text null,
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_alertas_legal_pendiente_emp
  on public.alertas_legal_watchlist (no_empleado)
  where estado = 'pendiente';

create index if not exists idx_alertas_legal_estado_created
  on public.alertas_legal_watchlist (estado, created_at desc);

alter table public.alertas_legal_watchlist enable row level security;

comment on table public.alertas_legal_watchlist is
  'Personas que Recepción debe detectar al llegar a firmar. Al marcar llegada se notifica a Legal por correo.';

grant select, insert, update, delete on table public.alertas_legal_watchlist to service_role;
