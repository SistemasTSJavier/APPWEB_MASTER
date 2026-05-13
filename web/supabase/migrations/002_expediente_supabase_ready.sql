-- Ejecutar en Supabase → SQL Editor después de 001_initial.sql.
-- Objetivo: triggers, índices y documentación para expediente JSON (todas las PARTES ALTAS + bajas en `data`).

-- -----------------------------------------------------------------------------
-- updated_at automático en colaboradores (API ya envía updated_at en upsert; esto cubre UPDATEs directos)
-- -----------------------------------------------------------------------------
create or replace function public.tactical_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_colaboradores_updated_at on public.colaboradores;
create trigger trg_colaboradores_updated_at
  before update on public.colaboradores
  for each row
  execute procedure public.tactical_set_updated_at();

comment on function public.tactical_set_updated_at() is 'Actualiza updated_at en cada UPDATE de public.colaboradores.';

-- -----------------------------------------------------------------------------
-- Índice GIN opcional: búsquedas por contenido JSON (metadatos, reportes)
-- -----------------------------------------------------------------------------
create index if not exists idx_colaboradores_data_gin
  on public.colaboradores using gin (data jsonb_path_ops);

-- -----------------------------------------------------------------------------
-- Comentarios de esquema (una fila = un expediente; partes ALTAS = data.form.*)
-- -----------------------------------------------------------------------------
comment on column public.colaboradores.data is
  'JSON expediente ColaboradorCompleto: snapshot (nombre, puesto, servicio…), form (PARTE 1–6 ALTAS, bajas: fechaBaja, comentarioBaja…), familiares[], moperActual. Sin tablas separadas por parte: el front y la API unifican.';

comment on column public.moper_historial.entrada is
  'MoperHistorialEntrada: historial de movimientos MOPER por colaborador.';
