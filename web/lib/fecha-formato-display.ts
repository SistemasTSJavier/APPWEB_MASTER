import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";

/** DD/MM/AAAA a partir de `YYYY-MM-DD` (sin zona). */
export function formatoDesdeYyyyMmDd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Muestra fecha (y opcionalmente hora) en día/mes/año.
 * ISO con hora: componentes locales. Texto tipo DD/MM/AAAA: normaliza vía `normalizarFechaParaInputDate`.
 */
export function formatoFechaDiaMesAnio(iso: string, opts?: { conHora?: boolean }): string {
  const t = String(iso ?? "").trim();
  if (!t) return "—";
  const conHora = opts?.conHora ?? true;

  const soloYmd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (soloYmd) {
    const [, y, mo, d] = soloYmd;
    return `${d}/${mo}/${y}`;
  }

  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    if (!conHora) return `${dd}/${mm}/${yyyy}`;
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  const norm = normalizarFechaParaInputDate(t);
  if (norm) {
    const f = formatoDesdeYyyyMmDd(norm);
    return f || t.toUpperCase();
  }
  return t.toUpperCase();
}
