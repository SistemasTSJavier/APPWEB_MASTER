import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { colaboradorTieneBaja } from "@/lib/colaboradores-baja";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";

export type AniversarioEmpresaSemana = {
  servicio: string;
  nombre: string;
  /** Fecha de ingreso (texto legible). */
  fechaIngreso: string;
  /** Próximo aniversario laboral (día que cumple el año en la empresa). */
  fechaAniversario: string;
  puesto: string;
  /** Años que cumplirá en la empresa en esa fecha. */
  anosEnEmpresa: number;
  /** Días hasta el aniversario (0 = hoy). */
  diasHasta: number;
};

const TZ = "America/Mexico_City";

type Ymd = { y: number; m: number; d: number };

function ymdHoyMexicoCity(ref: Date = new Date()): Ymd {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(ref);
  return {
    y: Number(parts.find((p) => p.type === "year")?.value ?? 0),
    m: Number(parts.find((p) => p.type === "month")?.value ?? 0),
    d: Number(parts.find((p) => p.type === "day")?.value ?? 0),
  };
}

function parseYmd(ymd: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Días calendario de `a` a `b` (b >= a). */
function diasEntreYmd(a: Ymd, b: Ymd): number {
  const t0 = Date.UTC(a.y, a.m - 1, a.d);
  const t1 = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((t1 - t0) / 86_400_000);
}

function diaMesAniversario(hire: Ymd, year: number): Ymd {
  const ultimoDia = new Date(Date.UTC(year, hire.m, 0)).getUTCDate();
  const d = hire.m === 2 && hire.d === 29 ? Math.min(29, ultimoDia) : Math.min(hire.d, ultimoDia);
  return { y: year, m: hire.m, d };
}

function formatearYmdLegible(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  try {
    const d = new Date(`${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T12:00:00Z`);
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return ymd;
  }
}

function puestoLineaColaborador(c: ColaboradorCompleto): string {
  return (
    (c.puesto || "").trim() ||
    (c.moperActual?.puesto ?? "").trim() ||
    String(c.form?.puesto ?? "").trim() ||
    String(c.form?.puestoFinal ?? "").trim()
  );
}

function fechaIngresoEfectiva(c: ColaboradorCompleto): string {
  const snap = String(c.fechaIngreso ?? "").trim();
  const enForm = String(c.form?.fechaIngreso ?? "").trim();
  const raw = snap || enForm;
  return normalizarFechaParaInputDate(raw) || raw;
}

/**
 * Activos cuyo aniversario de ingreso cae entre hoy y los próximos `ventanaDias` días
 * (inclusive), zona America/Mexico_City.
 */
export function aniversariosEmpresaProximaSemana(
  list: ColaboradorCompleto[],
  ventanaDias = 7,
  hoyRef: Date = new Date(),
): AniversarioEmpresaSemana[] {
  const hoy = ymdHoyMexicoCity(hoyRef);
  const out: AniversarioEmpresaSemana[] = [];

  for (const c of list) {
    if (colaboradorTieneBaja(c)) continue;

    const ingresoYmd = fechaIngresoEfectiva(c);
    const hire = parseYmd(ingresoYmd);
    if (!hire) continue;

    let annivYear = hoy.y;
    let anniv = diaMesAniversario(hire, annivYear);
    if (diasEntreYmd(hoy, anniv) < 0) {
      annivYear += 1;
      anniv = diaMesAniversario(hire, annivYear);
    }

    const diasHasta = diasEntreYmd(hoy, anniv);
    if (diasHasta < 0 || diasHasta > ventanaDias) continue;

    const anosEnEmpresa = annivYear - hire.y;
    if (anosEnEmpresa < 1) continue;

    const nombre = String(c.nombreCompleto ?? "").trim() || String(c.form?.nombreCompleto ?? "").trim();
    if (!nombre) continue;

    const annivIso = `${anniv.y}-${String(anniv.m).padStart(2, "0")}-${String(anniv.d).padStart(2, "0")}`;

    out.push({
      servicio: servicioLineaColaborador(c) || "—",
      nombre,
      fechaIngreso: formatearYmdLegible(ingresoYmd),
      fechaAniversario: formatearYmdLegible(annivIso),
      puesto: puestoLineaColaborador(c) || "—",
      anosEnEmpresa,
      diasHasta,
    });
  }

  out.sort(
    (a, b) =>
      a.diasHasta - b.diasHasta ||
      a.anosEnEmpresa - b.anosEnEmpresa ||
      a.nombre.localeCompare(b.nombre, "es"),
  );

  return out;
}
