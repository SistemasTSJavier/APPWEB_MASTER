import { NextResponse } from "next/server";
import {
  normNombreServicioCatalogo,
  normPlantaCatalogo,
  parseServiciosCatalogoCsvDosColumnas,
  type ServicioImportCatalogoRow,
} from "@/lib/servicios-catalogo-import-dos-columnas";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayImportServiciosCatalogoDosColumnasAdmin } from "@/lib/app-role";

export const dynamic = "force-dynamic";

const MAX_BYTES = 512_000;
const MAX_ROWS = 5000;

function normNumero(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw).trim();
  return t ? t : null;
}

function error503(message: string, hint?: object) {
  return NextResponse.json({ error: message, ...hint }, { status: 503 });
}

type CatRow = {
  id: string;
  nombre: string;
  numero_servicio: string | null;
  planta: string | null;
};

/** Fila tal como viene del SELECT (algunas columnas pueden faltar según migración). */
type CatalogoQueryRow = {
  id: string;
  nombre: string;
  numero_servicio?: string | null;
  planta?: string | null;
};

function catRowFromDb(r: CatalogoQueryRow, tieneNumeroCol: boolean, tienePlantaCol: boolean): CatRow {
  return {
    id: r.id,
    nombre: r.nombre,
    numero_servicio: tieneNumeroCol ? (r.numero_servicio ?? null) : null,
    planta: tienePlantaCol ? normPlantaCatalogo(r.planta ?? undefined) : null,
  };
}

/** POST multipart: campo `file` (text/csv o .csv). Solo admin. */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayImportServiciosCatalogoDosColumnasAdmin(auth.role)) {
    return NextResponse.json({ error: "Solo administradores pueden importar este CSV." }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return error503("Supabase no configurado", { missingEnv: supabaseServerEnvMissing() });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return error503("Cliente no disponible");
  const db = admin;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "USE multipart/form-data CON CAMPO file" }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "FALTA file EN EL FORMULARIO" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `ARCHIVO DEMASIADO GRANDE (MAX ${MAX_BYTES} BYTES)` }, { status: 400 });
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return NextResponse.json({ error: "NO SE PUDO LEER EL ARCHIVO" }, { status: 400 });
  }

  const filas = parseServiciosCatalogoCsvDosColumnas(text);
  if (filas.length > MAX_ROWS) {
    return NextResponse.json({ error: `DEMASIADAS FILAS (MAX ${MAX_ROWS})` }, { status: 400 });
  }

  let tieneNumeroCol = true;
  let tienePlantaCol = true;

  let errCat: { message: string } | null = null;
  let catalogoRaw: CatalogoQueryRow[] | null = null;

  const selFull = await db.from("catalogo_servicios").select("id, nombre, numero_servicio, planta").order("nombre", {
    ascending: true,
  });

  if (!selFull.error) {
    catalogoRaw = (selFull.data ?? []) as CatalogoQueryRow[];
  } else {
    const msg = selFull.error.message;
    if (/column[^\n]*numero_servicio[^\n]*does not exist/i.test(msg)) {
      tieneNumeroCol = false;
      const selNp = await db.from("catalogo_servicios").select("id, nombre, planta").order("nombre", { ascending: true });
      if (!selNp.error) {
        catalogoRaw = (selNp.data ?? []) as CatalogoQueryRow[];
      } else if (/column[^\n]*planta[^\n]*does not exist/i.test(selNp.error.message)) {
        tienePlantaCol = false;
        const selN = await db.from("catalogo_servicios").select("id, nombre").order("nombre", { ascending: true });
        catalogoRaw = (selN.data ?? []) as CatalogoQueryRow[];
        errCat = selN.error;
      } else {
        errCat = selNp.error;
      }
    } else if (/column[^\n]*planta[^\n]*does not exist/i.test(msg)) {
      tienePlantaCol = false;
      const selPn = await db.from("catalogo_servicios").select("id, nombre, numero_servicio").order("nombre", { ascending: true });
      if (!selPn.error) {
        catalogoRaw = (selPn.data ?? []) as CatalogoQueryRow[];
      } else if (/column[^\n]*numero_servicio[^\n]*does not exist/i.test(selPn.error.message)) {
        tieneNumeroCol = false;
        const selP = await db.from("catalogo_servicios").select("id, nombre").order("nombre", { ascending: true });
        catalogoRaw = (selP.data ?? []) as CatalogoQueryRow[];
        errCat = selP.error;
      } else {
        errCat = selPn.error;
      }
    } else {
      errCat = selFull.error;
    }
  }

  if (errCat) {
    if (/relation ["']public.catalogo_servicios["'] does not exist/i.test(errCat.message)) {
      return NextResponse.json(
        { error: "Tabla catalogo_servicios no existe", hint: "Ejecuta la migracion 004 en Supabase." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: hintSupabaseClientError(errCat.message) }, { status: 500 });
  }

  const catalogo: CatRow[] = (catalogoRaw ?? []).map((r) => catRowFromDb(r, tieneNumeroCol, tienePlantaCol));

  const byNombre = new Map<string, CatRow>();
  for (const r of catalogo) {
    byNombre.set(normNombreServicioCatalogo(r.nombre), r);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let skippedNumeroSinColumnaEnBd = 0;
  let skippedPlantaSinColumnaEnBd = 0;
  const errors: { line: number; message: string }[] = [];
  const lineBase = 2;

  function selectColsFetch(): string {
    if (tieneNumeroCol && tienePlantaCol) return "id, nombre, numero_servicio, planta";
    if (tieneNumeroCol) return "id, nombre, numero_servicio";
    if (tienePlantaCol) return "id, nombre, planta";
    return "id, nombre";
  }

  async function ensureInMap(nombreNorm: string): Promise<CatRow | null> {
    let row = byNombre.get(nombreNorm);
    if (row) return row;
    const res = await db.from("catalogo_servicios").select(selectColsFetch()).eq("nombre", nombreNorm).maybeSingle();
    const { data: found, error: ef } = res;
    if (ef || !found) return null;
    const c = catRowFromDb(found as unknown as CatalogoQueryRow, tieneNumeroCol, tienePlantaCol);
    byNombre.set(nombreNorm, c);
    return c;
  }

  function buildPatch(existing: CatRow, row: ServicioImportCatalogoRow): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {};

    if (row.numeroTexto !== undefined) {
      if (tieneNumeroCol) {
        const nuevoNum = normNumero(row.numeroTexto);
        if (normNumero(existing.numero_servicio ?? undefined) !== nuevoNum) {
          patch.numero_servicio = nuevoNum;
        }
      } else {
        skippedNumeroSinColumnaEnBd++;
      }
    }

    if (row.plantaTexto !== undefined) {
      if (tienePlantaCol) {
        const np = normPlantaCatalogo(row.plantaTexto);
        if (normPlantaCatalogo(existing.planta ?? undefined) !== np) {
          patch.planta = np;
        }
      } else {
        skippedPlantaSinColumnaEnBd++;
      }
    }

    if (Object.keys(patch).length === 0) return null;

    patch.updated_at = new Date().toISOString();
    return patch;
  }

  async function applyPatch(existing: CatRow, patch: Record<string, unknown>, line: number): Promise<boolean> {
    const { error: eUp } = await db.from("catalogo_servicios").update(patch).eq("id", existing.id);
    if (eUp) {
      errors.push({ line, message: hintSupabaseClientError(eUp.message) });
      return false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "numero_servicio")) {
      existing.numero_servicio = patch.numero_servicio as string | null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "planta")) {
      existing.planta = patch.planta as string | null;
    }
    return true;
  }

  for (let idx = 0; idx < filas.length; idx++) {
    const row = filas[idx]!;
    const nombre = row.nombre;
    const line = lineBase + idx;

    const existing = byNombre.get(nombre);

    if (existing) {
      if (row.numeroTexto === undefined && row.plantaTexto === undefined) {
        skipped++;
        continue;
      }

      const patch = buildPatch(existing, row);
      if (!patch) {
        skipped++;
        continue;
      }

      if ((await applyPatch(existing, patch, line)) === false) {
        if (errors.length >= 40) break;
        continue;
      }
      updated++;
      continue;
    }

    const insertRow: Record<string, unknown> = {
      nombre,
      updated_at: new Date().toISOString(),
    };
    if (tieneNumeroCol) {
      insertRow.numero_servicio = row.numeroTexto === undefined ? null : normNumero(row.numeroTexto);
    }
    if (tienePlantaCol) {
      insertRow.planta = row.plantaTexto === undefined ? null : normPlantaCatalogo(row.plantaTexto);
    }

    const selIns = selectColsFetch();
    const insRes = await db.from("catalogo_servicios").insert(insertRow).select(selIns).single();
    const { data: ins, error: eIns } = insRes;

    if (!eIns && ins) {
      const added = catRowFromDb(ins as unknown as CatalogoQueryRow, tieneNumeroCol, tienePlantaCol);
      byNombre.set(normNombreServicioCatalogo(added.nombre), added);
      inserted++;
      continue;
    }

    if (eIns && /duplicate key|unique constraint/i.test(eIns.message)) {
      const again = await ensureInMap(nombre);
      if (again && (row.numeroTexto !== undefined || row.plantaTexto !== undefined)) {
        const patch = buildPatch(again, row);
        if (!patch) {
          skipped++;
          continue;
        }
        if ((await applyPatch(again, patch, line)) === false) {
          if (errors.length >= 40) break;
          continue;
        }
        updated++;
        continue;
      }
      if (again) {
        skipped++;
        continue;
      }
      errors.push({ line, message: "NOMBRE DUPLICADO EN CATALOGO (NO SE PUDO ACTUALIZAR)." });
    } else if (eIns) {
      errors.push({ line, message: hintSupabaseClientError(eIns.message) });
    }
    if (errors.length >= 40) break;
  }

  const hint008 =
    !tieneNumeroCol && skippedNumeroSinColumnaEnBd > 0
      ? `La base de datos no tiene la columna numero_servicio. Se omitieron ${skippedNumeroSinColumnaEnBd} intento(s) de actualizar N.º. Ejecuta web/supabase/migrations/008_catalogo_servicios_numero.sql en Supabase.`
      : !tieneNumeroCol
        ? "La columna numero_servicio no existe; ejecuta web/supabase/migrations/008_catalogo_servicios_numero.sql."
        : undefined;

  const hint010 =
    !tienePlantaCol && skippedPlantaSinColumnaEnBd > 0
      ? `La base de datos no tiene la columna planta. Se omitieron ${skippedPlantaSinColumnaEnBd} intento(s) de actualizar planta. Ejecuta web/supabase/migrations/010_catalogo_servicios_planta.sql en Supabase.`
      : !tienePlantaCol
        ? "La columna planta no existe; ejecuta web/supabase/migrations/010_catalogo_servicios_planta.sql para importar planta desde CSV."
        : undefined;

  return NextResponse.json({
    inserted,
    updated,
    skipped,
    skippedNumeroSinColumnaEnBd: skippedNumeroSinColumnaEnBd > 0 ? skippedNumeroSinColumnaEnBd : undefined,
    skippedPlantaSinColumnaEnBd: skippedPlantaSinColumnaEnBd > 0 ? skippedPlantaSinColumnaEnBd : undefined,
    totalInput: filas.length,
    errors,
    hint008,
    hint010,
  });
}
