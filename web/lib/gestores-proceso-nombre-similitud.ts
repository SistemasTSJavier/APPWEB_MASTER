import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { normalizarNombreParaCoincidencia } from "@/lib/altas-coincidencia-nombre";

export type GestorNombreCandidato = {
  colaborador: ColaboradorCompleto;
  norm: string;
  tokens: string[];
};

/** Mínima puntuación (0–100) para vincular por nombre aproximado. */
const MIN_SCORE_ACEPTAR = 68;

/** Diferencia mínima entre el 1.º y 2.º candidato para evitar ambigüedad. */
const MIN_GAP_PRIMER_SEGUNDO = 5;

const MIN_LONGITUD_FUZZY = 4;

export function nombreCompletoExpediente(c: ColaboradorCompleto): string {
  const snap = String(c.nombreCompleto ?? "").trim();
  if (snap) return snap;
  const f = c.form ?? {};
  return [f.nombres, f.apellidoPaterno, f.apellidoMaterno].filter(Boolean).join(" ").trim();
}

export function tokensNombre(norm: string): string[] {
  return norm.split(" ").filter((t) => t.length >= 2);
}

export function buildGestorNombreCandidatos(list: ColaboradorCompleto[]): GestorNombreCandidato[] {
  const out: GestorNombreCandidato[] = [];
  for (const c of list) {
    const raw = nombreCompletoExpediente(c);
    const norm = normalizarNombreParaCoincidencia(raw);
    if (!norm || norm.length < MIN_LONGITUD_FUZZY) continue;
    out.push({ colaborador: c, norm, tokens: tokensNombre(norm) });
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length]!;
}

function levenshteinRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

function tokenCoincide(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3) {
    if (a.startsWith(b) || b.startsWith(a)) return true;
    if (levenshteinRatio(a, b) >= 0.88) return true;
  }
  return false;
}

function tokensContenidosEn(query: string[], en: string[]): boolean {
  if (!query.length) return false;
  return query.every((qt) => en.some((et) => tokenCoincide(qt, et)));
}

/**
 * Puntuación 0–100: mayor = más parecido.
 */
export function scoreNombreSimilaridad(
  qNorm: string,
  qTokens: string[],
  cNorm: string,
  cTokens: string[],
): number {
  if (!qNorm || !cNorm) return 0;
  if (qNorm === cNorm) return 100;

  const minLen = Math.min(qNorm.length, cNorm.length);
  const maxLen = Math.max(qNorm.length, cNorm.length);
  if (minLen < MIN_LONGITUD_FUZZY) return 0;

  let score = 0;

  if (cNorm.includes(qNorm) || qNorm.includes(cNorm)) {
    score = 78 + (minLen / maxLen) * 18;
  }

  const qSet = new Set(qTokens);
  const cSet = new Set(cTokens);
  let inter = 0;
  for (const t of qSet) {
    for (const ct of cSet) {
      if (tokenCoincide(t, ct)) {
        inter++;
        break;
      }
    }
  }
  const union = new Set([...qTokens, ...cTokens]).size || 1;
  const jaccard = inter / union;

  let tokenScore = jaccard * 88;
  if (tokensContenidosEn(qTokens, cTokens)) tokenScore = Math.max(tokenScore, 84);
  if (tokensContenidosEn(cTokens, qTokens)) tokenScore = Math.max(tokenScore, 80);

  const levFull = levenshteinRatio(qNorm, cNorm) * 100;

  let bonus = 0;
  const q0 = qTokens[0];
  const c0 = cTokens[0];
  if (q0 && c0 && tokenCoincide(q0, c0)) bonus += 9;
  const qLast = qTokens[qTokens.length - 1];
  const cLast = cTokens[cTokens.length - 1];
  if (qLast && cLast && qLast !== q0 && tokenCoincide(qLast, cLast)) bonus += 11;

  const blended = levFull * 0.4 + tokenScore * 0.5 + bonus;
  return Math.min(100, Math.max(score, blended, tokenScore, levFull * 0.92));
}

export type MejorCoincidenciaNombreGestor = {
  candidato: GestorNombreCandidato;
  score: number;
};

/**
 * Busca el colaborador con nombre más parecido al texto del gestor.
 * Devuelve null si no hay candidato claro por encima del umbral.
 */
export function mejorCoincidenciaNombreGestor(
  gestorTexto: string,
  candidatos: GestorNombreCandidato[],
): MejorCoincidenciaNombreGestor | null {
  const qNorm = normalizarNombreParaCoincidencia(gestorTexto);
  if (qNorm.length < MIN_LONGITUD_FUZZY) return null;
  const qTokens = tokensNombre(qNorm);

  const exactos = candidatos.filter((c) => c.norm === qNorm);
  if (exactos.length === 1) {
    return { candidato: exactos[0]!, score: 100 };
  }
  if (exactos.length > 1) {
    return null;
  }

  const scored: Array<{ cand: GestorNombreCandidato; score: number }> = [];
  for (const cand of candidatos) {
    const score = scoreNombreSimilaridad(qNorm, qTokens, cand.norm, cand.tokens);
    if (score >= MIN_SCORE_ACEPTAR) scored.push({ cand, score });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  const first = scored[0]!;
  const second = scored[1];
  if (second && first.score - second.score < MIN_GAP_PRIMER_SEGUNDO) return null;

  return { candidato: first.cand, score: first.score };
}
