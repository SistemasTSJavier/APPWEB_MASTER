import { CAT_ESCALA_MAX, CAT_ESCALA_MIN } from "@/lib/categorizacion-calificaciones";
import { camposPorModulo, type CatEvalModuloId } from "@/lib/categorizacion-campos";
import type { CatOperacionesRolId } from "@/lib/categorizacion-operaciones-roles";
import { rolOperacionesDesdePuesto } from "@/lib/categorizacion-operaciones-roles";
import { colaboradorVigenteEnMesHistorial, mesYmDesdeFechaIngreso } from "@/lib/categorizacion-tenure";
import {
  deleteRegistroCapacitacion,
  getCatEvaluacion,
  listCursosCapacitacion,
  listRegistrosCapacitacion,
  periodMonthEvaluacion,
  promedioOperacionesParaEmpleado,
  loadMapasPromedioOperaciones,
  upsertCatEvaluacion,
  upsertCursoCapacitacion,
  upsertRegistroCapacitacion,
} from "@/lib/categorizacion-server";
import type { CatCapacitacionCurso } from "@/lib/categorizacion-types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Evaluador sintético para operaciones capturadas por admin. */
export const CALIFICADO_POR_ADMIN = "ADMIN";

/** Nombres reales para kardex cuando el catálogo está vacío o solo tiene entradas internas. */
const NOMBRES_CAP_KARDEX = [
  "Seguridad industrial",
  "Primeros auxilios",
  "Atención al cliente",
  "Manejo de herramientas",
  "Protocolos de servicio",
  "Trabajo en equipo",
  "Uso correcto de uniforme",
  "Prevención de riesgos",
  "Comunicación efectiva",
  "Calidad en el servicio",
] as const;

export {
  comentarioKardexVisible,
  etiquetaCursoKardexVisible,
} from "@/lib/categorizacion-kardex";

export function normalizarPromedioRapido(raw: unknown): number | null {
  if (raw === "" || raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(CAT_ESCALA_MAX, Math.max(CAT_ESCALA_MIN, n));
  return Math.round(clamped * 100) / 100;
}

/** Rellena criterios con enteros 1–5 cuya media se acerca al promedio decimal (evita smallint). */
export function scoresDesdePromedioRapido(
  modulo: CatEvalModuloId,
  promedio: number,
  opts?: { rolOperaciones?: CatOperacionesRolId },
): Record<string, number> {
  const campos = camposPorModulo(modulo, opts);
  const n = campos.length;
  const scores: Record<string, number> = {};
  if (n === 0) return scores;

  const target = Math.min(CAT_ESCALA_MAX, Math.max(CAT_ESCALA_MIN, Math.round(promedio * 100) / 100));
  const low = Math.max(CAT_ESCALA_MIN, Math.min(CAT_ESCALA_MAX, Math.floor(target)));
  const high = Math.max(CAT_ESCALA_MIN, Math.min(CAT_ESCALA_MAX, low + 1));
  // Cuántos criterios van en `high` para que la media ≈ target
  const highCount =
    high === low ? 0 : Math.max(0, Math.min(n, Math.round((target - low) * n)));

  campos.forEach((c, i) => {
    scores[c.key] = i < highCount ? high : low;
  });
  return scores;
}

export type PromediosRapidosInput = {
  noEmpleado: string;
  periodMonth?: string;
  puesto?: string;
  fechaIngreso?: string;
  rh?: number | null;
  capacitacion?: number | null;
  operaciones?: number | null;
  enfoque?: number | null;
};

export type PromediosRapidosResult = {
  periodMonth: string;
  guardados: string[];
  promedios: {
    rh: number | null;
    capacitacion: number | null;
    operaciones: number | null;
    enfoque: number | null;
  };
};

async function ensureCursoPorNombre(
  nombre: string,
  admin?: SupabaseClient | null,
): Promise<CatCapacitacionCurso> {
  const cursos = await listCursosCapacitacion(admin);
  const key = nombre.trim().toUpperCase();
  const existente = cursos.find((c) => c.nombre.trim().toUpperCase() === key);
  if (existente) {
    if (!existente.activo) {
      return upsertCursoCapacitacion(
        {
          id: existente.id,
          nombre: existente.nombre,
          activo: true,
          fechaInicio: existente.fechaInicio ?? "",
          fechaVencimiento: existente.fechaVencimiento ?? "",
        },
        admin,
      );
    }
    return existente;
  }
  return upsertCursoCapacitacion(
    {
      nombre: nombre.trim(),
      activo: true,
      fechaInicio: "",
      fechaVencimiento: "",
    },
    admin,
  );
}

function esCursoInternoOLegacy(nombre: string): boolean {
  const n = nombre.trim().toUpperCase();
  return (
    n.includes("PROMEDIO RÁPIDO") ||
    n === "CAPACITACIÓN" ||
    n === "CAPACITACION" ||
    n.startsWith("__")
  );
}

function mezclarAleatorio<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Elige 1–3 cursos con nombre real para el kardex (del catálogo o nombres de formación).
 */
async function elegirCursosKardexAleatorios(
  admin?: SupabaseClient | null,
): Promise<CatCapacitacionCurso[]> {
  const todos = await listCursosCapacitacion(admin);
  let pool = todos.filter((c) => c.activo && !esCursoInternoOLegacy(c.nombre));
  if (pool.length === 0) {
    pool = todos.filter((c) => !esCursoInternoOLegacy(c.nombre));
  }

  const cantidad = 1 + Math.floor(Math.random() * 3); // 1, 2 o 3

  if (pool.length > 0) {
    const max = Math.min(cantidad, pool.length);
    return mezclarAleatorio(pool).slice(0, max);
  }

  // Catálogo vacío: asegura cursos con nombres reales y elige 1–3.
  const nombres = mezclarAleatorio([...NOMBRES_CAP_KARDEX]).slice(0, cantidad);
  const creados: CatCapacitacionCurso[] = [];
  for (const nombre of nombres) {
    creados.push(await ensureCursoPorNombre(nombre, admin));
  }
  return creados;
}

/** Variaciones leves alrededor del promedio para que no se vean idénticos; la media ≈ target. */
function promediosPorCursoCercanos(target: number, n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [target];
  const vals: number[] = [];
  let suma = 0;
  for (let i = 0; i < n - 1; i++) {
    const delta = Math.random() * 0.8 - 0.4; // ±0.4
    const v =
      Math.round(Math.min(CAT_ESCALA_MAX, Math.max(CAT_ESCALA_MIN, target + delta)) * 100) / 100;
    vals.push(v);
    suma += v;
  }
  const ultimo =
    Math.round(Math.min(CAT_ESCALA_MAX, Math.max(CAT_ESCALA_MIN, target * n - suma)) * 100) / 100;
  vals.push(ultimo);
  return vals;
}

async function guardarCapacitacionPromedioRapido(
  no: string,
  periodMonth: string,
  promedio: number,
  admin?: SupabaseClient | null,
): Promise<void> {
  const cursos = await elegirCursosKardexAleatorios(admin);
  const notas = promediosPorCursoCercanos(promedio, cursos.length);

  // Reemplaza registros del mes para este colaborador (captura rápida = set del kardex).
  const existentes = await listRegistrosCapacitacion(admin, { periodMonth });
  for (const r of existentes) {
    if (r.noEmpleado.trim().toUpperCase() === no) {
      await deleteRegistroCapacitacion(r.id, admin);
    }
  }

  for (let i = 0; i < cursos.length; i++) {
    const curso = cursos[i]!;
    const nota = notas[i] ?? promedio;
    await upsertRegistroCapacitacion(
      {
        noEmpleado: no,
        cursoId: curso.id,
        asistencia: null,
        desempeno: Math.round(nota),
        promedio: nota,
        comentarios: "",
        periodMonth,
      },
      admin,
    );
  }
}

export async function leerPromediosRapidosEmpleado(
  noEmpleado: string,
  periodMonthRaw?: string,
  admin?: SupabaseClient | null,
  opts?: { puesto?: string },
): Promise<PromediosRapidosResult["promedios"] & { periodMonth: string }> {
  const no = noEmpleado.trim().toUpperCase();
  const periodMonth = periodMonthEvaluacion(periodMonthRaw);
  const rolOp = rolOperacionesDesdePuesto(opts?.puesto ?? "");

  const [rh, en, opMapas, capRegs] = await Promise.all([
    getCatEvaluacion(no, "recursos_humanos", admin, { periodMonth }).catch(() => null),
    getCatEvaluacion(no, "enfoque_cliente", admin, { periodMonth }).catch(() => null),
    loadMapasPromedioOperaciones(admin, { periodMonth }),
    listRegistrosCapacitacion(admin, { periodMonth }),
  ]);

  const caps = capRegs.filter((r) => r.noEmpleado.trim().toUpperCase() === no);
  let promedioCap: number | null = null;
  if (caps.length > 0) {
    const vals = caps.map((c) => c.promedio).filter((p): p is number => p != null && Number.isFinite(p));
    if (vals.length > 0) {
      promedioCap = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    }
  }

  return {
    periodMonth,
    rh: rh?.promedio ?? null,
    capacitacion: promedioCap,
    operaciones: promedioOperacionesParaEmpleado(no, opts?.puesto ?? "", opMapas),
    enfoque: en?.promedio ?? null,
  };
}

export async function guardarPromediosRapidos(
  input: PromediosRapidosInput,
  admin?: SupabaseClient | null,
): Promise<PromediosRapidosResult> {
  const no = input.noEmpleado.trim().toUpperCase();
  if (!no) throw new Error("Indique el N.º de empleado");
  const periodMonth = periodMonthEvaluacion(input.periodMonth);
  if (!colaboradorVigenteEnMesHistorial(input.fechaIngreso, periodMonth)) {
    const ingreso = mesYmDesdeFechaIngreso(input.fechaIngreso);
    throw new Error(
      `El colaborador ingresó en ${ingreso ?? "fecha posterior"}; no aplica captura en ${periodMonth}.`,
    );
  }
  const puesto = input.puesto ?? "";
  const rolOp = rolOperacionesDesdePuesto(puesto);
  const guardados: string[] = [];
  const comentario = "";

  const rh = normalizarPromedioRapido(input.rh);
  const cap = normalizarPromedioRapido(input.capacitacion);
  const op = normalizarPromedioRapido(input.operaciones);
  const enf = normalizarPromedioRapido(input.enfoque);

  if (rh == null && cap == null && op == null && enf == null) {
    throw new Error("Capture al menos un promedio (1–5)");
  }

  if (rh != null) {
    await upsertCatEvaluacion(
      no,
      "recursos_humanos",
      scoresDesdePromedioRapido("recursos_humanos", rh),
      comentario,
      admin,
      { periodMonth },
    );
    guardados.push("RH");
  }

  if (enf != null) {
    await upsertCatEvaluacion(
      no,
      "enfoque_cliente",
      scoresDesdePromedioRapido("enfoque_cliente", enf),
      comentario,
      admin,
      { periodMonth },
    );
    guardados.push("Enfoque");
  }

  if (op != null) {
    await upsertCatEvaluacion(
      no,
      "operaciones",
      scoresDesdePromedioRapido("operaciones", op, { rolOperaciones: rolOp }),
      comentario,
      admin,
      {
        periodMonth,
        submodulo: rolOp,
        rolOperaciones: rolOp,
        calificadoPor: CALIFICADO_POR_ADMIN,
      },
    );
    guardados.push(rolOp === "jefe_turno" ? "Operaciones (JT/JS)" : "Operaciones (oficial)");
  }

  if (cap != null) {
    await guardarCapacitacionPromedioRapido(no, periodMonth, cap, admin);
    guardados.push("Capacitación");
  }

  const promedios = await leerPromediosRapidosEmpleado(no, periodMonth, admin, { puesto });
  return { periodMonth, guardados, promedios };
}
