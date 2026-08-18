-- Destinatario de la alerta de llegada: lo configura el Administrador en la sección,
-- no en variables de entorno.

create table if not exists public.alertas_legal_config (
  id smallint primary key default 1 check (id = 1),
  email_to text not null default 'legal@tacticalsupport.com.mx',
  updated_at timestamptz not null default now(),
  updated_by_email text not null default ''
);

insert into public.alertas_legal_config (id, email_to)
values (1, 'legal@tacticalsupport.com.mx')
on conflict (id) do nothing;

alter table public.alertas_legal_config enable row level security;

comment on table public.alertas_legal_config is
  'Correo destinatario de Alertas Legal (llegada a firmar). Editable por Administrador en la app.';

grant select, insert, update, delete on table public.alertas_legal_config to service_role;
