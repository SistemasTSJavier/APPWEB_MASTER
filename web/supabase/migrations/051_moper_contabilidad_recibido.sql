-- Recepción contable de MOPER completados y seguimiento de notificaciones por correo.

alter table public.moper_registros
  add column if not exists email_contabilidad_enviado_at timestamptz,
  add column if not exists recibido_contabilidad_at timestamptz,
  add column if not exists recibido_contabilidad_por text;

create index if not exists idx_moper_registros_contabilidad_created
  on public.moper_registros (created_at desc)
  where completado = true and estado <> 'cancelado';

create index if not exists idx_moper_registros_contabilidad_recibido
  on public.moper_registros (recibido_contabilidad_at desc nulls last)
  where completado = true and estado <> 'cancelado';

comment on column public.moper_registros.email_contabilidad_enviado_at is
  'Última notificación enviada a contabilidad (Resend).';
comment on column public.moper_registros.recibido_contabilidad_at is
  'Fecha en que contabilidad marcó el MOPER como recibido (cambio oficial).';
comment on column public.moper_registros.recibido_contabilidad_por is
  'Nombre o correo del usuario de contabilidad que confirmó recepción.';
