import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { colaboradorTieneBaja } from "@/lib/colaboradores-baja";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { claveServicioAgrupada, servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import { createSupabaseServiceRoleClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { aniversariosEmpresaProximaSemana, type AniversarioEmpresaSemana } from "@/lib/aniversario-empresa-semana";
import { cumpleanosActivosEnMes, type CumpleaneroMes } from "@/lib/cumpleanos-mes";

export type { AniversarioEmpresaSemana, CumpleaneroMes };

export type DashboardStats = {
  totalColaboradores: number;
  /** Sin `fechaBaja` en expediente (todo el tiempo). */
  activosTotal: number;
  /** `fechaIngreso` efectiva en el mes calendario actual (America/Mexico_City). */
  altasEsteMes: number;
  /** Expedientes con `ultimoDiaLaborado` en el mes calendario actual (America/Mexico_City); solo cuentan si tienen `fechaBaja` en expediente. */
  bajasEsteMes: number;
  /** Movimientos MOPER con fecha en el mes calendario actual (America/Mexico_City; usa `registradoEn` o `created_at`). */
  moperEsteMes: number;
  puestosUnicos: number;
  serviciosUnicos: number;
  /** Activos con cumpleaños desde hoy hasta fin de mes (America/Mexico_City). */
  cumpleanosEsteMes: CumpleaneroMes[];
  /** Activos con aniversario de ingreso en los próximos 7 días. */
  aniversariosEmpresaSemana: AniversarioEmpresaSemana[];
  fuente: "supabase" | "sin_datos";
};

function yearMonthMexicoCity(d: Date): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "numeric",
  });
  const parts = fmt.formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  return { year: y, month: m };
}

/** fecha tipo input date YYYY-MM-DD (o prefijo compatible). */
function fechaYYYYMMDDEnMes(fechaRaw: string, year: number, month: number): boolean {
  const t = String(fechaRaw ?? "").trim();
  if (!t) return false;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (!m) return false;
  return Number(m[1]) === year && Number(m[2]) === month;
}

function fechaIngresoEfectiva(c: { fechaIngreso: string; form: Record<string, string> }): string {
  const snap = String(c.fechaIngreso ?? "").trim();
  const enForm = String(c.form?.fechaIngreso ?? "").trim();
  return snap || enForm;
}

function agregarDesdeColaborador(c: ColaboradorCompleto, puestos: Set<string>, servicios: Set<string>) {
  const p = (c.puesto || c.moperActual?.puesto || c.form?.puesto || "").trim();
  if (p) puestos.add(p.toUpperCase());

  const s = servicioLineaColaborador(c);
  const clave = claveServicioAgrupada(s);
  if (clave) servicios.add(clave);
}

function calcular(list: ColaboradorCompleto[]): Omit<DashboardStats, "fuente" | "moperEsteMes"> {
  const { year, month } = yearMonthMexicoCity(new Date());
  const puestos = new Set<string>();
  const servicios = new Set<string>();
  let bajasEsteMes = 0;
  let bajasConFechaBaja = 0;
  let altasEsteMes = 0;

  for (const c of list) {
    agregarDesdeColaborador(c, puestos, servicios);
    if (colaboradorTieneBaja(c)) {
      bajasConFechaBaja += 1;
      const udl = normalizarFechaParaInputDate(String(c.form?.ultimoDiaLaborado ?? ""));
      if (udl && fechaYYYYMMDDEnMes(udl, year, month)) bajasEsteMes += 1;
    }

    const fi = fechaIngresoEfectiva(c);
    if (fi) {
      const fiNorm = normalizarFechaParaInputDate(fi) || fi;
      if (fechaYYYYMMDDEnMes(fiNorm, year, month)) altasEsteMes += 1;
    }
  }

  const activosTotal = list.length - bajasConFechaBaja;

  return {
    totalColaboradores: list.length,
    activosTotal,
    altasEsteMes,
    bajasEsteMes,
    puestosUnicos: puestos.size,
    serviciosUnicos: servicios.size,
    cumpleanosEsteMes: cumpleanosActivosEnMes(list),
    aniversariosEmpresaSemana: aniversariosEmpresaProximaSemana(list),
  };
}

function contarMoperEsteMes(
  rows: Array<{ entrada: unknown; created_at: string }> | null | undefined,
  year: number,
  month: number,
): number {
  let esteMes = 0;
  for (const r of rows ?? []) {
    const ent = r.entrada as { registradoEn?: string } | null;
    const iso = String(ent?.registradoEn ?? "").trim() || String(r.created_at ?? "").trim();
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const ym = yearMonthMexicoCity(d);
    if (ym.year === year && ym.month === month) esteMes += 1;
  }
  return esteMes;
}

/** Metricas del inicio: lectura directa en servidor (misma fuente que GET /api/colaboradores). */
export async function getDashboardStats(): Promise<DashboardStats> {
  if (!isSupabaseServerConfigured()) {
    return {
      totalColaboradores: 0,
      activosTotal: 0,
      altasEsteMes: 0,
      bajasEsteMes: 0,
      moperEsteMes: 0,
      puestosUnicos: 0,
      serviciosUnicos: 0,
      cumpleanosEsteMes: [],
      aniversariosEmpresaSemana: [],
      fuente: "sin_datos",
    };
  }

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return {
      totalColaboradores: 0,
      activosTotal: 0,
      altasEsteMes: 0,
      bajasEsteMes: 0,
      moperEsteMes: 0,
      puestosUnicos: 0,
      serviciosUnicos: 0,
      cumpleanosEsteMes: [],
      aniversariosEmpresaSemana: [],
      fuente: "sin_datos",
    };
  }

  const { data, error } = await admin.from("colaboradores").select("data");
  if (error) {
    return {
      totalColaboradores: 0,
      activosTotal: 0,
      altasEsteMes: 0,
      bajasEsteMes: 0,
      moperEsteMes: 0,
      puestosUnicos: 0,
      serviciosUnicos: 0,
      cumpleanosEsteMes: [],
      aniversariosEmpresaSemana: [],
      fuente: "sin_datos",
    };
  }

  const list = (data ?? [])
    .map((r: { data: unknown }) => normalizeToCompleto(r.data))
    .filter((c): c is ColaboradorCompleto => c !== null);

  const { year, month } = yearMonthMexicoCity(new Date());
  let moperEsteMes = 0;
  const { data: moperRows, error: moperErr } = await admin.from("moper_historial").select("entrada, created_at");
  if (!moperErr && moperRows) {
    moperEsteMes = contarMoperEsteMes(moperRows as Array<{ entrada: unknown; created_at: string }>, year, month);
  }

  return { ...calcular(list), moperEsteMes, fuente: "supabase" };
}
