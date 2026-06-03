-- Control de ejecución automática del envío de alertas (evita duplicados el mismo día).
create table if not exists public.legal_contrato_cron_state (
  id smallint primary key default 1 check (id = 1),
  ultima_ejecucion timestamptz,
  ultimo_enviados int not null default 0,
  ultimo_error text
);

insert into public.legal_contrato_cron_state (id)
values (1)
on conflict (id) do nothing;

alter table public.legal_contrato_cron_state enable row level security;
grant all on public.legal_contrato_cron_state to service_role;
