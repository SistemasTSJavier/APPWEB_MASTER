import { elegirValorIdentificacionAsistencia } from './attendanceGridColumns'
import { emptyShifts, WEEK_COLUMNS, ZERO_TOTALS, type GridRow } from './mockData'
import { plantaToStorageKey } from './cuadriculaColaboradoresBridge'
import { empNoClaveGridRow, indexGridRowsByEmpNo } from '@/lib/attendance-emp-no'
import { sortGridRowsByPosicion } from './attendanceGridSort'
import type { VacanteRegistro } from './vacantesStorage'
import { normPosicionKey, slotFromVacanteRegistro, slotVacanteKey } from '@/lib/vacantes-slot'

function slotKeyFromGridRow(r: GridRow): string {
  return slotVacanteKey({
    planta: (r.plantaLinea ?? '').trim().toUpperCase(),
    posicion: r.position,
    servicioLinea: r.servicioLinea,
    rowServiceNo: r.rowServiceNo,
  })
}

export { normPosicionKey } from '@/lib/vacantes-slot'

export function createVacantGridRow(
  planta: string,
  position: string,
  opts?: {
    id?: string
    puesto?: string
    servicioLinea?: string
    rowServiceNo?: string
  },
): GridRow {
  const plantaN = planta.trim().toUpperCase()
  const pos = position.trim().toUpperCase()
  const scope = plantaToStorageKey(plantaN).replace(/:/g, '_') || 'planta'
  return {
    id: opts?.id ?? `vacant:${scope}:${pos}`,
    position: pos || '—',
    role: (opts?.puesto ?? '').trim().toUpperCase() || '—',
    hireDate: '—',
    employeeNo: null,
    name: 'VACANTE',
    servicioLinea: (opts?.servicioLinea ?? '').trim().toUpperCase() || '—',
    rowServiceNo: (opts?.rowServiceNo ?? '').trim() || '',
    plantaLinea: plantaN,
    vacant: true,
    shifts: emptyShifts(WEEK_COLUMNS.length),
    totals: { ...ZERO_TOTALS },
  }
}

export function vacanteRegistroToGridRow(v: VacanteRegistro): GridRow {
  return createVacantGridRow(v.planta, v.posicion, {
    id: v.id,
    puesto: v.puesto,
    servicioLinea: v.servicioLinea,
    rowServiceNo: v.rowServiceNo,
  })
}

/** Añade vacantes del catálogo que aún no están en la cuadrícula (respeta colaboradores en esa posición). */
export function injectCatalogVacantes(merged: GridRow[], catalog: VacanteRegistro[]): GridRow[] {
  if (catalog.length === 0) return merged
  const ocupadas = posicionesOcupadasPorEmpleados(merged)
  const vacantPos = new Set(merged.filter((r) => r.vacant).map((r) => slotKeyFromGridRow(r)))
  const extra: GridRow[] = []
  for (const v of catalog) {
    const pk = slotVacanteKey(slotFromVacanteRegistro(v))
    if (!normPosicionKey(v.posicion) || ocupadas.has(pk) || vacantPos.has(pk)) continue
    vacantPos.add(pk)
    extra.push(vacanteRegistroToGridRow(v))
  }
  return sortGridRowsByPosicion([...merged, ...extra])
}

/** Slots (planta + servicio + posición) ocupados por colaboradores (no vacantes). */
export function posicionesOcupadasPorEmpleados(rows: GridRow[]): Set<string> {
  const set = new Set<string>()
  for (const r of rows) {
    if (r.vacant) continue
    const k = slotKeyFromGridRow(r)
    if (normPosicionKey(r.position)) set.add(k)
  }
  return set
}

/**
 * Fusiona expediente + guardado e incluye filas vacante persistidas.
 * Si un colaborador ocupa una posición, se omite la vacante con la misma posición.
 */
export function mergeAttendanceRowsWithStoredAndVacantes(
  base: GridRow[],
  storedRows: GridRow[],
): GridRow[] {
  const byKey = indexGridRowsByEmpNo(storedRows.filter((r) => !r.vacant))

  const merged = base.map((br) => {
    const k = empNoClaveGridRow(br)
    const s = k ? byKey.get(k) : undefined
    if (!s?.shifts || s.shifts.length !== br.shifts.length) return br
    return {
      ...br,
      shifts: s.shifts,
      employeeNo: br.employeeNo ?? s.employeeNo ?? k,
      id: br.id,
      rowServiceNo: elegirValorIdentificacionAsistencia(br.rowServiceNo, s.rowServiceNo),
      servicioLinea: elegirValorIdentificacionAsistencia(br.servicioLinea, s.servicioLinea),
      plantaLinea: elegirValorIdentificacionAsistencia(br.plantaLinea, s.plantaLinea) || br.plantaLinea || s.plantaLinea,
      position: elegirValorIdentificacionAsistencia(br.position, s.position),
      role: elegirValorIdentificacionAsistencia(br.role, s.role),
      name: elegirValorIdentificacionAsistencia(br.name, s.name),
      hireDate: elegirValorIdentificacionAsistencia(br.hireDate, s.hireDate),
    }
  })

  const ocupadas = posicionesOcupadasPorEmpleados(merged)
  const vacantes: GridRow[] = []
  const seenVacantPos = new Set<string>()

  for (const r of storedRows) {
    if (!r.vacant) continue
    const pk = slotKeyFromGridRow(r)
    if (!normPosicionKey(r.position) || ocupadas.has(pk) || seenVacantPos.has(pk)) continue
    seenVacantPos.add(pk)
    vacantes.push({
      ...r,
      vacant: true,
      name: 'VACANTE',
      employeeNo: null,
      plantaLinea: r.plantaLinea ?? merged[0]?.plantaLinea,
    })
  }

  return sortGridRowsByPosicion([...merged, ...vacantes])
}

export function puedeAgregarVacanteEnPosicion(
  rows: GridRow[],
  position: string,
  opts?: { servicioLinea?: string; rowServiceNo?: string; planta?: string },
): boolean {
  const pk = normPosicionKey(position)
  if (!pk) return false
  const key = slotVacanteKey({
    planta: opts?.planta ?? '',
    posicion: position,
    servicioLinea: opts?.servicioLinea,
    rowServiceNo: opts?.rowServiceNo,
  })
  for (const r of rows) {
    if (slotKeyFromGridRow(r) === key) return false
  }
  return true
}
