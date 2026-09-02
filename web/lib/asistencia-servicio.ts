/**
 * Resumen de asistencia por servicio desde `cuadricula_asistencia_dias` (solo lectura).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mesCalendarioActualYm,
  mondaysEnMesCalendario,
} from "@/lib/categorizacion-faltas-cuadricula";
import { servicioCoincideFiltroCat } from "@/lib/categorizacion-filtros-servicio";
import { hintSupabaseClientError } from "@/lib/supabase/admin";

const TURNS = ["D", "T", "N"] as const;

export type AsistenciaServicioTotales = {
  asist: number;
  falta: number;
  desc: number;
  vac: number;
  inc: number;
  extra: number;
  pcgs: number;
  psgs: number;
  cap: number;
};

export type AsistenciaServicioFechas = {
  falta: string[];
  desc: string[];
  vac: string[];
  inc: string[];
  extra: string[];
  pcgs: string[];
  psgs: string[];
  cap: string[];
};

export type AsistenciaServicioColaborador = {
  noEmpleado: string;
  nombre: string;
  puesto: string;
  planta: string;
  totales: AsistenciaServicioTotales;
  fechas: AsistenciaServicioFechas;
};

export type AsistenciaServicioSemanaOpcion = {
  weekStart: string;
  label: string;
};

export type AsistenciaServicioPayload = {
  mesYm: string;
  /** ISO lunes de la semana filtrada, o "" = todo el mes. */
  semana: string;
  servicio: string;
  semanas: AsistenciaServicioSemanaOpcion[];
  colaboradores: AsistenciaServicioColaborador[];
  resumen: AsistenciaServicioTotales;
  generadoEn: string;
};

function emptyTotales(): AsistenciaServicioTotales {
  return { asist: 0, falta: 0, desc: 0, vac: 0, inc: 0, extra: 0, pcgs: 0, psgs: 0, cap: 0 };
}

function emptyFechas(): AsistenciaServicioFechas {
  return { falta: [], desc: [], vac: [], inc: [], extra: [], pcgs: [], psgs: [], cap: [] };
}

function addTotales(a: AsistenciaServicioTotales, b: AsistenciaServicioTotales): AsistenciaServicioTotales {
  return {
    asist: a.asist + b.asist,
    falta: a.falta + b.falta,
    desc: a.desc + b.desc,
    vac: a.vac + b.vac,
    inc: a.inc + b.inc,
    extra: a.extra + b.extra,
    pcgs: a.pcgs + b.pcgs,
    psgs: a.psgs + b.psgs,
    cap: a.cap + b.cap,
  };
}

function mergeFechas(a: AsistenciaServicioFechas, b: AsistenciaServicioFechas): AsistenciaServicioFechas {
  const merge = (x: string[], y: string[]) =>
    [...new Set([...x, ...y])].sort((p, q) => p.localeCompare(q));
  return {
    falta: merge(a.falta, b.falta),
    desc: merge(a.desc, b.desc),
    vac: merge(a.vac, b.vac),
    inc: merge(a.inc, b.inc),
    extra: merge(a.extra, b.extra),
    pcgs: merge(a.pcgs, b.pcgs),
    psgs: merge(a.psgs, b.psgs),
    cap: merge(a.cap, b.cap),
  };
}

function isDescanso(v: string): boolean {
  return v.trim().toUpperCase() === "D";
}
function isFalta(v: string): boolean {
  const u = v.trim().toUpperCase();
  return u === "F" || /^F[1-9]\d*$/i.test(u);
}
function isDdExtra(v: string): boolean {
  const u = v.trim().toUpperCase();
  if (!/^DD/i.test(u)) return false;
  return /\d/.test(u.slice(2));
}
function isAsist(v: string): boolean {
  const u = v.trim().toUpperCase();
  return u === "A" || /^\d+$/.test(u);
}

function dateToIsoYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDateEs(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function etiquetaSemana(monday: Date): string {
  const domingo = addDays(monday, 6);
  return `${formatDateEs(monday)} – ${formatDateEs(domingo)}`;
}

type DiaAgg = {
  totales: AsistenciaServicioTotales;
  fechas: AsistenciaServicioFechas;
};

function agregarFecha(fechas: AsistenciaServicioFechas, key: keyof AsistenciaServicioFechas, label: string) {
  if (!fechas[key].includes(label)) fechas[key].push(label);
}

function agregarCodigosDia(
  day: { D: string; T: string; N: string },
  fecha: Date,
  monthStart: Date,
  monthEnd: Date,
  rangeStart: Date | null,
  rangeEnd: Date | null,
): DiaAgg {
  const t = emptyTotales();
  const fechas = emptyFechas();
  fecha.setHours(0, 0, 0, 0);
  if (fecha < monthStart || fecha > monthEnd) return { totales: t, fechas };
  if (rangeStart && fecha < rangeStart) return { totales: t, fechas };
  if (rangeEnd && fecha > rangeEnd) return { totales: t, fechas };
  const label = formatDateEs(fecha);
  let diaDescanso = false;
  for (const turn of TURNS) {
    const v = String(day[turn] ?? "").trim().toUpperCase();
    if (!v) continue;
    if (isDescanso(v)) diaDescanso = true;
    else if (isFalta(v)) {
      t.falta += 1;
      agregarFecha(fechas, "falta", label);
    } else if (v === "INC") {
      t.inc += 1;
      agregarFecha(fechas, "inc", label);
    } else if (v === "VAC") {
      t.vac += 1;
      agregarFecha(fechas, "vac", label);
    } else if (v === "PCGS") {
      t.pcgs += 1;
      agregarFecha(fechas, "pcgs", label);
    } else if (v === "PSGS") {
      t.psgs += 1;
      agregarFecha(fechas, "psgs", label);
    } else if (v === "CAP") {
      t.cap += 1;
      agregarFecha(fechas, "cap", label);
    } else if (isDdExtra(v)) {
      t.extra += 1;
      agregarFecha(fechas, "extra", label);
    } else if (isAsist(v)) {
      t.asist += 1;
    }
  }
  if (diaDescanso) {
    t.desc += 1;
    agregarFecha(fechas, "desc", label);
  }
  return { totales: t, fechas };
}

export async function buildAsistenciaServicioMes(
  admin: SupabaseClient,
  opts: {
    servicio: string;
    mesYm?: string;
    /** Lunes ISO de la semana; vacío = mes completo. */
    semana?: string;
    colaboradores: Array<{
      noEmpleado: string;
      nombre: string;
      puesto: string;
      planta: string;
      servicio: string;
    }>;
  },
): Promise<AsistenciaServicioPayload> {
  const servicio = opts.servicio.trim();
  const ym = (opts.mesYm ?? mesCalendarioActualYm()).trim();
  const semanaFiltro = (opts.semana ?? "").trim();
  const [ys, ms] = ym.split("-").map((x) => Number(x));
  const y = ys || new Date().getFullYear();
  const m0 = (ms || 1) - 1;
  const monthStart = new Date(y, m0, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(y, m0 + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);

  const mondays = mondaysEnMesCalendario(ym);
  const semanas: AsistenciaServicioSemanaOpcion[] = mondays.map((m) => ({
    weekStart: dateToIsoYmd(m),
    label: etiquetaSemana(m),
  }));

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  let queryStart = monthStart;
  let queryEnd = monthEnd;
  if (semanaFiltro) {
    const monday = mondays.find((m) => dateToIsoYmd(m) === semanaFiltro);
    if (monday) {
      rangeStart = new Date(monday);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = addDays(monday, 6);
      rangeEnd.setHours(0, 0, 0, 0);
      queryStart = rangeStart;
      queryEnd = rangeEnd;
    }
  }

  const delServicio = opts.colaboradores.filter((c) =>
    servicioCoincideFiltroCat(c.servicio, servicio),
  );
  const byNo = new Map(
    delServicio.map((c) => [
      c.noEmpleado.trim().toUpperCase(),
      {
        noEmpleado: c.noEmpleado.trim().toUpperCase(),
        nombre: c.nombre,
        puesto: c.puesto,
        planta: c.planta,
        totales: emptyTotales(),
        fechas: emptyFechas(),
      } satisfies AsistenciaServicioColaborador,
    ]),
  );

  if (byNo.size > 0) {
    const PAGE = 1000;
    let offset = 0;
    const inicioYmd = dateToIsoYmd(queryStart);
    const finYmd = dateToIsoYmd(queryEnd);
    while (true) {
      const { data, error } = await admin
        .from("cuadricula_asistencia_dias")
        .select("employee_no, fecha, codigo_d, codigo_t, codigo_n")
        .gte("fecha", inicioYmd)
        .lte("fecha", finYmd)
        .order("fecha", { ascending: true })
        .order("employee_no", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(hintSupabaseClientError(error.message));

      const page = data ?? [];
      if (page.length === 0) break;

      for (const row of page) {
        const no = String(row.employee_no ?? "").trim().toUpperCase();
        const col = byNo.get(no);
        if (!col) continue;
        const fechaIso = String(row.fecha ?? "").trim();
        if (!fechaIso) continue;
        const [yy, mm, dd] = fechaIso.split("-").map(Number);
        const fecha = new Date(yy || 1970, (mm || 1) - 1, dd || 1);
        const add = agregarCodigosDia(
          {
            D: String(row.codigo_d ?? ""),
            T: String(row.codigo_t ?? ""),
            N: String(row.codigo_n ?? ""),
          },
          fecha,
          monthStart,
          monthEnd,
          rangeStart,
          rangeEnd,
        );
        col.totales = addTotales(col.totales, add.totales);
        col.fechas = mergeFechas(col.fechas, add.fechas);
      }

      if (page.length < PAGE) break;
      offset += PAGE;
    }
  }

  const colaboradores = [...byNo.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );
  const resumen = colaboradores.reduce((acc, c) => addTotales(acc, c.totales), emptyTotales());

  return {
    mesYm: ym,
    semana: semanaFiltro && semanas.some((s) => s.weekStart === semanaFiltro) ? semanaFiltro : "",
    servicio,
    semanas,
    colaboradores,
    resumen,
    generadoEn: new Date().toISOString(),
  };
}
