import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import type { MoperHistorialEntrada } from "@/lib/moper-historial-types";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  roleMayPurgeMoperHistorial,
  roleMayReadMoperHistorialApi,
  roleMayWriteMoperHistorial,
} from "@/lib/app-role";

export const dynamic = "force-dynamic";

function normalizeNo(no: string): string {
  return no.trim().toUpperCase();
}

function parseLimit(raw: string | null, fallback: number): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(500, n);
}

/** YYYY-MM-DD → inicio del día local (ISO UTC). */
function dayStartIso(yyyyMmDd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/** YYYY-MM-DD → fin del día local (ISO UTC). */
function dayEndIso(yyyyMmDd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 23, 59, 59, 999);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function filtraPorServicioTexto(entries: MoperHistorialEntrada[], servicio: string): MoperHistorialEntrada[] {
  const q = servicio.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) =>
      e.servicioInicial.toLowerCase().includes(q) ||
      e.servicioFinal.toLowerCase().includes(q),
  );
}

/** Une JSON guardado con columnas de la fila (por si `entrada` antigua no traía noEmpleado). */
function mapHistorialRow(r: {
  id: string;
  no_empleado: string;
  entrada: unknown;
}): MoperHistorialEntrada {
  const base = (r.entrada ?? {}) as Partial<MoperHistorialEntrada>;
  const no = normalizeNo(String(base.noEmpleado ?? r.no_empleado ?? ""));
  return {
    noEmpleado: no,
    servicioInicial: String(base.servicioInicial ?? ""),
    servicioFinal: String(base.servicioFinal ?? ""),
    puestoInicial: String(base.puestoInicial ?? ""),
    puestoFinal: String(base.puestoFinal ?? ""),
    motivo: String(base.motivo ?? ""),
    especificacion: String(base.especificacion ?? ""),
    registradoEn: String(base.registradoEn ?? ""),
    historialId: r.id,
  };
}

function entradaSinMeta(entry: MoperHistorialEntrada): Omit<MoperHistorialEntrada, "historialId"> {
  const { historialId: _h, ...rest } = entry;
  return rest;
}

/** GET ?no_empleado=XXX — historial de un colaborador, mas reciente primero
 *  GET sin no_empleado — ultimos movimientos de todos (?limit=100, max 500)
 *    Opcional: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (filtro por fecha `created_at` en servidor)
 *              &servicio=texto (coincidencia en servicio inicial o final, tras traer filas)
 */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadMoperHistorialApi(auth.role)) {
    return NextResponse.json({ error: "No autorizado para ver historial MOPER" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);

  if (!searchParams.has("no_empleado")) {
    const limit = parseLimit(searchParams.get("limit"), 100);
    const desdeRaw = searchParams.get("desde")?.trim() ?? "";
    const hastaRaw = searchParams.get("hasta")?.trim() ?? "";
    const desdeIso = desdeRaw ? dayStartIso(desdeRaw) : null;
    const hastaIso = hastaRaw ? dayEndIso(hastaRaw) : null;
    if (desdeRaw && !desdeIso) {
      return NextResponse.json({ error: "desde debe ser fecha YYYY-MM-DD" }, { status: 400 });
    }
    if (hastaRaw && !hastaIso) {
      return NextResponse.json({ error: "hasta debe ser fecha YYYY-MM-DD" }, { status: 400 });
    }

    let query = admin
      .from("moper_historial")
      .select("id, no_empleado, entrada, created_at")
      .order("created_at", { ascending: false });

    if (desdeIso) query = query.gte("created_at", desdeIso);
    if (hastaIso) query = query.lte("created_at", hastaIso);

    const { data, error } = await query.limit(limit);

    if (error) {
      return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
    }

    let list = (data ?? []).map((r: { id: string; no_empleado: string; entrada: unknown }) =>
      mapHistorialRow(r as { id: string; no_empleado: string; entrada: unknown }),
    );
    const servicio = searchParams.get("servicio")?.trim() ?? "";
    if (servicio) {
      list = filtraPorServicioTexto(list, servicio);
    }
    return NextResponse.json(list);
  }

  const noParam = searchParams.get("no_empleado") ?? "";
  const no = normalizeNo(noParam);
  if (!no) {
    return NextResponse.json({ error: "no_empleado invalido" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("moper_historial")
    .select("id, no_empleado, entrada, created_at")
    .eq("no_empleado", no)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }

  const list = (data ?? []).map((r: { id: string; no_empleado: string; entrada: unknown }) =>
    mapHistorialRow(r as { id: string; no_empleado: string; entrada: unknown }),
  );
  return NextResponse.json(list);
}

/** POST body: MoperHistorialEntrada (sin historialId) */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteMoperHistorial(auth.role)) {
    return NextResponse.json({ error: "No autorizado para registrar MOPER" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  let entrada: MoperHistorialEntrada;
  try {
    entrada = (await req.json()) as MoperHistorialEntrada;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const limpia = entradaSinMeta(entrada);
  const no = normalizeNo(limpia.noEmpleado ?? "");
  if (!no) {
    return NextResponse.json({ error: "noEmpleado requerido" }, { status: 400 });
  }

  const { error } = await admin.from("moper_historial").insert({
    no_empleado: no,
    entrada: limpia as unknown as Record<string, unknown>,
  });

  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE ?id=uuid — elimina una fila del historial MOPER
 *  DELETE ?all=1 — solo admin: elimina todas las filas del historial MOPER (no revierte expedientes).
 */
export async function DELETE(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  const url = new URL(req.url);
  const allParam = url.searchParams.get("all")?.trim().toLowerCase() ?? "";
  const purgeAll = allParam === "1" || allParam === "true" || allParam === "yes";

  if (purgeAll) {
    if (!roleMayPurgeMoperHistorial(auth.role)) {
      return NextResponse.json({ error: "Solo administradores pueden vaciar el historial MOPER" }, { status: 403 });
    }
    const { error } = await admin
      .from("moper_historial")
      .delete()
      .gte("created_at", "1900-01-01T00:00:00Z");
    if (error) {
      return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, purgedAll: true });
  }

  if (!roleMayWriteMoperHistorial(auth.role)) {
    return NextResponse.json({ error: "No autorizado para eliminar historial MOPER" }, { status: 403 });
  }

  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "id UUID requerido" }, { status: 400 });
  }

  const { error } = await admin.from("moper_historial").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
