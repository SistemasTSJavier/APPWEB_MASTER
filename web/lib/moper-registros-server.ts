import type { SupabaseClient } from "@supabase/supabase-js";
import { hintSupabaseClientError } from "@/lib/supabase/admin";
import type {
  MoperFirmaTipo,
  MoperRegistroApi,
  MoperRegistroCreateBody,
  MoperRegistroRow,
  MoperResumenApi,
} from "@/lib/moper-registros-types";

const FOLIO_PREFIX = "SPT/No. ";
const FOLIO_SUFFIX = "/MOP";

function failSupabase(error: { message: string }): never {
  throw new Error(hintSupabaseClientError(error.message));
}

function padFolioNum(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(4, "0");
}

export function formatFolio(num: number): string {
  return `${FOLIO_PREFIX}${padFolioNum(num)}${FOLIO_SUFFIX}`;
}

function randomCodigoAcceso(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]!;
  return s;
}

async function generarCodigoUnico(admin: SupabaseClient): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const c = randomCodigoAcceso();
    const { data } = await admin.from("moper_registros").select("id").eq("codigo_acceso", c).maybeSingle();
    if (!data) return c;
  }
  throw new Error("No se pudo generar codigo de acceso");
}

export async function leerSiguienteFolioPreview(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from("moper_folio_seq").select("next_num").eq("id", 1).maybeSingle();
  if (error) failSupabase(error);
  if (!data) {
    const { error: insErr } = await admin.from("moper_folio_seq").upsert({ id: 1, next_num: 280 });
    if (insErr) failSupabase(insErr);
    return formatFolio(280);
  }
  const n = Number(data.next_num ?? 280);
  return formatFolio(Number.isFinite(n) ? n : 280);
}

export async function ajustarFolioSecuencia(admin: SupabaseClient, delta: number): Promise<string> {
  const { data, error } = await admin.from("moper_folio_seq").select("next_num").eq("id", 1).maybeSingle();
  if (error) failSupabase(error);
  let next = Number(data?.next_num ?? 280);
  if (!Number.isFinite(next)) next = 280;
  next = Math.max(1, next + Math.trunc(delta));
  const { error: upErr } = await admin
    .from("moper_folio_seq")
    .update({ next_num: next, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (upErr) failSupabase(upErr);
  return formatFolio(next);
}

async function asignarFolioSiCorresponde(admin: SupabaseClient, row: MoperRegistroRow): Promise<string | null> {
  if (row.folio) return row.folio;
  const { data, error } = await admin.from("moper_folio_seq").select("next_num").eq("id", 1).maybeSingle();
  if (error) failSupabase(error);
  let num = Number(data?.next_num ?? 280);
  if (!Number.isFinite(num)) num = 280;
  const folio = formatFolio(num);
  const next = num + 1;
  const { error: upSeq } = await admin
    .from("moper_folio_seq")
    .update({ next_num: next, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (upSeq) failSupabase(upSeq);
  return folio;
}

function rowCompletado(r: MoperRegistroRow): boolean {
  return Boolean(
    r.firma_conformidad_at &&
      r.firma_rh_at &&
      r.firma_gerente_at &&
      r.firma_control_at,
  );
}

export function mapRegistroToApi(r: MoperRegistroRow): MoperRegistroApi {
  return {
    id: r.id,
    folio: r.folio,
    oficial_nombre: r.oficial_nombre,
    curp: r.curp,
    fecha_ingreso: r.fecha_ingreso,
    fecha_inicio_efectiva: r.fecha_inicio_efectiva,
    servicio_actual_nombre: r.servicio_actual_nombre,
    servicio_nuevo_nombre: r.servicio_nuevo_nombre,
    puesto_actual_nombre: r.puesto_actual_nombre,
    puesto_nuevo_nombre: r.puesto_nuevo_nombre,
    sueldo_actual: r.sueldo_actual,
    sueldo_nuevo: r.sueldo_nuevo,
    motivo: r.motivo,
    razon: r.razon ?? "",
    creado_por: r.creado_por,
    solicitado_por: r.solicitado_por,
    fecha_llenado: r.created_at,
    fecha_registro: r.created_at,
    created_at: r.created_at,
    firma_conformidad_at: r.firma_conformidad_at,
    firma_conformidad_nombre: r.firma_conformidad_nombre,
    firma_conformidad_imagen: r.firma_conformidad_imagen,
    firma_rh_at: r.firma_rh_at,
    firma_rh_nombre: r.firma_rh_nombre,
    firma_rh_imagen: r.firma_rh_imagen,
    firma_gerente_at: r.firma_gerente_at,
    firma_gerente_nombre: r.firma_gerente_nombre,
    firma_gerente_imagen: r.firma_gerente_imagen,
    firma_control_at: r.firma_control_at,
    firma_control_nombre: r.firma_control_nombre,
    firma_control_imagen: r.firma_control_imagen,
    completado: r.completado,
    codigo_acceso: r.codigo_acceso,
    estado: r.estado,
  };
}

export async function listarResumenMoper(admin: SupabaseClient): Promise<MoperResumenApi> {
  const { data, error } = await admin
    .from("moper_registros")
    .select("*")
    .neq("estado", "cancelado")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) failSupabase(error);
  const rows = (data ?? []) as MoperRegistroRow[];
  const pendientesRows = rows.filter((r) => r.estado === "pendiente" && !r.completado);
  const aprobadosRows = rows.filter((r) => r.estado === "aprobado" || r.completado);
  const mapItem = (r: MoperRegistroRow) => ({
    id: r.id,
    folio: r.folio,
    oficial_nombre: r.oficial_nombre || null,
    fecha_hora: r.created_at,
  });
  return {
    pendientes: pendientesRows.length,
    aprobados: aprobadosRows.length,
    registrosPendientes: pendientesRows.map(mapItem),
    registrosAprobados: aprobadosRows.map(mapItem),
  };
}

export async function obtenerRegistroPorId(admin: SupabaseClient, id: number): Promise<MoperRegistroApi | null> {
  const { data, error } = await admin.from("moper_registros").select("*").eq("id", id).maybeSingle();
  if (error) failSupabase(error);
  if (!data) return null;
  return mapRegistroToApi(data as MoperRegistroRow);
}

export async function obtenerRegistroPorCodigo(admin: SupabaseClient, codigo: string): Promise<MoperRegistroApi | null> {
  const c = codigo.trim().toUpperCase();
  const { data, error } = await admin.from("moper_registros").select("*").eq("codigo_acceso", c).maybeSingle();
  if (error) failSupabase(error);
  if (!data) return null;
  if ((data as MoperRegistroRow).estado === "cancelado") return null;
  return mapRegistroToApi(data as MoperRegistroRow);
}

export async function crearRegistroMoper(
  admin: SupabaseClient,
  body: MoperRegistroCreateBody,
): Promise<MoperRegistroApi> {
  const oficial = String(body.oficial_nombre ?? "").trim();
  if (!oficial) throw new Error("Indique el nombre del oficial");
  const fechaEfectiva = String(body.fecha_inicio_efectiva ?? "").trim().slice(0, 10);
  if (!fechaEfectiva) throw new Error("Indique la fecha de inicio efectiva");
  const servicioNuevo = String(body.servicio_nuevo_nombre ?? "").trim();
  const puestoNuevo = String(body.puesto_nuevo_nombre ?? "").trim();
  if (!servicioNuevo || !puestoNuevo) throw new Error("Complete servicio y puesto nuevos");

  const codigo = await generarCodigoUnico(admin);
  const insert = {
    codigo_acceso: codigo,
    oficial_nombre: oficial,
    curp: String(body.curp ?? "").trim(),
    fecha_ingreso: body.fecha_ingreso ? String(body.fecha_ingreso).trim().slice(0, 10) : null,
    fecha_inicio_efectiva: fechaEfectiva,
    servicio_actual_nombre: String(body.servicio_actual_nombre ?? "").trim(),
    servicio_nuevo_nombre: servicioNuevo,
    puesto_actual_nombre: String(body.puesto_actual_nombre ?? "").trim(),
    puesto_nuevo_nombre: puestoNuevo,
    sueldo_actual: body.sueldo_actual != null ? Number(body.sueldo_actual) : null,
    sueldo_nuevo: Number(body.sueldo_nuevo) || 0,
    motivo: String(body.motivo ?? "").trim(),
    razon: String(body.razon ?? "").trim(),
    creado_por: body.creado_por?.trim() || null,
    solicitado_por: body.solicitado_por?.trim() || null,
    estado: "pendiente",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin.from("moper_registros").insert(insert).select("*").single();
  if (error) failSupabase(error);
  return mapRegistroToApi(data as MoperRegistroRow);
}

export async function actualizarRegistroMoper(
  admin: SupabaseClient,
  id: number,
  body: MoperRegistroCreateBody,
): Promise<MoperRegistroApi> {
  const { data: existing, error: exErr } = await admin.from("moper_registros").select("*").eq("id", id).maybeSingle();
  if (exErr) failSupabase(exErr);
  if (!existing) throw new Error("Registro no encontrado");
  const row = existing as MoperRegistroRow;
  if (row.estado === "cancelado") throw new Error("Registro cancelado");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.oficial_nombre !== undefined) patch.oficial_nombre = String(body.oficial_nombre).trim();
  if (body.curp !== undefined) patch.curp = String(body.curp).trim();
  if (body.fecha_ingreso !== undefined) {
    patch.fecha_ingreso = body.fecha_ingreso ? String(body.fecha_ingreso).trim().slice(0, 10) : null;
  }
  if (body.fecha_inicio_efectiva !== undefined) {
    patch.fecha_inicio_efectiva = String(body.fecha_inicio_efectiva).trim().slice(0, 10);
  }
  if (body.servicio_actual_nombre !== undefined) patch.servicio_actual_nombre = String(body.servicio_actual_nombre).trim();
  if (body.servicio_nuevo_nombre !== undefined) patch.servicio_nuevo_nombre = String(body.servicio_nuevo_nombre).trim();
  if (body.puesto_actual_nombre !== undefined) patch.puesto_actual_nombre = String(body.puesto_actual_nombre).trim();
  if (body.puesto_nuevo_nombre !== undefined) patch.puesto_nuevo_nombre = String(body.puesto_nuevo_nombre).trim();
  if (body.sueldo_actual !== undefined) patch.sueldo_actual = body.sueldo_actual != null ? Number(body.sueldo_actual) : null;
  if (body.sueldo_nuevo !== undefined) patch.sueldo_nuevo = Number(body.sueldo_nuevo) || 0;
  if (body.motivo !== undefined) patch.motivo = String(body.motivo).trim();
  if (body.razon !== undefined) patch.razon = String(body.razon).trim();
  if (body.creado_por !== undefined) patch.creado_por = body.creado_por?.trim() || null;
  if (body.solicitado_por !== undefined) patch.solicitado_por = body.solicitado_por?.trim() || null;

  const { data, error } = await admin.from("moper_registros").update(patch).eq("id", id).select("*").single();
  if (error) failSupabase(error);
  return mapRegistroToApi(data as MoperRegistroRow);
}

export async function cancelarRegistroMoper(admin: SupabaseClient, id: number): Promise<void> {
  const { error } = await admin
    .from("moper_registros")
    .update({ estado: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) failSupabase(error);
}

const FIRMA_COLS: Record<
  MoperFirmaTipo,
  { at: string; nombre: string; imagen: string; label: string }
> = {
  conformidad: {
    at: "firma_conformidad_at",
    nombre: "firma_conformidad_nombre",
    imagen: "firma_conformidad_imagen",
    label: "Firma de conformidad",
  },
  rh: { at: "firma_rh_at", nombre: "firma_rh_nombre", imagen: "firma_rh_imagen", label: "Gerente RH" },
  gerente: {
    at: "firma_gerente_at",
    nombre: "firma_gerente_nombre",
    imagen: "firma_gerente_imagen",
    label: "Gerente de Operaciones",
  },
  control: {
    at: "firma_control_at",
    nombre: "firma_control_nombre",
    imagen: "firma_control_imagen",
    label: "Centro de Control",
  },
};

export async function registrarFirmaMoper(
  admin: SupabaseClient,
  id: number,
  tipo: MoperFirmaTipo,
  imagen: string,
  options: { nombreFirmante: string; codigoAcceso?: string },
): Promise<MoperRegistroApi> {
  const { data: existing, error: exErr } = await admin.from("moper_registros").select("*").eq("id", id).maybeSingle();
  if (exErr) failSupabase(exErr);
  if (!existing) throw new Error("Registro no encontrado");
  let row = existing as MoperRegistroRow;
  if (row.estado === "cancelado") throw new Error("Registro cancelado");

  const cols = FIRMA_COLS[tipo];
  if (!cols) throw new Error("Tipo de firma invalido");
  if ((row as Record<string, unknown>)[cols.at]) throw new Error(`${cols.label} ya registrada`);

  if (tipo === "conformidad") {
    const cod = (options.codigoAcceso ?? "").trim().toUpperCase();
    if (!cod || cod !== row.codigo_acceso) throw new Error("Codigo de acceso incorrecto");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    [cols.at]: now,
    [cols.nombre]: options.nombreFirmante.trim() || cols.label,
    [cols.imagen]: imagen,
    updated_at: now,
  };
  if (tipo === "conformidad" && !row.folio) {
    patch.folio = await asignarFolioSiCorresponde(admin, row);
  }

  const { data, error } = await admin.from("moper_registros").update(patch).eq("id", id).select("*").single();
  if (error) failSupabase(error);
  const updated = data as MoperRegistroRow;
  const completado = rowCompletado(updated);
  if (completado && !updated.completado) {
    await admin
      .from("moper_registros")
      .update({
        completado: true,
        estado: "aprobado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    const { data: final } = await admin.from("moper_registros").select("*").eq("id", id).single();
    return mapRegistroToApi(final as MoperRegistroRow);
  }
  return mapRegistroToApi(updated);
}
