-- Registro de correos de alerta de vencimiento de contrato (evita reenvíos duplicados).
create table if not exists public.legal_contrato_alerta_enviada (
  no_empleado text not null,
  vencimiento_contrato date not null,
  destinatario text not null default 'legla@tacticalsupport.com.mx',
  enviado_en timestamptz not null default now(),
  primary key (no_empleado, vencimiento_contrato)
);

create index if not exists legal_contrato_alerta_enviado_en_idx
  on public.legal_contrato_alerta_enviada (enviado_en desc);

alter table public.legal_contrato_alerta_enviada enable row level security;

grant all on public.legal_contrato_alerta_enviada to service_role;
