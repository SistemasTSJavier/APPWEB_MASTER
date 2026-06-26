import type { SupabaseClient } from "@supabase/supabase-js";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import {
  type LegalContratoFila,
  type LegalContratoVista,
  filaContratoDesdeColaborador,
  filtrarFilasContrato,
  serviciosUnicosContratos,
} from "@/lib/legal-contratos";
import { enviarEmailAlertasContratosLegal } from "@/lib/legal-contratos-email";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import { parseISO, startOfDay, subHours } from "date-fns";

export type LegalContratosPayload = {
  referencia: string;
  vista: LegalContratoVista;
  filas: LegalContratoFila[];
  todasElegibles: LegalContratoFila[];
  servicios: string[];
  pendientesEmail: number;
  ultimoEnvioEmail: string | null;
  ultimaEjecucionAutomatica: string | null;
};

function parseReferenciaFecha(raw: string | null | undefined): Date {
  const t = String(raw ?? "").trim();
  if (!t) return startOfDay(new Date());
  const d = parseISO(t.length === 10 ? t : t.slice(0, 10));
  if (Number.isNaN(d.getTime())) return startOfDay(new Date());
  return startOfDay(d);
}

export async function cargarClavesAlertasEnviadas(admin: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await admin.from("legal_contrato_alerta_enviada").select("no_empleado, vencimiento_contrato");
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) return new Set();
    throw new Error(hintSupabaseClientError(error.message));
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    const no = String((row as { no_empleado?: string }).no_empleado ?? "").trim().toUpperCase();
    const v = String((row as { vencimiento_contrato?: string }).vencimiento_contrato ?? "").slice(0, 10);
    if (no && v) set.add(`${no}|${v}`);
  }
  return set;
}

export async function marcarAlertasEnviadas(
  admin: SupabaseClient,
  filas: LegalContratoFila[],
  destinatario: string,
): Promise<void> {
  if (filas.length === 0) return;
  const now = new Date().toISOString();
  const payload = filas.map((f) => ({
    no_empleado: f.noEmpleado,
    vencimiento_contrato: f.fechaVencimientoContrato,
    destinatario,
    enviado_en: now,
  }));
  const { error } = await admin.from("legal_contrato_alerta_enviada").upsert(payload, {
    onConflict: "no_empleado,vencimiento_contrato",
  });
  if (error) throw new Error(hintSupabaseClientError(error.message));
}

export function construirFilasContratos(
  colaboradores: ColaboradorCompleto[],
  ref: Date,
  alertasEnviadas: Set<string>,
): LegalContratoFila[] {
  const filas: LegalContratoFila[] = [];
  for (const c of colaboradores) {
    const f = filaContratoDesdeColaborador(c, ref, alertasEnviadas);
    if (f) filas.push(f);
  }
  return filas;
}

export async function buildLegalContratosPayload(opts: {
  vista?: LegalContratoVista;
  servicio?: string;
  busqueda?: string;
  referencia?: string;
}): Promise<LegalContratosPayload> {
  if (!isSupabaseServerConfigured()) {
    return {
      referencia: "",
      vista: opts.vista ?? "activas",
      filas: [],
      todasElegibles: [],
      servicios: [],
      pendientesEmail: 0,
      ultimoEnvioEmail: null,
      ultimaEjecucionAutomatica: null,
    };
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) throw new Error("Cliente Supabase no disponible");

  const ref = parseReferenciaFecha(opts.referencia);
  const [colaboradores, alertasEnviadas, ultimaCron] = await Promise.all([
    fetchAllColaboradoresCompletos(admin),
    cargarClavesAlertasEnviadas(admin),
    leerUltimaEjecucionCron(admin),
  ]);

  const todasElegibles = construirFilasContratos(colaboradores, ref, alertasEnviadas);
  const vista = opts.vista ?? "activas";
  const filas = filtrarFilasContrato(todasElegibles, {
    vista,
    servicio: opts.servicio,
    busqueda: opts.busqueda,
  });

  const pendientes = todasElegibles.filter((f) => f.alertaEmailPendiente && f.diasRestantes >= 0);

  const { data: ultimo } = await admin
    .from("legal_contrato_alerta_enviada")
    .select("enviado_en")
    .order("enviado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    referencia: ref.toISOString().slice(0, 10),
    vista,
    filas,
    todasElegibles,
    servicios: serviciosUnicosContratos(todasElegibles),
    pendientesEmail: pendientes.length,
    ultimoEnvioEmail: ultimo ? String((ultimo as { enviado_en?: string }).enviado_en ?? "") : null,
    ultimaEjecucionAutomatica: ultimaCron ? ultimaCron.toISOString() : null,
  };
}

const HORAS_MIN_ENTRE_ENVIOS_AUTO = 20;

async function leerUltimaEjecucionCron(admin: SupabaseClient): Promise<Date | null> {
  const { data, error } = await admin
    .from("legal_contrato_cron_state")
    .select("ultima_ejecucion")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) return null;
    throw new Error(hintSupabaseClientError(error.message));
  }
  const raw = (data as { ultima_ejecucion?: string } | null)?.ultima_ejecucion;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function guardarEjecucionCron(
  admin: SupabaseClient,
  enviados: number,
  error: string | null,
): Promise<void> {
  const { error: upErr } = await admin.from("legal_contrato_cron_state").upsert(
    {
      id: 1,
      ultima_ejecucion: new Date().toISOString(),
      ultimo_enviados: enviados,
      ultimo_error: error,
    },
    { onConflict: "id" },
  );
  if (upErr && !/relation|does not exist|schema cache/i.test(upErr.message)) {
    throw new Error(hintSupabaseClientError(upErr.message));
  }
}

/**
 * Envío automático (cron Vercel o al abrir el módulo): como máximo una vez cada ~20 h.
 * @param forzar true = ignorar intervalo (botón manual / cron con secret)
 */
export async function ejecutarEnvioAutomaticoProgramado(opts?: {
  forzar?: boolean;
}): Promise<{
  ok: boolean;
  enviados: number;
  error?: string;
  modo: string;
  omitido?: boolean;
}> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { ok: false, enviados: 0, error: "Supabase no configurado", modo: "error" };

  if (!opts?.forzar) {
    const ultima = await leerUltimaEjecucionCron(admin);
    if (ultima && ultima > subHours(new Date(), HORAS_MIN_ENTRE_ENVIOS_AUTO)) {
      return { ok: true, enviados: 0, modo: "omitido_reciente", omitido: true };
    }
  }

  const result = await procesarEnvioAutomaticoAlertasLegal();
  await guardarEjecucionCron(admin, result.enviados, result.ok ? null : result.error ?? "Error");
  return result;
}

export async function procesarEnvioAutomaticoAlertasLegal(): Promise<{
  ok: boolean;
  enviados: number;
  error?: string;
  modo: string;
}> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { ok: false, enviados: 0, error: "Supabase no configurado", modo: "error" };

  const ref = startOfDay(new Date());
  const colaboradores = await fetchAllColaboradoresCompletos(admin);
  const alertasEnviadas = await cargarClavesAlertasEnviadas(admin);
  const todas = construirFilasContratos(colaboradores, ref, alertasEnviadas);
  const pendientes = todas.filter((f) => f.alertaEmailPendiente && f.diasRestantes >= 0);

  if (pendientes.length === 0) {
    return { ok: true, enviados: 0, modo: "sin_pendientes" };
  }

  const destinatario = (process.env.LEGAL_ALERTAS_EMAIL_TO ?? "legal@tacticalsupport.com.mx").trim();
  const mail = await enviarEmailAlertasContratosLegal(pendientes);
  if (!mail.ok) {
    return { ok: false, enviados: 0, error: mail.error, modo: mail.modo };
  }

  await marcarAlertasEnviadas(admin, pendientes, destinatario);
  return { ok: true, enviados: pendientes.length, modo: mail.modo };
}
