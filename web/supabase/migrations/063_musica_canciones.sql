-- Playlist / solicitudes de canciones (YouTube) por departamento.
create table if not exists public.musica_canciones (
  id uuid primary key default gen_random_uuid(),
  youtube_url text not null,
  youtube_video_id text not null,
  titulo text not null default '',
  artista text not null default '',
  departamento text not null default '',
  solicitado_por text not null default '',
  mensaje text not null default '',
  user_email text null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada')),
  -- Día en que debe sonar (calendario).
  fecha_programada date null,
  -- Ventana horaria (America/Mexico_City) en que aparece la playlist / canción.
  hora_inicio time not null default '00:00',
  hora_fin time not null default '23:59',
  -- Petición especial: se agrega ya a la lista del día (admin: «Añadir ahora»).
  peticion_especial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_musica_canciones_estado_fecha
  on public.musica_canciones (estado, fecha_programada, peticion_especial, created_at);

create index if not exists idx_musica_canciones_created
  on public.musica_canciones (created_at desc);

alter table public.musica_canciones enable row level security;

comment on table public.musica_canciones is
  'Canciones propuestas (URL YouTube). Admin aprueba, programa día + horario, o añade ahora como petición especial.';

grant select, insert, update, delete on table public.musica_canciones to service_role;
