import type { Turn } from './mockData'

const TURN_ORDER: Turn[] = ['D', 'T', 'N']

/** Celda que cuenta como falta: solo «F» o ya numerada F1, F2, … */
export function isFaltaPlaceholder(raw: string): boolean {
  const x = raw.trim().toUpperCase()
  if (x === 'F') return true
  return /^F[1-9]\d*$/.test(x)
}

/**
 * Renumera faltas en orden Lun→Dom y por turno D, T, N.
 * Cada hueco de falta queda como F1, F2, F3… según el orden de aparición.
 */
export function reassignFaltaSequence(
  shifts: { D: string; T: string; N: string }[],
): { D: string; T: string; N: string }[] {
  const out = shifts.map((d) => ({ ...d }))
  let seq = 0
  for (let di = 0; di < out.length; di++) {
    for (const turn of TURN_ORDER) {
      if (isFaltaPlaceholder(out[di][turn])) {
        seq += 1
        out[di] = { ...out[di], [turn]: `F${seq}` }
      }
    }
  }
  return out
}
