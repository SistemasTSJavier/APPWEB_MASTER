import type { GridRow, Turn } from './mockData'
import { ZERO_TOTALS } from './mockData'

const TURNS: Turn[] = ['D', 'T', 'N']

/** Código D en celda = descanso (no confundir con columna turno D). */
function isDescansoCode(v: string): boolean {
  return v.trim().toUpperCase() === 'D'
}

/** Falta: F o F1, F2… (el sistema renumerará al guardar). */
function isFaltaCode(v: string): boolean {
  const u = v.trim().toUpperCase()
  return u === 'F' || /^F[1-9]\d*$/i.test(u)
}

/** DD + número (p. ej. DD937) → solo columna Extra. */
export function isDdConNumero(value: string): boolean {
  const u = value.trim().toUpperCase()
  if (!/^DD/i.test(u)) return false
  const rest = u.slice(2).trim()
  return rest !== '' && /\d/.test(rest)
}

/** Estilo / tiempo extra: DD seguido de dígitos. */
export function isDoubleTurnoExtraCode(value: string, _serviceNo?: string): boolean {
  return isDdConNumero(value)
}

/** Número solo o letra «A» → columna Asist. */
export function isAsistenciaCode(value: string): boolean {
  const v = value.trim().toUpperCase()
  if (!v) return false
  if (v === 'A') return true
  return /^\d+$/.test(v)
}

/**
 * Totales por códigos de celda (por día, columnas D / T / N):
 * 1. Número o «A» → Asist.
 * 2. DD + número → Extra (por celda).
 * 3. F / F1… → Falta.
 * 4. D → Desc.: **1 por día** si hay D en algún turno (D, T o N). D en D+T+N = 1 Desc.
 *    Ej.: DD937 en turno D y D en T y N → 1 Extra + 1 Desc.
 * 5. INC, VAC, PCGS, PSGS, CAP → su columna.
 */
export function computeTotalsFromShifts(
  shifts: GridRow['shifts'],
  _serviceNo?: string,
): GridRow['totals'] {
  const t = { ...ZERO_TOTALS }
  for (const day of shifts) {
    if (!day) continue
    let diaTieneDescanso = false
    for (const turn of TURNS) {
      const v = day[turn].trim().toUpperCase()
      if (!v) continue
      if (isDescansoCode(v)) diaTieneDescanso = true
      else if (isFaltaCode(v)) t.falta += 1
      else if (v === 'INC') t.inc += 1
      else if (v === 'VAC') t.vac += 1
      else if (v === 'PCGS') t.pcgs += 1
      else if (v === 'PSGS') t.psgs += 1
      else if (v === 'CAP') t.cap += 1
      else if (isDdConNumero(v)) t.extra += 1
      else if (isAsistenciaCode(v)) t.asist += 1
    }
    if (diaTieneDescanso) t.desc += 1
  }
  return t
}

export function withComputedTotals(
  row: GridRow,
  serviceNo?: string,
): GridRow {
  return {
    ...row,
    totals: computeTotalsFromShifts(row.shifts, serviceNo),
  }
}
