# 📊 Sistema Mejorado de Integridad de Asistencia

## 🔍 Problemas Resueltos

### ❌ Problemas Anteriores
- Pérdida de datos durante importaciones
- **Eliminación de datos previos al guardar** ⚠️
- Sin auditoría de quién cambió qué y cuándo
- Sin backups automáticos
- Sin validación de integridad de datos
- Imposible recuperar datos perdidos
- Difficult debugging sin logs detallados

### ✅ Soluciones Implementadas

## 1. **Validación de Integridad** ✔️

Ahora cada importación valida:
- ✓ Estructura de filas (empNo/noEmpleado requerido)
- ✓ Presencia de shifts (7 días de la semana)
- ✓ Tipos de datos correctos
- ✓ Rechaza datos inválidos antes de guardar

---

## 1.5 **MERGE Automático de Datos** 🔄 ⭐ NUEVO

**El sistema NUNCA sobrescribe datos previos.** En su lugar:

1. **Al guardar:** Carga datos previos de esa semana/planta
2. **Combina:** Une datos nuevos con anteriores por empleado (empNo)
3. **Prevalece:** Datos nuevos reemplazan anteriores del mismo empleado
4. **Mantiene:** Datos antiguos de empleados no en la importación se preservan
5. **Registra:** Audita qué se agregó, modificó o mantuvo

**Ejemplo:**

```
ANTES (base de datos):
- E001: Asistencia D/T/N/D/T/N/D (semana anterior)
- E002: Asistencia D/T/N/D/T/N/D
- E003: Asistencia D/T/N/D/T/N/D

IMPORTAS AHORA (solo E001 y E002):
- E001: Asistencia ACTUALIZADO
- E002: Asistencia ACTUALIZADO

RESULTADO GUARDADO (merge automático):
- E001: Asistencia ACTUALIZADO ✓ (reemplazado)
- E002: Asistencia ACTUALIZADO ✓ (reemplazado)
- E003: Asistencia D/T/N/D/T/N/D ✓ (preservado)

AUDITORÍA:
"2 agregados, 1 modificado, 0 removidos"
```

**Logs:**
```
[ASISTENCIA-SAVE] Merge: 3 filas previas + 2 nuevas = 3 totales
[ASISTENCIA-SYNC] ✓ 2026-06-23/planta:admin: 0 agregados, 2 modificados, 0 removidos
```

---

## 2. **Auditoría Completa** 📝

**Tabla:** `cuadricula_asistencia_audit`

Cada cambio registra:
- **Quién:** `user_id`, `user_role`
- **Qué:** `action` (import, sync, manual_edit, restore)
- **Cuándo:** `timestamp`
- **Cambios:** `rows_affected`, `summary` (addidos, modificados, removidos)
- **Integridad:** `previous_hash` → `new_hash`
- **Estado:** `status` (success, failed, partial)
- **Errores:** `error_message` (si algo falló)

**Consultar auditoría:**
```bash
curl -X GET "https://tu-app.vercel.app/api/asistencia/audit?weekStartIso=2026-06-23&scopeKey=planta:admin&limit=20"
```

Respuesta:
```json
{
  "items": [
    {
      "id": "uuid",
      "week_start_iso": "2026-06-23",
      "scope_key": "planta:admin",
      "action": "sync",
      "user_id": "user123",
      "user_role": "admin",
      "timestamp": "2026-06-23T10:30:00Z",
      "rows_affected": 45,
      "status": "success",
      "notes": "15 agregados, 25 modificados, 5 removidos"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

## 3. **Backups Automáticos** 💾

**Tabla:** `cuadricula_asistencia_backups`

Se crea un backup automático **ANTES** de cada cambio importante:
- Guarda snapshot completo del estado anterior
- Calcula `hash` para detectar corrupción
- Etiqueta con `backup_reason` (pre_import, pre_sync)
- Marca `backed_up_at` para trazabilidad

---

## 4. **Comparación de Cambios** 🔄

Cada operación detecta:
```javascript
{
  changed: true,
  addedRows: 5,
  modifiedRows: 12,
  removedRows: 0,
  summary: "5 agregados, 12 modificados, 0 removidos"
}
```

Esto aparece en:
- Auditoría
- Logs del servidor
- Respuesta de API

---

## 5. **Recuperación de Datos** 🔙

Si accidentalmente se pierden datos, solo admin puede recuperarlos:

```bash
# Opción 1: Recuperar desde un backup específico
curl -X POST "https://tu-app.vercel.app/api/asistencia/audit" \
  -H "Content-Type: application/json" \
  -d {
    "backupId": "uuid-del-backup"
  }

# Opción 2: Recuperar el último backup de una semana/planta
curl -X POST "https://tu-app.vercel.app/api/asistencia/audit" \
  -H "Content-Type: application/json" \
  -d {
    "weekStartIso": "2026-06-23",
    "scopeKey": "planta:admin"
  }
```

Respuesta:
```json
{
  "ok": true,
  "restored": {
    "weekStartIso": "2026-06-23",
    "scopeKey": "planta:admin",
    "rowsCount": 45,
    "backedUpAt": "2026-06-23T09:15:00Z",
    "message": "Datos restaurados exitosamente"
  }
}
```

---

## 6. **Logs Detallados** 📋

Todas las operaciones generan logs para debugging:

```
[ASISTENCIA-SYNC] ✓ 2026-06-23/planta:admin: 5 agregados, 12 modificados, 0 removidos
[ASISTENCIA-VALIDACIÓN] Fila 5: falta empNo/noEmpleado
[ASISTENCIA] Error en upsert para 2026-06-23/planta:admin: ...
```

Ver logs:
- **Vercel:** Dashboard → Logs
- **Local:** Consola del navegador → Network → Respuesta de API

---

## 🎯 Cómo Usar en Desarrollo

### 1. **Importar Asistencia (Cuadrícula)**

El sistema ahora:
1. ✓ Valida cada fila antes de importar
2. ✓ Crea backup automático del estado anterior
3. ✓ Compara y registra qué cambió
4. ✓ Registra todo en auditoría
5. ✓ Rechaza si hay errores críticos

Si ves error de validación:
- Revisa que cada persona tenga `empNo` o `noEmpleado`
- Verifica que tenga 7 valores de asistencia (una semana)
- Comprueba tipos de datos correctos

### 2. **Consultar Auditoría**

En admin panel (próximamente):
- Nueva sección: "Auditoría de Asistencia"
- Filtrar por semana, planta, usuario, acción
- Ver historial completo de cambios
- Botón "Recuperar" para restaurar backups

### 3. **Si Se Pierden Datos**

**Paso 1:** Consultar auditoría
```bash
curl "https://tu-app.vercel.app/api/asistencia/audit?weekStartIso=2026-06-23"
```

**Paso 2:** Encontrar backup más reciente (antes del problema)

**Paso 3:** Recuperar desde ese backup (solo admin)
```bash
curl -X POST "https://tu-app.vercel.app/api/asistencia/audit" \
  -d '{"backupId": "..."}'
```

---

## 🔐 Permisos

| Acción | Requiere |
|--------|----------|
| Consultar auditoría | `admin` o `gerente_legal` |
| Importar/editar asistencia | `admin` o `jefe_cuadricula` |
| **Recuperar datos** | **`admin` SOLO** |

---

## 📊 Tablas Nuevas

### `cuadricula_asistencia_audit`
- Registro de CADA cambio
- Quién, qué, cuándo, por qué
- Hash anterior/nuevo para detectar corrupción

### `cuadricula_asistencia_backups`
- Snapshots automáticos ANTES de cambios
- Permite recuperación fácil
- Etiquetado por razón de backup

### `cuadricula_asistencia_recovery_points`
- Puntos de recuperación nombrados
- Ejemplo: "before_batch_import_2026_06_23"
- Facilita restauración planeada

---

## 🧪 Probar en Local

```bash
cd web

# 1. Crear tablas de auditoría
npx supabase db push

# 2. Importar asistencia desde cuadrícula
# (Automáticamente validará y auditará)

# 3. Consultar auditoría
curl -X GET "http://localhost:3000/api/asistencia/audit?weekStartIso=2026-06-23"

# 4. Simular recuperación
curl -X POST "http://localhost:3000/api/asistencia/audit" \
  -H "Content-Type: application/json" \
  -d '{"backupId": "..."}'
```

---

## 🐛 Debugging

Si algo sale mal:

1. **Mira los logs:**
   ```bash
   # Vercel logs
   vercel logs
   
   # Local: consola del navegador (F12)
   ```

2. **Consulta auditoría:**
   ```bash
   curl "https://tu-app.vercel.app/api/asistencia/audit?scopeKey=planta:admin&limit=100"
   ```

3. **Valida integridad:**
   - Si ves "Errores de validación", revisa estructura de datos
   - Comprueba que empNo no esté vacío
   - Verifica que shifts tenga 7 elementos

4. **Recupera si es necesario:**
   - Contacta a admin
   - Admin ejecuta POST a `/api/asistencia/audit` con backupId

---

## ✅ Checklist: Migración Exitosa

- [ ] Migraciones aplicadas: `050_asistencia_audit_and_backups.sql`
- [ ] Archivos actualizados: `lib/attendance-integrity.ts`, `app/api/asistencia/*`
- [ ] Deployado a producción/staging
- [ ] Importar asistencia de prueba (debe validar)
- [ ] Consultar auditoría: `/api/asistencia/audit`
- [ ] Prueba de recuperación: Restaurar backup antiguo
- [ ] Monitores en lugar (alertas si errores > 5%)

---

## 📞 Soporte

- **Error de validación:** Revisa mensaje de error (lista detallada de problemas)
- **Datos perdidos:** Consulta auditoría, luego recupera desde backup
- **No aparecen en consulta:** Verifica que validación pasó (chequea auditoría)
- **Slow import:** Monitorea cantidad de filas (>500 podría ser lento)

---

**Última actualización:** 2026-06-23
**Version:** 2.0 (con auditoría y backups)
