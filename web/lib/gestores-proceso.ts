import { canonicalEmpNoAttendance } from "@/lib/attendance-emp-no";
import { normalizarNombreParaCoincidencia } from "@/lib/altas-coincidencia-nombre";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { formatoDesdeYyyyMmDd } from "@/lib/fecha-formato-display";
import { plantaExpedienteColaborador } from "@/lib/colaboradores-catalogo-display";
import {
  buildGestorNombreCandidatos,
  mejorCoincidenciaNombreGestor,
  nombreCompletoExpediente,
  type GestorNombreCandidato,
} from "@/lib/gestores-proceso-nombre-similitud";
import { colaboradorGestorPorTextoPuestoReclutadora } from "@/lib/altas-gestores-proceso-opciones";

const TZ = "America/Mexico_City";

export type GestorProcesoPeriodo = "semana" | "mes";

export type GestorMatchTipo =
  | "no_empleado"
  | "nombre_exacto"
  | "nombre_similar"
  | "puesto_reclutadora"
  | "texto_libre"
  | "sin_gestor";

export type GestorColaboradorVinculo = {
  noEmpleado: string;
  nombreCompleto: string;
  fechaIngreso: string;
};

export type GestorAsignadoColaborador = {
  noEmpleado: string;
  nombreCompleto: string;
  fechaIngreso: string;
  servicio: string;
  planta: string;
  gestorTexto: string;
};

export type GestorProcesoBucket = {
  gestorKey: string;
  gestorLabel: string;
  gestorTextoEjemplo: string;
  matchTipo: GestorMatchTipo;
  gestorColaborador: GestorColaboradorVinculo | null;
  total: number;
  colaboradores: GestorAsignadoColaborador[];
};

export type GestoresProcesoReport = {
  periodo: GestorProcesoPeriodo;
  periodoLabel: string;
  desdeIso: string;
  hastaIso: string;
  /** Solo se consideran altas con fecha de ingreso en este año (calendario México). */
  anioFiltro: number;
  totalIngresosAnio: number;
  totalEnPeriodo: number;
  sinGestorEnPeriodo: number;
  gestores: GestorProcesoBucket[];
  /** Gestores distintos entre todos los ingresos del año filtro. */
  gestoresDistintosHistorico: number;
  /** Ingresos del año sin gestor asignado. */
  colaboradoresSinGestorHistorico: number;
};

function normTexto(s: string): string {
  return normalizarNombreParaCoincidencia(s);
}

function fechaIngresoEfectiva(c: ColaboradorCompleto): string {
  const snap = String(c.fechaIngreso ?? "").trim();
  const enForm = String(c.form?.fechaIngreso ?? "").trim();
  const raw = snap || enForm;
  return normalizarFechaParaInputDate(raw) || raw;
}

/** Año calendario actual en zona México. */
export function anioActualGestoresMx(fecha = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
    }).format(fecha),
  );
}

export function anioDesdeFechaIngresoYmd(ingYmd: string): number | null {
  const n = normalizarFechaParaInputDate(ingYmd);
  if (!n || n.length < 4) return null;
  const y = Number(n.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/** Colaboradores cuya fecha de ingreso cae en el año indicado. */
export function filtrarColaboradoresIngresoEnAnio(
  list: ColaboradorCompleto[],
  anio: number,
): ColaboradorCompleto[] {
  return list.filter((c) => anioDesdeFechaIngresoYmd(fechaIngresoEfectiva(c)) === anio);
}

function gestorTextoColaborador(c: ColaboradorCompleto): string {
  return String(c.form?.gestorProceso ?? "").trim();
}

function ymdEnTz(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

export function mondayOfWeekLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function rangoPeriodoGestor(
  periodo: GestorProcesoPeriodo,
  anchorYmd: string,
): { desdeIso: string; hastaIso: string; label: string } | null {
  const anchor = normalizarFechaParaInputDate(anchorYmd);
  if (!anchor) return null;
  const [y, m, d] = anchor.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  if (periodo === "mes") {
    const desde = new Date(y, m - 1, 1);
    const hasta = new Date(y, m, 0);
    const label = new Intl.DateTimeFormat("es-MX", {
      timeZone: TZ,
      month: "long",
      year: "numeric",
    })
      .format(desde)
      .replace(/^\w/, (c) => c.toUpperCase());
    return {
      desdeIso: ymdEnTz(desde),
      hastaIso: ymdEnTz(hasta),
      label,
    };
  }

  const lun = mondayOfWeekLocal(base);
  const dom = new Date(lun);
  dom.setDate(dom.getDate() + 6);
  const label = `Semana ${formatoDesdeYyyyMmDd(ymdEnTz(lun))} – ${formatoDesdeYyyyMmDd(ymdEnTz(dom))}`;
  return {
    desdeIso: ymdEnTz(lun),
    hastaIso: ymdEnTz(dom),
    label,
  };
}

function enRangoInclusivo(fechaYmd: string, desdeIso: string, hastaIso: string): boolean {
  const f = normalizarFechaParaInputDate(fechaYmd);
  if (!f) return false;
  return f >= desdeIso && f <= hastaIso;
}

type ColaboradorIndex = {
  byEmp: Map<string, ColaboradorCompleto>;
  byNombre: Map<string, ColaboradorCompleto[]>;
  candidatosNombre: GestorNombreCandidato[];
};

function buildColaboradorIndex(list: ColaboradorCompleto[]): ColaboradorIndex {
  const byEmp = new Map<string, ColaboradorCompleto>();
  const byNombre = new Map<string, ColaboradorCompleto[]>();
  for (const c of list) {
    const emp = canonicalEmpNoAttendance(c.noEmpleado);
    if (emp) byEmp.set(emp, c);
    const nom = normTexto(nombreCompletoExpediente(c));
    if (nom) {
      const arr = byNombre.get(nom) ?? [];
      arr.push(c);
      byNombre.set(nom, arr);
    }
  }
  return { byEmp, byNombre, candidatosNombre: buildGestorNombreCandidatos(list) };
}

function vinculoDesdeColaborador(c: ColaboradorCompleto): GestorColaboradorVinculo {
  const ing = fechaIngresoEfectiva(c);
  return {
    noEmpleado: c.noEmpleado,
    nombreCompleto: c.nombreCompleto,
    fechaIngreso: ing ? formatoDesdeYyyyMmDd(ing) || ing : "—",
  };
}

export function resolverGestorProceso(
  gestorTexto: string,
  index: ColaboradorIndex,
  todos?: ColaboradorCompleto[],
): {
  key: string;
  label: string;
  matchTipo: GestorMatchTipo;
  gestorColaborador: GestorColaboradorVinculo | null;
} {
  const raw = gestorTexto.trim();
  if (!raw) {
    return {
      key: "__sin_gestor__",
      label: "Sin gestor registrado",
      matchTipo: "sin_gestor",
      gestorColaborador: null,
    };
  }

  const empCanon = canonicalEmpNoAttendance(raw);
  if (empCanon) {
    const hit = index.byEmp.get(empCanon);
    if (hit) {
      return {
        key: `emp:${empCanon}`,
        label: nombreCompletoExpediente(hit),
        matchTipo: "no_empleado",
        gestorColaborador: vinculoDesdeColaborador(hit),
      };
    }
  }

  const nom = normTexto(raw);
  const exact = index.byNombre.get(nom);
  if (exact?.length === 1) {
    const hit = exact[0]!;
    return {
      key: `nom:${nom}`,
      label: nombreCompletoExpediente(hit),
      matchTipo: "nombre_exacto",
      gestorColaborador: vinculoDesdeColaborador(hit),
    };
  }

  const mejor = mejorCoincidenciaNombreGestor(raw, index.candidatosNombre);
  if (mejor) {
    const hit = mejor.candidato.colaborador;
    const keyNorm = mejor.candidato.norm;
    return {
      key: `sim:${keyNorm}`,
      label: nombreCompletoExpediente(hit),
      matchTipo: mejor.score >= 99.5 ? "nombre_exacto" : "nombre_similar",
      gestorColaborador: vinculoDesdeColaborador(hit),
    };
  }

  if (todos?.length) {
    const porPuesto = colaboradorGestorPorTextoPuestoReclutadora(todos, raw);
    if (porPuesto) {
      const puestoNorm = normalizarNombreParaCoincidencia(raw);
      return {
        key: `puesto:${puestoNorm}`,
        label: nombreCompletoExpediente(porPuesto),
        matchTipo: "puesto_reclutadora",
        gestorColaborador: vinculoDesdeColaborador(porPuesto),
      };
    }
  }

  return {
    key: `txt:${nom}`,
    label: raw.toUpperCase(),
    matchTipo: "texto_libre",
    gestorColaborador: null,
  };
}

function toAsignado(c: ColaboradorCompleto, gestorTexto: string): GestorAsignadoColaborador {
  const ing = fechaIngresoEfectiva(c);
  return {
    noEmpleado: c.noEmpleado,
    nombreCompleto: c.nombreCompleto,
    fechaIngreso: ing ? formatoDesdeYyyyMmDd(ing) || ing : "—",
    servicio: String(c.servicioAsignado ?? c.form?.servicio ?? "").trim() || "—",
    planta: plantaExpedienteColaborador(c) || "—",
    gestorTexto,
  };
}

export function buildGestoresProcesoReport(
  colaboradores: ColaboradorCompleto[],
  periodo: GestorProcesoPeriodo,
  anchorYmd: string,
): GestoresProcesoReport | null {
  const rango = rangoPeriodoGestor(periodo, anchorYmd);
  if (!rango) return null;

  const anioFiltro = anioActualGestoresMx();
  const delAnio = filtrarColaboradoresIngresoEnAnio(colaboradores, anioFiltro);
  const totalIngresosAnio = delAnio.length;

  const index = buildColaboradorIndex(colaboradores);
  const buckets = new Map<string, GestorProcesoBucket>();
  let totalEnPeriodo = 0;
  let sinGestorEnPeriodo = 0;

  const historicosGestor = new Set<string>();
  let sinGestorHistorico = 0;

  type ResGestor = ReturnType<typeof resolverGestorProceso>;
  const resolucionCache = new Map<string, ResGestor>();
  const resolverCached = (gestorTxt: string): ResGestor => {
    const cacheKey = gestorTxt.trim() || "__sin_gestor__";
    const hit = resolucionCache.get(cacheKey);
    if (hit) return hit;
    const res = resolverGestorProceso(gestorTxt, index, colaboradores);
    resolucionCache.set(cacheKey, res);
    return res;
  };

  for (const c of delAnio) {
    const gestorTxt = gestorTextoColaborador(c);
    const resHist = resolverCached(gestorTxt);
    if (resHist.matchTipo === "sin_gestor") sinGestorHistorico++;
    else historicosGestor.add(resHist.key);

    const ing = fechaIngresoEfectiva(c);
    if (!enRangoInclusivo(ing, rango.desdeIso, rango.hastaIso)) continue;

    totalEnPeriodo++;
    const res = resolverCached(gestorTxt);
    if (res.matchTipo === "sin_gestor") sinGestorEnPeriodo++;

    let bucket = buckets.get(res.key);
    if (!bucket) {
      bucket = {
        gestorKey: res.key,
        gestorLabel: res.label,
        gestorTextoEjemplo: gestorTxt || "—",
        matchTipo: res.matchTipo,
        gestorColaborador: res.gestorColaborador,
        total: 0,
        colaboradores: [],
      };
      buckets.set(res.key, bucket);
    }
    bucket.total++;
    bucket.colaboradores.push(toAsignado(c, gestorTxt));
  }

  const gestores = [...buckets.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.gestorLabel.localeCompare(b.gestorLabel, "es", { numeric: true });
  });

  for (const g of gestores) {
    g.colaboradores.sort((a, b) =>
      a.fechaIngreso.localeCompare(b.fechaIngreso, "es", { numeric: true }),
    );
  }

  return {
    periodo,
    periodoLabel: rango.label,
    desdeIso: rango.desdeIso,
    hastaIso: rango.hastaIso,
    anioFiltro,
    totalIngresosAnio,
    totalEnPeriodo,
    sinGestorEnPeriodo,
    gestores,
    gestoresDistintosHistorico: historicosGestor.size,
    colaboradoresSinGestorHistorico: sinGestorHistorico,
  };
}

export function matchTipoLabel(t: GestorMatchTipo): string {
  switch (t) {
    case "no_empleado":
      return "Identificado por N.º de empleado en expediente";
    case "nombre_exacto":
      return "Identificado por nombre completo exacto";
    case "nombre_similar":
      return "Identificado por el nombre más parecido en expediente";
    case "puesto_reclutadora":
      return "Identificado por puesto de reclutadora en expediente";
    case "texto_libre":
      return "Solo texto en alta; no coincide con ningún colaborador";
    case "sin_gestor":
      return "Campo vacío — sin gestor asignado";
    default:
      return t;
  }
}
