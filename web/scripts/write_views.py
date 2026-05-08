from pathlib import Path
Path('prisma/views_excel_readonly.sql').write_text("""
-- Ejecutar en MySQL como administrador DESPUÉS de las migraciones.
-- Ajusta nombre de base de datos en GRANT si difiere.

-- CREATE USER 'excel_readonly'@'%%' IDENTIFIED BY 'CAMBIAR_PASSWORD_FUERTE';
-- GRANT SELECT ON tu_base.vw_master_resumen TO 'excel_readonly'@'%%';
-- GRANT SELECT ON tu_base.vw_moper_historial TO 'excel_readonly'@'%%';
-- FLUSH PRIVILEGES;

CREATE OR REPLACE VIEW vw_master_resumen AS
SELECT
  e.no_empleado,
  m.estatus_empleado,
  m.fecha_ingreso,
  m.fecha_baja,
  m.envio,
  m.reyna,
  m.reingreso,
  m.nombre_completo,
  m.puesto,
  m.puesto_final,
  m.servicio,
  m.servicio_final,
  m.posicion,
  m.local_foraneo,
  m.numero_folio,
  e.created_at,
  e.updated_at
FROM empleado e
INNER JOIN empleado_master m ON m.empleado_id = e.id;

CREATE OR REPLACE VIEW vw_moper_historial AS
SELECT
  e.no_empleado,
  m.nombre_completo,
  h.fecha_movimiento,
  h.servicio_origen,
  h.servicio_destino,
  h.motivo,
  h.folio_referencia,
  h.registrado_por,
  h.creado_en
FROM historial_moper h
INNER JOIN empleado e ON e.id = h.empleado_id
LEFT JOIN empleado_master m ON m.empleado_id = e.id;
""".lstrip(), encoding='utf-8')
print('views ok')
