import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRenumeracionCsv, type RenumeracionCsvRow } from "@/lib/altas-csv-renumeracion";
import { mapaColaboradoresPorNo } from "@/lib/colaboradores-csv-columna-import";
import { normalizeNoEmpleado } from "@/lib/colaboradores-normalize";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { EXPEDIENTE_LEGAL_BUCKET } from "@/lib/expediente-legal-constants";

const FOTOS_BUCKET = "colaboradores-fotos";

export type RenumeracionPlanOk = {
  ok: true;
  /** Ultima fila gana si hay N° actual duplicado en el CSV. */
  pairs: RenumeracionCsvRow[];
};

export type RenumeracionPlanErr = { ok: false; errors: string[] };

export type RenumeracionEjecucionOk = { ok: true; renumerados: number; avisos: string[] };

export type RenumeracionEjecucionResult = RenumeracionEjecucionOk;

function colaboradorConNuevoNo(c: ColaboradorCompleto, noNuevo: string): ColaboradorCompleto {
  const form: Record<string, string> = { ...c.form, noEmpleado1: noNuevo };
  const fichaFotoUrl = form.fichaFotoUrl ?? "";
  if (fichaFotoUrl.includes(`/${c.noEmpleado}/`)) {
    form.fichaFotoUrl = fichaFotoUrl.replace(`/${c.noEmpleado}/`, `/${noNuevo}/`);
  }
  return { ...c, noEmpleado: noNuevo, form };
}

/** Valida CSV y pares contra mapa de expedientes cargado. */
export function planificarRenumeracionCsv(
  csvText: string,
  byNo: Map<string, ColaboradorCompleto>,
): RenumeracionPlanOk | RenumeracionPlanErr {
  const parsed = parseRenumeracionCsv(csvText);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const pairsMap = new Map<string, string>();
  const errors: string[] = [];
  const nuevosEnCsv = new Map<string, string>();

  for (const { noActual, noNuevo } of parsed.rows) {
    if (noActual === noNuevo) {
      errors.push(`${noActual}: ACTUAL Y NUEVO SON IGUALES`);
      continue;
    }
    if (!byNo.has(noActual)) {
      errors.push(`${noActual}: SIN EXPEDIENTE`);
      continue;
    }
    if (byNo.has(noNuevo) && noNuevo !== noActual) {
      errors.push(`${noNuevo}: YA EXISTE OTRO EXPEDIENTE CON ESE NUMERO`);
      continue;
    }
    const prevDestino = nuevosEnCsv.get(noNuevo);
    if (prevDestino && prevDestino !== noActual) {
      errors.push(`${noNuevo}: DUPLICADO COMO DESTINO (FILAS ${prevDestino} Y ${noActual})`);
      continue;
    }
    nuevosEnCsv.set(noNuevo, noActual);
    if (pairsMap.has(noActual) && pairsMap.get(noActual) !== noNuevo) {
      errors.push(`${noActual}: VARIOS NUEVOS EN EL CSV; SE USARA EL ULTIMO`);
    }
    pairsMap.set(noActual, noNuevo);
  }

  const pairs = [...pairsMap.entries()].map(([noActual, noNuevo]) => ({ noActual, noNuevo }));
  if (pairs.length === 0) {
    return {
      ok: false,
      errors: errors.length ? errors : ["NINGUNA FILA VALIDA PARA RENUMERAR."],
    };
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return { ok: true, pairs };
}

export type RenumeracionRunResult = RenumeracionPlanErr | RenumeracionEjecucionOk;

async function moverPrefijoStorage(
  admin: SupabaseClient,
  bucket: string,
  noActual: string,
  noNuevo: string,
): Promise<void> {
  const { data: items, error: listErr } = await admin.storage.from(bucket).list(noActual, { limit: 500 });
  if (listErr || !items?.length) return;

  for (const item of items) {
    const name = item.name;
    if (!name || name.endsWith("/")) continue;
    const fromPath = `${noActual}/${name}`;
    const toPath = `${noNuevo}/${name}`;
    const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(fromPath);
    if (dlErr || !blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: upErr } = await admin.storage.from(bucket).upload(toPath, buf, {
      contentType: blob.type || "application/octet-stream",
      upsert: true,
    });
    if (!upErr) {
      await admin.storage.from(bucket).remove([fromPath]);
    }
  }
}

async function renumerarCategorizacion(
  admin: SupabaseClient,
  noActual: string,
  noNuevo: string,
): Promise<string | null> {
  const { data: personal, error: selErr } = await admin
    .from("cat_personal")
    .select("*")
    .eq("no_empleado", noActual)
    .maybeSingle();
  if (selErr) return selErr.message;
  if (!personal) return null;

  const { error: insErr } = await admin.from("cat_personal").insert({
    ...personal,
    no_empleado: noNuevo,
    updated_at: new Date().toISOString(),
  });
  if (insErr) return insErr.message;

  const { error: evErr } = await admin.from("cat_evaluacion").update({ no_empleado: noNuevo }).eq("no_empleado", noActual);
  if (evErr) return evErr.message;

  const { error: capErr } = await admin
    .from("cat_capacitacion_registro")
    .update({ no_empleado: noNuevo })
    .eq("no_empleado", noActual);
  if (capErr) return capErr.message;

  const { error: delErr } = await admin.from("cat_personal").delete().eq("no_empleado", noActual);
  if (delErr) return delErr.message;

  return null;
}

/** Renumerar un expediente y tablas relacionadas. */
export async function renumerarColaboradorEnSupabase(
  admin: SupabaseClient,
  expediente: ColaboradorCompleto,
  noNuevo: string,
): Promise<void> {
  const noActual = normalizeNoEmpleado(expediente.noEmpleado);
  const nuevo = normalizeNoEmpleado(noNuevo);
  if (noActual === nuevo) return;

  const actualizado = colaboradorConNuevoNo(expediente, nuevo);
  const now = new Date().toISOString();

  const { error: insErr } = await admin.from("colaboradores").insert({
    no_empleado: nuevo,
    data: actualizado as unknown as Record<string, unknown>,
    updated_at: now,
  });
  if (insErr) throw new Error(insErr.message);

  const { error: moperErr } = await admin.from("moper_historial").update({ no_empleado: nuevo }).eq("no_empleado", noActual);
  if (moperErr) {
    await admin.from("colaboradores").delete().eq("no_empleado", nuevo);
    throw new Error(moperErr.message);
  }

  const catErr = await renumerarCategorizacion(admin, noActual, nuevo);
  if (catErr) {
    await admin.from("moper_historial").update({ no_empleado: noActual }).eq("no_empleado", nuevo);
    await admin.from("colaboradores").delete().eq("no_empleado", nuevo);
    throw new Error(catErr);
  }

  try {
    await moverPrefijoStorage(admin, FOTOS_BUCKET, noActual, nuevo);
    await moverPrefijoStorage(admin, EXPEDIENTE_LEGAL_BUCKET, noActual, nuevo);
  } catch {
    /* archivos opcionales; el expediente ya quedo con URL actualizada si aplica */
  }

  const { error: delErr } = await admin.from("colaboradores").delete().eq("no_empleado", noActual);
  if (delErr) {
    throw new Error(delErr.message);
  }
}

export async function ejecutarRenumeracionCsv(
  admin: SupabaseClient,
  csvText: string,
  dbRows: { data: unknown }[],
): Promise<RenumeracionRunResult> {
  const byNo = mapaColaboradoresPorNo(dbRows);
  const plan = planificarRenumeracionCsv(csvText, byNo);
  if (!plan.ok) return plan;

  let renumerados = 0;
  const avisos: string[] = [];

  for (const { noActual, noNuevo } of plan.pairs) {
    const exp = byNo.get(noActual);
    if (!exp) {
      avisos.push(`${noActual}: SIN EXPEDIENTE (OMITIDO)`);
      continue;
    }
    if (byNo.has(noNuevo) && noNuevo !== noActual) {
      avisos.push(`${noActual} → ${noNuevo}: DESTINO OCUPADO (OMITIDO)`);
      continue;
    }
    try {
      await renumerarColaboradorEnSupabase(admin, exp, noNuevo);
      byNo.delete(noActual);
      byNo.set(noNuevo, colaboradorConNuevoNo(exp, noNuevo));
      renumerados++;
    } catch (err) {
      avisos.push(`${noActual} → ${noNuevo}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { ok: true, renumerados, avisos };
}
