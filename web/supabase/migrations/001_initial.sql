-- Ejecutar en Supabase → SQL Editor (una sola vez por proyecto).
-- Seguridad: RLS activo y sin políticas para anon/authenticated → solo service_role (API servidor) escribe/lee.

create table if not exists public.colaboradores (
  no_empleado text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_colaboradores_updated_at on public.colaboradores (updated_at desc);

alter table public.colaboradores enable row level security;

comment on table public.colaboradores is 'Expediente completo (misma forma que ColaboradorCompleto en JSON).';

create table if not exists public.moper_historial (
  id uuid primary key default gen_random_uuid(),
  no_empleado text not null,
  entrada jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_moper_historial_no on public.moper_historial (no_empleado);
create index if not exists idx_moper_historial_created on public.moper_historial (created_at desc);

alter table public.moper_historial enable row level security;

comment on table public.moper_historial is 'Movimientos MOPER; entrada = objeto MoperHistorialEntrada.';
