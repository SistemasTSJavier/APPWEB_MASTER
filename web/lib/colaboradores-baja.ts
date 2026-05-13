import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { MoperHistorialEntrada } from "@/lib/moper-historial-types";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import {
  claveServicioAgrupada,
  servicioAgrupadoUsaZona,
  zonaVarianteServicio,
  ZONA_FILTRO_SIN_SUFIJO,
} from "@/lib/servicio-agrupacion";

export { ZONA_FILTRO_SIN_SUFIJO } from "@/lib/servicio-agrupacion";

/** Texto de servicio comparable en listados (trim + espacios colapsados). */
function textoServicioListado(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Clave única para deduplicar y filtrar el mismo nombre de servicio con variantes de espacio o mayúsculas. */
function claveServicioListadoBajas(raw: string): string {
  const t = textoServicioListado(raw);
  return t ? claveServicioAgrupada(t) : "";
}

/** Servicio capturado en alta (no se modifica con MOPER en `aplicarMoperMovimiento`). */
export function servicioAsignadoDesdeExpediente(c: ColaboradorCompleto): string {
  const snap = String(c.servicioAsignado ?? "").trim();
  const enForm = String(c.form?.servicio ?? "").trim();
  return snap || enForm;
}

/** Ultimo destino de servicio segun historial MOPER (mas reciente primero) o expediente. */
export function ultimoServicioMoperDesde(
  c: ColaboradorCompleto,
  historialMoper?: MoperHistorialEntrada[] | null,
): string {
  const lista = historialMoper?.length
    ? [...historialMoper].sort((a, b) => {
        const ta = new Date(a.registradoEn).getTime();
        const tb = new Date(b.registradoEn).getTime();
        if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
        if (Number.isNaN(ta)) return 1;
        if (Number.isNaN(tb)) return -1;
        return tb - ta;
      })
    : [];
  if (lista.length > 0) {
    const ult = String(lista[0]!.servicioFinal ?? "").trim();
    if (ult) return ult;
  }
  const u = String(c.ultimoServicio ?? "").trim();
  if (u) return u;
  return String(c.moperActual?.servicio ?? "").trim();
}

/** Estado del formulario BAJAS (coincide con `bajas/page.tsx`). */
export type BajasFormState = {
  noEmpleado: string;
  nombreCompleto: string;
  servicioAsignado: string;
  ultimoServicio: string;
  nss: string;
  puesto: string;
  ingreso: string;
  fechaBaja: string;
  fechaRenuncia: string;
  ultimoDiaLaborado: string;
  motivoSeparacion: string;
  especificacion: string;
  comentario: string;
};

/** Fecha de ingreso visible: snapshot del expediente o PARTE 1 en `form`. */
function fechaIngresoDesdeExpediente(c: ColaboradorCompleto): string {
  const snap = String(c.fechaIngreso ?? "").trim();
  const enForm = String(c.form?.fechaIngreso ?? "").trim();
  return snap || enForm;
}

/**
 * Fecha de ingreso en `YYYY-MM-DD` para filtros y orden: snapshot del expediente y, si no parsea,
 * `form.fechaIngreso` (PARTE 1). Alineado con metricas de altas por mes en el inicio.
 */
export function fechaIngresoNormalizadaColaborador(c: ColaboradorCompleto): string {
  for (const raw of [String(c.fechaIngreso ?? "").trim(), String(c.form?.fechaIngreso ?? "").trim()]) {
    if (!raw) continue;
    const n = normalizarFechaParaInputDate(raw);
    if (n) return n;
  }
  return "";
}

/**
 * Rellena el formulario BAJAS desde un expediente.
 * Con `historialMoper`: **servicio asignado** = alta (`servicioAsignado` / `form.servicio`);
 * **ultimo servicio** = `servicioFinal` del movimiento MOPER mas reciente (o fallback en expediente).
 */
export function bajasFormDesdeColaborador(
  c: ColaboradorCompleto,
  historialMoper?: MoperHistorialEntrada[] | null,
): BajasFormState {
  const f = c.form ?? {};
  const ingresoRaw = fechaIngresoDesdeExpediente(c);
  return {
    noEmpleado: c.noEmpleado,
    nombreCompleto: c.nombreCompleto,
    servicioAsignado: servicioAsignadoDesdeExpediente(c),
    ultimoServicio: ultimoServicioMoperDesde(c, historialMoper),
    nss: c.nss,
    puesto: c.puesto,
    ingreso: normalizarFechaParaInputDate(ingresoRaw),
    fechaBaja: normalizarFechaParaInputDate(String(f.fechaBaja ?? "")),
    fechaRenuncia: normalizarFechaParaInputDate(String(f.fechaRenuncia ?? "")),
    ultimoDiaLaborado: normalizarFechaParaInputDate(String(f.ultimoDiaLaborado ?? "")),
    motivoSeparacion: String(f.motivoSeparacion ?? ""),
    especificacion: String(f.especificacion ?? ""),
    comentario: String(f.comentarioBaja ?? f.comentario ?? ""),
  };
}

/**
 * Fusiona la captura de BAJAS en el expediente sin borrar PARTE 1–6 del `form`.
 * Los datos de baja viven en `form` con las mismas claves que ALTAS donde aplica + campos de baja.
 */
/** Hay fecha de baja capturada en expediente → considerado inactivo para listados y filtros. */
export function colaboradorTieneBaja(c: ColaboradorCompleto): boolean {
  return String(c.form?.fechaBaja ?? "").trim().length > 0;
}

/** Servicios distintos (asignado en alta y ultimo en expediente) solo entre quienes tienen fecha de baja. */
export function serviciosUnicosColaboradoresDadosDeBaja(rows: ColaboradorCompleto[]): string[] {
  const porClave = new Map<string, string>();
  for (const c of rows) {
    if (!colaboradorTieneBaja(c)) continue;
    for (const raw of [servicioAsignadoDesdeExpediente(c), String(c.ultimoServicio ?? "")]) {
      const clave = claveServicioListadoBajas(raw);
      if (!clave) continue;
      if (!porClave.has(clave)) porClave.set(clave, clave);
    }
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

/** Coincidencia con servicio asignado (alta) o ultimo servicio; misma clave agrupada que el desplegable. */
export function colaboradorCoincideServicioListado(c: ColaboradorCompleto, servicioElegido: string): boolean {
  const sel = claveServicioListadoBajas(servicioElegido);
  if (!sel) return true;
  const a = claveServicioListadoBajas(servicioAsignadoDesdeExpediente(c));
  const u = claveServicioListadoBajas(String(c.ultimoServicio ?? ""));
  return a === sel || u === sel;
}

/** Lineas de expediente (alta / ultimo) cuya clave agrupada coincide con `servicioClave` (ej. CAT, U-ERRE). */
function lineasServicioQueCoincidenClave(c: ColaboradorCompleto, servicioClave: string): string[] {
  const out: string[] = [];
  for (const raw of [servicioAsignadoDesdeExpediente(c), String(c.ultimoServicio ?? "")]) {
    const t = textoServicioListado(raw);
    if (!t) continue;
    if (claveServicioListadoBajas(raw) === servicioClave) out.push(t);
  }
  return out;
}

/**
 * Zonas distintas entre expedientes con baja para CAT / U-ERRE (texto despues del nombre base).
 */
export function zonasDisponiblesFiltroBajas(
  rows: ColaboradorCompleto[],
  servicioClave: string,
): { labels: string[]; haySinSufijo: boolean } {
  if (!servicioAgrupadoUsaZona(servicioClave)) return { labels: [], haySinSufijo: false };
  const set = new Set<string>();
  let haySinSufijo = false;
  for (const c of rows) {
    if (!colaboradorTieneBaja(c)) continue;
    for (const raw of [servicioAsignadoDesdeExpediente(c), String(c.ultimoServicio ?? "")]) {
      const t = textoServicioListado(raw);
      if (!t) continue;
      if (claveServicioAgrupada(t) !== servicioClave) continue;
      const z = zonaVarianteServicio(t);
      if (!z) haySinSufijo = true;
      else set.add(z.toUpperCase());
    }
  }
  return {
    labels: [...set].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    haySinSufijo,
  };
}

function colaboradorCoincideZonaFiltroBajas(
  c: ColaboradorCompleto,
  servicioClave: string,
  zonaElegida: string,
): boolean {
  const z = zonaElegida.trim();
  if (!z) return true;
  if (!servicioAgrupadoUsaZona(servicioClave)) return true;
  const lines = lineasServicioQueCoincidenClave(c, servicioClave);
  for (const line of lines) {
    const zCol = zonaVarianteServicio(line).toUpperCase();
    if (z === ZONA_FILTRO_SIN_SUFIJO) {
      if (zCol === "") return true;
    } else if (zCol === z.toUpperCase()) return true;
  }
  return false;
}

/**
 * Colaboradores con `fechaBaja` en expediente. El rango **Desde/Hasta** se compara contra
 * `ultimoDiaLaborado` del expediente (no contra la fecha de baja). Filtros opcionales: servicio,
 * y zona si el servicio es CAT o U-ERRE.
 */
export function listarColaboradoresBajaFiltrados(
  rows: ColaboradorCompleto[],
  opts: { desde?: string; hasta?: string; servicio?: string; zona?: string },
): ColaboradorCompleto[] {
  const desde = opts.desde?.trim() ?? "";
  const hasta = opts.hasta?.trim() ?? "";
  const servicio = opts.servicio?.trim() ?? "";
  const zona = opts.zona?.trim() ?? "";
  const servicioNorm = servicio ? claveServicioListadoBajas(servicio) : "";
  const filtraPorFechaLaborado = Boolean(desde || hasta);

  return rows.filter((c) => {
    if (!colaboradorTieneBaja(c)) return false;
    const fb = normalizarFechaParaInputDate(String(c.form?.fechaBaja ?? ""));
    if (!fb) return false;
    const udl = normalizarFechaParaInputDate(String(c.form?.ultimoDiaLaborado ?? ""));
    if (filtraPorFechaLaborado) {
      if (!udl) return false;
      if (desde && udl < desde) return false;
      if (hasta && udl > hasta) return false;
    }
    if (servicio && !colaboradorCoincideServicioListado(c, servicio)) return false;
    if (servicioNorm && zona && servicioAgrupadoUsaZona(servicioNorm)) {
      if (!colaboradorCoincideZonaFiltroBajas(c, servicioNorm, zona)) return false;
    }
    return true;
  });
}

export function aplicarBajaEnExpediente(existing: ColaboradorCompleto, b: BajasFormState): ColaboradorCompleto {
  const form = { ...existing.form };
  const ingresoNorm = normalizarFechaParaInputDate(b.ingreso.trim()) || b.ingreso.trim();
  const fechaIngresoFinal = ingresoNorm || existing.fechaIngreso;
  form.fechaIngreso = fechaIngresoFinal;
  form.fechaBaja = b.fechaBaja.trim();
  form.fechaRenuncia = b.fechaRenuncia.trim();
  form.ultimoDiaLaborado = b.ultimoDiaLaborado.trim();
  form.motivoSeparacion = b.motivoSeparacion.trim();
  form.especificacion = b.especificacion.trim();
  form.comentarioBaja = b.comentario.trim();
  form.servicio = b.servicioAsignado.trim() || String(existing.form.servicio ?? "").trim();

  return {
    ...existing,
    nombreCompleto: b.nombreCompleto.trim() || existing.nombreCompleto,
    servicioAsignado: b.servicioAsignado.trim(),
    ultimoServicio: b.ultimoServicio.trim(),
    nss: b.nss.trim(),
    puesto: b.puesto.trim(),
    fechaIngreso: fechaIngresoFinal,
    form,
  };
}
