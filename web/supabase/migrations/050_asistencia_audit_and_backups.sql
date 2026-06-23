-- Migración: Crear tablas de auditoría y backups para asistencia
-- Propósito: Rastrear cambios y permitir recuperación de datos

-- Tabla de auditoría: registra todos los cambios
CREATE TABLE IF NOT EXISTS "public"."cuadricula_asistencia_audit" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "week_start_iso" text NOT NULL,
  "scope_key" text NOT NULL,
  "action" text NOT NULL, -- 'import', 'manual_edit', 'sync', 'restore'
  "user_id" text NOT NULL,
  "user_role" text NOT NULL,
  "timestamp" timestamp with time zone NOT NULL,
  "rows_affected" integer NOT NULL DEFAULT 0,
  "previous_hash" text,
  "new_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'success', -- 'success', 'failed', 'partial'
  "error_message" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_audit_week_scope" ON "public"."cuadricula_asistencia_audit"(
  "week_start_iso", "scope_key"
);

CREATE INDEX IF NOT EXISTS "idx_audit_timestamp" ON "public"."cuadricula_asistencia_audit"(
  "timestamp" DESC
);

CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "public"."cuadricula_asistencia_audit"(
  "user_id"
);

-- Tabla de backups: guarda snapshots antes de cambios importantes
CREATE TABLE IF NOT EXISTS "public"."cuadricula_asistencia_backups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "week_start_iso" text NOT NULL,
  "scope_key" text NOT NULL,
  "payload" jsonb NOT NULL,
  "service_no" text,
  "saved_at" timestamp with time zone NOT NULL,
  "backed_up_at" timestamp with time zone NOT NULL DEFAULT now(),
  "backup_reason" text, -- 'pre_import', 'pre_sync', 'pre_restore', etc.
  "hash" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_backups_week_scope" ON "public"."cuadricula_asistencia_backups"(
  "week_start_iso", "scope_key"
);

CREATE INDEX IF NOT EXISTS "idx_backups_timestamp" ON "public"."cuadricula_asistencia_backups"(
  "backed_up_at" DESC
);

-- Tabla de recuperación: proporciona puntos de restauración
CREATE TABLE IF NOT EXISTS "public"."cuadricula_asistencia_recovery_points" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "week_start_iso" text NOT NULL,
  "scope_key" text NOT NULL,
  "backup_id" uuid NOT NULL REFERENCES "public"."cuadricula_asistencia_backups"("id") ON DELETE CASCADE,
  "recovery_tag" text, -- "before_batch_import_2026_06_23", etc.
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text NOT NULL,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("backup_id") REFERENCES "public"."cuadricula_asistencia_backups"("id")
);

CREATE INDEX IF NOT EXISTS "idx_recovery_week_scope" ON "public"."cuadricula_asistencia_recovery_points"(
  "week_start_iso", "scope_key"
);

-- Comentarios para documentación
COMMENT ON TABLE "public"."cuadricula_asistencia_audit" IS 'Auditoría de cambios en asistencia: quién cambió qué, cuándo y por qué';

COMMENT ON TABLE "public"."cuadricula_asistencia_backups" IS 'Snapshots de datos de asistencia antes de cambios importantes';

COMMENT ON TABLE "public"."cuadricula_asistencia_recovery_points" IS 'Puntos de recuperación etiquetados para restauración fácil';

COMMENT ON COLUMN "public"."cuadricula_asistencia_audit"."action" IS 'Tipo de acción: import (importación masiva), manual_edit (edición manual), sync (sincronización), restore (restauración)';

COMMENT ON COLUMN "public"."cuadricula_asistencia_audit"."previous_hash" IS 'Hash del estado anterior (para detectar si los datos se corrompieron)';

COMMENT ON COLUMN "public"."cuadricula_asistencia_audit"."new_hash" IS 'Hash del nuevo estado';

-- RLS (seguridad a nivel de fila): solo admins y gerentes legales pueden ver auditoría
ALTER TABLE "public"."cuadricula_asistencia_audit" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_read_admin_gerente_legal" ON "public"."cuadricula_asistencia_audit"
  FOR SELECT TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'gerente_legal')
  );

CREATE POLICY "audit_insert_service_role" ON "public"."cuadricula_asistencia_audit"
  FOR INSERT TO service_role
  WITH CHECK (true);

ALTER TABLE "public"."cuadricula_asistencia_backups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backups_read_admin_gerente_legal" ON "public"."cuadricula_asistencia_backups"
  FOR SELECT TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'gerente_legal')
  );

CREATE POLICY "backups_insert_service_role" ON "public"."cuadricula_asistencia_backups"
  FOR INSERT TO service_role
  WITH CHECK (true);
