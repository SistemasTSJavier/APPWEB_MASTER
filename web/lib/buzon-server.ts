import { randomUUID } from "crypto";
import { createSupabaseServiceRoleClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import {
  BUZON_EVIDENCIA_BUCKET,
  aVerificacionPublica,
  esBuzonEstatus,
  generarCodigoSeguimiento,
  mapBuzonRow,
  normalizarCodigoSeguimiento,
  type BuzonAprobacion,
  type BuzonCreateFields,
  type BuzonEstatus,
  type BuzonNota,
  type BuzonRegistro,
  type BuzonVerificacionPublica,
} from "@/lib/buzon";

function adminClient() {
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export async function subirEvidenciaBuzon(
  buf: Buffer,
  mime: string,
): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extFromMime(mime)}`;
  const { error: upErr } = await admin.storage.from(BUZON_EVIDENCIA_BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) {
    const msg = upErr.message || "No se pudo subir la evidencia.";
    if (/bucket|not found|does not exist/i.test(msg)) {
      return {
        ok: false,
        error:
          "Falta el bucket de evidencias. Aplique la migración 068_buzon.sql en Supabase (SQL Editor).",
      };
    }
    return { ok: false, error: msg };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUZON_EVIDENCIA_BUCKET).getPublicUrl(path);

  return { ok: true, path, url: publicUrl };
}

async function insertarConCodigo(
  data: BuzonCreateFields,
  evidenciaPath: string,
  evidenciaUrl: string,
  intentos = 5,
): Promise<{ ok: true; row: BuzonRegistro } | { ok: false; error: string }> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  let lastError = "No se pudo guardar el registro.";
  for (let i = 0; i < intentos; i++) {
    const codigo = generarCodigoSeguimiento();
    const { data: row, error } = await admin
      .from("buzon_registros")
      .insert({
        codigo_seguimiento: codigo,
        departamento: data.departamento,
        nombre_colaborador: data.nombreColaborador,
        queja_requerimiento: data.quejaRequerimiento,
        evidencia_path: evidenciaPath,
        evidencia_url: evidenciaUrl,
        aprobacion: "pendiente",
        estatus: null,
        notas: [],
      })
      .select("*")
      .single();

    if (!error && row) {
      return { ok: true, row: mapBuzonRow(row as Record<string, unknown>) };
    }
    lastError = error?.message ?? lastError;
    if (error && /duplicate|unique|codigo_seguimiento/i.test(error.message)) continue;
    break;
  }
  return { ok: false, error: lastError };
}

export async function crearRegistroBuzon(
  data: BuzonCreateFields,
  evidencia: { buf: Buffer; mime: string },
): Promise<{ ok: true; row: BuzonRegistro } | { ok: false; error: string }> {
  const up = await subirEvidenciaBuzon(evidencia.buf, evidencia.mime);
  if (!up.ok) return up;

  const inserted = await insertarConCodigo(data, up.path, up.url);
  if (!inserted.ok) {
    const admin = adminClient();
    if (admin) {
      try {
        await admin.storage.from(BUZON_EVIDENCIA_BUCKET).remove([up.path]);
      } catch {
        /* ignore */
      }
    }
  }
  return inserted;
}

export async function verificarRegistroBuzon(
  codigoRaw: string,
): Promise<
  | { ok: true; registro: BuzonVerificacionPublica }
  | { ok: false; error: string; status?: number }
> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  const codigo = normalizarCodigoSeguimiento(codigoRaw);
  if (codigo.length < 6) {
    return { ok: false, error: "Indique un código de seguimiento válido.", status: 400 };
  }

  const { data: row, error } = await admin
    .from("buzon_registros")
    .select("*")
    .eq("codigo_seguimiento", codigo)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "No se encontró un registro con ese código.", status: 404 };

  return {
    ok: true,
    registro: aVerificacionPublica(mapBuzonRow(row as Record<string, unknown>)),
  };
}

export async function listarRegistrosBuzon(opts?: {
  aprobacion?: BuzonAprobacion;
  estatus?: BuzonEstatus;
}): Promise<{ ok: true; rows: BuzonRegistro[] } | { ok: false; error: string }> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  let q = admin.from("buzon_registros").select("*").order("created_at", { ascending: false });
  if (opts?.aprobacion) q = q.eq("aprobacion", opts.aprobacion);
  if (opts?.estatus) q = q.eq("estatus", opts.estatus);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    rows: (data ?? []).map((r) => mapBuzonRow(r as Record<string, unknown>)),
  };
}

export async function actualizarAprobacionBuzon(
  id: string,
  aprobacion: "aprobado" | "no_aprobado",
  nota: string,
  byEmail: string,
): Promise<{ ok: true; row: BuzonRegistro } | { ok: false; error: string; status?: number }> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  const registroId = String(id ?? "").trim();
  if (!registroId) return { ok: false, error: "Id inválido.", status: 400 };
  if (aprobacion !== "aprobado" && aprobacion !== "no_aprobado") {
    return { ok: false, error: "Aprobación inválida.", status: 400 };
  }

  const notaLimpia = String(nota ?? "").trim().slice(0, 2000);
  if (notaLimpia.length < 3) {
    return {
      ok: false,
      error: "Agregue una nota al decidir la aprobación (mínimo 3 caracteres).",
      status: 400,
    };
  }

  const { data: prev, error: prevErr } = await admin
    .from("buzon_registros")
    .select("*")
    .eq("id", registroId)
    .maybeSingle();

  if (prevErr) return { ok: false, error: prevErr.message };
  if (!prev) return { ok: false, error: "Registro no encontrado.", status: 404 };

  const current = mapBuzonRow(prev as Record<string, unknown>);
  if (current.aprobacion !== "pendiente") {
    return {
      ok: false,
      error: "Este registro ya tiene una decisión de aprobación.",
      status: 400,
    };
  }

  const nuevaNota: BuzonNota = {
    at: new Date().toISOString(),
    by: (byEmail ?? "").trim().slice(0, 200) || "usuario",
    tipo: "aprobacion",
    aprobacion,
    nota: notaLimpia,
  };
  const notas = [...current.notas, nuevaNota];

  const patch: Record<string, unknown> = {
    aprobacion,
    notas,
    updated_at: new Date().toISOString(),
  };
  if (aprobacion === "aprobado") {
    patch.estatus = "recibido";
  } else {
    patch.estatus = null;
  }

  const { data: row, error } = await admin
    .from("buzon_registros")
    .update(patch)
    .eq("id", registroId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "No se pudo actualizar.", status: 500 };
  return { ok: true, row: mapBuzonRow(row as Record<string, unknown>) };
}

export async function actualizarEstatusBuzon(
  id: string,
  estatus: BuzonEstatus,
  nota: string,
  byEmail: string,
): Promise<{ ok: true; row: BuzonRegistro } | { ok: false; error: string; status?: number }> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  const registroId = String(id ?? "").trim();
  if (!registroId) return { ok: false, error: "Id inválido.", status: 400 };
  if (!esBuzonEstatus(estatus)) return { ok: false, error: "Estatus inválido.", status: 400 };

  const notaLimpia = String(nota ?? "").trim().slice(0, 2000);
  if (notaLimpia.length < 3) {
    return { ok: false, error: "Agregue una nota al cambiar el estatus (mínimo 3 caracteres).", status: 400 };
  }

  const { data: prev, error: prevErr } = await admin
    .from("buzon_registros")
    .select("*")
    .eq("id", registroId)
    .maybeSingle();

  if (prevErr) return { ok: false, error: prevErr.message };
  if (!prev) return { ok: false, error: "Registro no encontrado.", status: 404 };

  const current = mapBuzonRow(prev as Record<string, unknown>);
  if (current.aprobacion !== "aprobado") {
    return {
      ok: false,
      error: "Solo los registros aprobados pueden cambiar de estatus.",
      status: 400,
    };
  }

  const nuevaNota: BuzonNota = {
    at: new Date().toISOString(),
    by: (byEmail ?? "").trim().slice(0, 200) || "usuario",
    tipo: "estatus",
    estatus,
    nota: notaLimpia,
  };
  const notas = [...current.notas, nuevaNota];

  const { data: row, error } = await admin
    .from("buzon_registros")
    .update({
      estatus,
      notas,
      updated_at: new Date().toISOString(),
    })
    .eq("id", registroId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "No se pudo actualizar.", status: 500 };
  return { ok: true, row: mapBuzonRow(row as Record<string, unknown>) };
}
