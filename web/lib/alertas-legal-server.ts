import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import { fetchColaboradoresDbRowsByNos } from "@/lib/colaboradores-supabase-fetch-all";
import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import { canonicalEmpNoAttendance } from "@/lib/attendance-emp-no";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import { enviarEmailAlertaLegalLlegada } from "@/lib/alertas-legal-email";
import {
  esAlertaLegalEstado,
  esAlertaLegalMotivo,
  type AlertaLegalEstado,
  type AlertaLegalFila,
  type AlertaLegalMotivo,
} from "@/lib/alertas-legal-types";

function admin() {
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

type DbRow = {
  id: string;
  no_empleado: string;
  nombre: string;
  servicio: string;
  motivo: string;
  notas: string;
  estado: string;
  created_by_email: string;
  created_at: string;
  llego_at: string | null;
  llego_by_email: string | null;
  email_enviado_at: string | null;
  email_error: string | null;
};

function mapRow(r: DbRow): AlertaLegalFila {
  return {
    id: r.id,
    noEmpleado: r.no_empleado,
    nombre: r.nombre,
    servicio: r.servicio,
    motivo: esAlertaLegalMotivo(r.motivo) ? r.motivo : "otro",
    notas: r.notas ?? "",
    estado: esAlertaLegalEstado(r.estado) ? r.estado : "pendiente",
    createdByEmail: r.created_by_email ?? "",
    createdAt: r.created_at,
    llegoAt: r.llego_at,
    llegoByEmail: r.llego_by_email,
    emailEnviadoAt: r.email_enviado_at,
    emailError: r.email_error,
  };
}

export async function listarAlertasLegal(opts?: {
  estado?: AlertaLegalEstado;
}): Promise<{ ok: true; rows: AlertaLegalFila[] } | { ok: false; error: string }> {
  const sb = admin();
  if (!sb) return { ok: false, error: "Supabase no configurado." };
  let q = sb.from("alertas_legal_watchlist").select("*").order("created_at", { ascending: false }).limit(400);
  if (opts?.estado) q = q.eq("estado", opts.estado);
  const { data, error } = await q;
  if (error) return { ok: false, error: hintSupabaseClientError(error.message) };
  return { ok: true, rows: (data ?? []).map((r) => mapRow(r as DbRow)) };
}

export async function datosColaboradorParaAlerta(noEmpleado: string): Promise<{
  noEmpleado: string;
  nombre: string;
  servicio: string;
} | null> {
  const sb = admin();
  if (!sb) return null;
  const canon = canonicalEmpNoAttendance(noEmpleado);
  if (!canon) return null;
  let rows: Awaited<ReturnType<typeof fetchColaboradoresDbRowsByNos>> = [];
  try {
    rows = await fetchColaboradoresDbRowsByNos(sb, [canon, noEmpleado]);
  } catch {
    return null;
  }
  for (const r of rows) {
    const c = normalizeToCompleto(r.data);
    if (!c) continue;
    const dbNo = String(r.no_empleado ?? "").trim().toUpperCase();
    const hit = {
      ...c,
      noEmpleado: dbNo || c.noEmpleado,
      form: { ...c.form, noEmpleado1: dbNo || c.noEmpleado } as Record<string, string>,
    };
    const a = canonicalEmpNoAttendance(hit.noEmpleado);
    const b = canonicalEmpNoAttendance(String(hit.form.noEmpleado1 ?? ""));
    if (a !== canon && b !== canon) continue;
    return {
      noEmpleado: a || canon,
      nombre: String(hit.nombreCompleto ?? hit.form.nombreCompleto ?? "").trim(),
      servicio: servicioLineaColaborador(hit),
    };
  }
  return null;
}

export async function crearAlertaLegal(opts: {
  noEmpleado: string;
  nombre?: string;
  servicio?: string;
  motivo: AlertaLegalMotivo;
  notas?: string;
  createdByEmail: string;
}): Promise<{ ok: true; row: AlertaLegalFila } | { ok: false; error: string; status?: number }> {
  const sb = admin();
  if (!sb) return { ok: false, error: "Supabase no configurado." };
  const canon = canonicalEmpNoAttendance(opts.noEmpleado);
  if (!canon) return { ok: false, error: "Indica un N.º de empleado válido.", status: 400 };

  const exp = await datosColaboradorParaAlerta(canon);
  const nombre = (opts.nombre ?? "").trim() || exp?.nombre || "";
  if (nombre.length < 2) {
    return { ok: false, error: "No se encontró el colaborador. Escribe también el nombre.", status: 400 };
  }

  const { data, error } = await sb
    .from("alertas_legal_watchlist")
    .insert({
      no_empleado: canon,
      nombre,
      servicio: (opts.servicio ?? "").trim() || exp?.servicio || "",
      motivo: opts.motivo,
      notas: (opts.notas ?? "").trim(),
      estado: "pendiente",
      created_by_email: opts.createdByEmail,
    })
    .select("*")
    .single();

  if (error) {
    if (/uq_alertas_legal_pendiente_emp|duplicate key/i.test(error.message)) {
      return { ok: false, error: "Esa persona ya está en la lista pendiente.", status: 409 };
    }
    return { ok: false, error: hintSupabaseClientError(error.message) };
  }
  return { ok: true, row: mapRow(data as DbRow) };
}

export async function marcarAlertaLegalLlego(opts: {
  id: string;
  recepcionEmail: string;
}): Promise<
  | { ok: true; row: AlertaLegalFila; emailOk: boolean; emailError?: string; emailTo: string }
  | { ok: false; error: string; status?: number }
> {
  const sb = admin();
  if (!sb) return { ok: false, error: "Supabase no configurado." };

  const { data: current, error: getErr } = await sb
    .from("alertas_legal_watchlist")
    .select("*")
    .eq("id", opts.id)
    .maybeSingle();
  if (getErr) return { ok: false, error: hintSupabaseClientError(getErr.message) };
  if (!current) return { ok: false, error: "Registro no encontrado.", status: 404 };

  const fila = mapRow(current as DbRow);
  if (fila.estado === "cancelado") {
    return { ok: false, error: "Esta alerta ya fue cancelada.", status: 400 };
  }

  const now = new Date().toISOString();
  let emailOk = Boolean(fila.emailEnviadoAt);
  let emailError = fila.emailError ?? undefined;
  let emailTo = "";

  if (!fila.emailEnviadoAt) {
    const mail = await enviarEmailAlertaLegalLlegada(
      { ...fila, estado: "llego", llegoAt: now, llegoByEmail: opts.recepcionEmail },
      opts.recepcionEmail,
    );
    emailTo = mail.to;
    emailOk = mail.ok;
    emailError = mail.error;
  }

  const upd: Record<string, unknown> = {
    estado: "llego",
    llego_at: fila.llegoAt ?? now,
    llego_by_email: fila.llegoByEmail ?? opts.recepcionEmail,
    updated_at: now,
  };
  if (emailOk) {
    upd.email_enviado_at = now;
    upd.email_error = null;
  } else {
    upd.email_error = emailError ?? "No se pudo enviar el correo.";
  }

  const { data, error } = await sb
    .from("alertas_legal_watchlist")
    .update(upd)
    .eq("id", opts.id)
    .select("*")
    .single();
  if (error) return { ok: false, error: hintSupabaseClientError(error.message) };

  return {
    ok: true,
    row: mapRow(data as DbRow),
    emailOk,
    emailError,
    emailTo,
  };
}

export async function cancelarAlertaLegal(
  id: string,
): Promise<{ ok: true; row: AlertaLegalFila } | { ok: false; error: string; status?: number }> {
  const sb = admin();
  if (!sb) return { ok: false, error: "Supabase no configurado." };
  const { data, error } = await sb
    .from("alertas_legal_watchlist")
    .update({ estado: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: hintSupabaseClientError(error.message) };
  if (!data) return { ok: false, error: "Solo se pueden cancelar alertas pendientes.", status: 400 };
  return { ok: true, row: mapRow(data as DbRow) };
}
