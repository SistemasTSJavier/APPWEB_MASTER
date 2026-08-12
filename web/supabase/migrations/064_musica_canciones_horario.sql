-- Ajuste si 063 ya se aplicó con columna prioridad (sin horario).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'musica_canciones' and column_name = 'prioridad'
  ) then
    alter table public.musica_canciones drop column prioridad;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'musica_canciones' and column_name = 'hora_inicio'
  ) then
    alter table public.musica_canciones
      add column hora_inicio time not null default '00:00';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'musica_canciones' and column_name = 'hora_fin'
  ) then
    alter table public.musica_canciones
      add column hora_fin time not null default '23:59';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'musica_canciones' and column_name = 'peticion_especial'
  ) then
    alter table public.musica_canciones
      add column peticion_especial boolean not null default false;
  end if;
end $$;

drop index if exists public.idx_musica_canciones_estado_fecha;
create index if not exists idx_musica_canciones_estado_fecha
  on public.musica_canciones (estado, fecha_programada, peticion_especial, created_at);
