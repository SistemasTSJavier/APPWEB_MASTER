-- Si ya aplicó 068 antigua (sin columna aprobacion), ejecute este script.
-- Si va a aplicar 068 nueva desde cero, puede omitir este archivo.

alter table public.buzon_registros
  add column if not exists aprobacion text;

update public.buzon_registros
set aprobacion = 'pendiente'
where aprobacion is null or aprobacion = '';

alter table public.buzon_registros
  alter column aprobacion set default 'pendiente';

alter table public.buzon_registros
  alter column aprobacion set not null;

-- Quitar check viejo de estatus si existe y recrear permitiendo null
do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'buzon_registros'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%estatus%'
  loop
    execute format('alter table public.buzon_registros drop constraint %I', cname);
  end loop;
end $$;

alter table public.buzon_registros
  alter column estatus drop not null;

alter table public.buzon_registros
  alter column estatus drop default;

update public.buzon_registros
set estatus = null
where coalesce(aprobacion, 'pendiente') <> 'aprobado';

do $$
begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'buzon_registros'
      and con.conname = 'buzon_registros_aprobacion_check'
  ) then
    alter table public.buzon_registros
      add constraint buzon_registros_aprobacion_check
      check (aprobacion in ('pendiente', 'aprobado', 'no_aprobado'));
  end if;

  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'buzon_registros'
      and con.conname = 'buzon_registros_estatus_check'
  ) then
    alter table public.buzon_registros
      add constraint buzon_registros_estatus_check
      check (estatus is null or estatus in ('recibido', 'en_revision', 'en_proceso', 'resuelto', 'cerrado'));
  end if;
end $$;

create index if not exists idx_buzon_aprobacion_created
  on public.buzon_registros (aprobacion, created_at desc);
