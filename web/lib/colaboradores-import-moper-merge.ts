import type { ColaboradorCompleto, MoperEstadoLinea } from "@/lib/colaboradores-types";

function pickStr(csv: string | undefined | null, prev?: string | null): string {
  const t = String(csv ?? "").trim();
  if (t) return t;
  return String(prev ?? "").trim();
}

export function hayLineaMoperVigente(m?: MoperEstadoLinea | null): boolean {
  return Boolean(String(m?.servicio ?? "").trim());
}

/**
 * Al importar CSV, las columnas SERVICIO / PUESTO suelen reflejar el alta (expediente), no el destino MOPER.
 * Si ya hay `moperActual` con servicio, se conserva salvo que la fila traiga ULTIMO_SERVICIO (no vacío) en
 * el archivo — entonces se trata como sincronización explícita (p. ej. reimport de export COLABORADORES).
 */
export function mergeMoperEnImportColaboradorCsv(args: {
  preserveMoper: boolean;
  existing: ColaboradorCompleto | null | undefined;
  /** Solo celdas de la fila actual: ULTIMO_SERVICIO mapeada; no mezclar con `form` ya guardado. */
  csvUltimoServicioExplicit: string;
  servicioCsv: string;
  puestoCsv: string;
}): { moperActual: ColaboradorCompleto["moperActual"]; ultimoServicio: string } {
  const { preserveMoper, existing, csvUltimoServicioExplicit, servicioCsv, puestoCsv } = args;
  const u = csvUltimoServicioExplicit.trim();
  const s = servicioCsv.trim();
  const p = puestoCsv.trim();

  if (!preserveMoper || !existing) {
    return {
      moperActual: { servicio: s, puesto: p },
      ultimoServicio: u || String(existing?.ultimoServicio ?? "").trim(),
    };
  }

  const ex = existing;
  const m = ex.moperActual;

  if (hayLineaMoperVigente(m)) {
    if (!u) {
      return {
        moperActual: m ? { ...m } : undefined,
        ultimoServicio: String(ex.ultimoServicio ?? "").trim(),
      };
    }
    return {
      moperActual: {
        servicio: pickStr(u, pickStr(s, m!.servicio)),
        puesto: pickStr(p, m!.puesto),
      },
      ultimoServicio: u,
    };
  }

  return {
    moperActual: { servicio: s, puesto: p },
    ultimoServicio: u || String(ex.ultimoServicio ?? "").trim(),
  };
}
