/**
 * Importación masiva CSV (5 partes en un solo archivo) por lotes en servidor.
 * Evita una petición HTTP por fila (como el import de Altas).
 */
import { familiaresDesdeFilaAncha, parseWideFamiliaresLayout } from "@/lib/altas-familiares-csv-ancho";
import type { AltasCsvImportResult } from "@/lib/altas-csv-import";
import { mergeMoperEnImportColaboradorCsv } from "@/lib/colaboradores-import-moper-merge";
import { parseCsvContent } from "@/lib/csv";
import { buildHeaderFieldIndex, rowToFieldMap, type CsvFieldKey } from "@/lib/empleado-csv-map";
import type { ColaboradorCompleto, FamiliarGuardado } from "@/lib/colaboradores-types";
import {
  ALTAS_IMPORT_OMITE_SERVICIO_POSICION,
  formRecordSinServicioPosicionImport,
  omitServicioPosicionEnImportPick,
} from "@/lib/altas-import-omision-servicio";
import { colaboradorCompletoMayusculas } from "@/lib/texto-plataforma-mayusculas";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hintSupabaseClientError } from "@/lib/supabase/admin";

export const COLABORADORES_CSV_MASIVO_CHUNK_DEFAULT = 500;
export const COLABORADORES_CSV_MASIVO_CHUNK_MAX = 2000;
export const COLABORADORES_CSV_MASIVO_FILAS_MAX = 2000;

function normalizeNo(no: string | undefined | null): string {
  return String(no ?? "").trim().toUpperCase();
}

function g(m: Partial<Record<CsvFieldKey, string>>, k: CsvFieldKey): string {
  return (m[k] ?? "").trim();
}

function pickStr(csv: string | undefined | null, prev?: string | null): string {
  const t = String(csv ?? "").trim();
  if (t) return t;
  return String(prev ?? "").trim();
}

function beneficiarioNorm(s: string): "SI" | "NO" {
  const u = s.trim().toUpperCase();
  if (u === "SI" || u === "SÍ" || u === "1" || u === "TRUE") return "SI";
  return "NO";
}

function buildFormColumnIndex(headerRow: string[]): Map<number, string> {
  const m = new Map<number, string>();
  headerRow.forEach((raw, idx) => {
    const t = String(raw ?? "").trim();
    if (/^FORM_/i.test(t)) {
      m.set(idx, t.replace(/^FORM_/i, "").trim());
    }
  });
  return m;
}

function collectFormCells(cells: string[], formIx: Map<number, string>): Record<string, string> {
  const out: Record<string, string> = {};
  formIx.forEach((key, colIdx) => {
    const v = (cells[colIdx] ?? "").trim();
    if (v) out[key] = v;
  });
  return out;
}

function mergeFormPreserve(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (String(v ?? "").trim() !== "") out[k] = v;
  }
  return out;
}

function mergeAltasForm(
  fieldMap: Partial<Record<CsvFieldKey, string>>,
  formExtras: Record<string, string>,
): Record<string, string> {
  const f: Record<string, string> = {};
  const set = (k: string, v: string) => {
    f[k] = v;
  };
  set("fechaIngreso", g(fieldMap, "fechaIngreso"));
  set("fechaBaja", g(fieldMap, "fechaBaja"));
  set("envio", g(fieldMap, "envio"));
  set("reyna", g(fieldMap, "reyna"));
  set("reingreso", g(fieldMap, "reingreso"));
  set("nombreCompleto", g(fieldMap, "nombreCompleto"));
  set("puesto", g(fieldMap, "puesto"));
  if (!ALTAS_IMPORT_OMITE_SERVICIO_POSICION) {
    set("servicio", g(fieldMap, "servicio"));
    set("noServicio", g(fieldMap, "noServicio"));
    set("posicion", g(fieldMap, "posicion"));
  }
  set("planta", g(fieldMap, "planta"));
  set("localForaneo", g(fieldMap, "localForaneo"));
  set("numeroFolio", g(fieldMap, "numeroFolio"));
  set("creditoInfonavit", g(fieldMap, "creditoInfonavit"));
  set("noIfe", g(fieldMap, "noIfe"));
  set("licenciaConducir", g(fieldMap, "licenciaConducir"));
  set("cartaNoAntecedentes", g(fieldMap, "cartaNoAntecedentes"));
  set("idiomas", g(fieldMap, "idiomas"));
  set("apellidoPaterno", g(fieldMap, "apellidoPaterno"));
  set("apellidoMaterno", g(fieldMap, "apellidoMaterno"));
  set("nombres", g(fieldMap, "nombres"));
  set("fechaNacimiento", g(fieldMap, "fechaNacimiento"));
  set("edad", g(fieldMap, "edad"));
  set("estadoCivil", g(fieldMap, "estadoCivil"));
  set("curp", g(fieldMap, "curp"));
  set("rfc", g(fieldMap, "rfc"));
  set("imss", g(fieldMap, "imss"));
  set("codigoPostal", g(fieldMap, "codigoPostal"));
  set("estadoNatal", g(fieldMap, "estadoNatal"));
  const dom = g(fieldMap, "domicilio");
  if (dom) set("direccionCompleta", dom);
  const tpc = g(fieldMap, "telefonoPersonalCasa");
  if (tpc) set("telefonoPersonalCasa", tpc);
  else {
    const merged = [g(fieldMap, "telefono"), g(fieldMap, "telefonoCasa")].filter(Boolean).join(" / ");
    if (merged) set("telefonoPersonalCasa", merged);
  }
  set("escolaridad", g(fieldMap, "escolaridad"));
  set("estaturaPeso", g(fieldMap, "estaturaPeso"));
  set("tipoSangre", g(fieldMap, "tipoSangre"));
  set("alergicoA", g(fieldMap, "alergicoA"));
  set("enfermedadTratamiento", g(fieldMap, "enfermedadTratamiento"));
  set("diabetico", g(fieldMap, "diabetico") || "NO");
  set("hipertenso", g(fieldMap, "hipertenso") || "NO");
  set("emergenciaLlamarA", g(fieldMap, "emergenciaNombre"));
  set("telefonoEmergencia", g(fieldMap, "emergenciaTelefono"));
  set("banco", g(fieldMap, "banco"));
  set("numeroCuenta", g(fieldMap, "numeroCuenta"));
  set("clabeInterbancaria", g(fieldMap, "clabeInterbancaria"));
  set("noTarjeta", g(fieldMap, "noTarjeta"));
  set("sueldoMensual", g(fieldMap, "sueldoMensual"));
  set("fuenteReclutamiento", g(fieldMap, "fuenteReclutamiento"));
  set("gestorProceso", g(fieldMap, "gestorProceso"));
  set("estudioSocioeconomico", g(fieldMap, "estudioSocioeconomico"));
  set("documentacionOriginal", g(fieldMap, "documentacionOriginal"));
  if (g(fieldMap, "estatusEmpleado")) set("estatusEmpleado", g(fieldMap, "estatusEmpleado"));
  if (g(fieldMap, "puestoFinal")) set("puestoFinal", g(fieldMap, "puestoFinal"));
  if (!ALTAS_IMPORT_OMITE_SERVICIO_POSICION && g(fieldMap, "servicioFinal")) {
    set("servicioFinal", g(fieldMap, "servicioFinal"));
  }
  for (const mk of ["moper1", "moper2", "moper3", "moper4", "moper5", "moper6", "moper7"] as const) {
    if (g(fieldMap, mk)) set(mk, g(fieldMap, mk));
  }
  if (g(fieldMap, "ultimoServicio")) set("ultimoServicio", g(fieldMap, "ultimoServicio"));
  if (g(fieldMap, "registradoAt")) set("registeredAt", g(fieldMap, "registradoAt"));
  for (const [k, v] of Object.entries(formExtras)) {
    f[k] = v;
  }
  return f;
}

function nombreCompletoFrom(fieldMap: Partial<Record<CsvFieldKey, string>>, form: Record<string, string>): string {
  let n = g(fieldMap, "nombreCompleto") || form.nombreCompleto?.trim() || "";
  if (!n) {
    n = [form.nombres, form.apellidoPaterno, form.apellidoMaterno].filter(Boolean).join(" ").trim();
  }
  return n;
}

function buildFamiliaresClasico(m: Partial<Record<CsvFieldKey, string>>): FamiliarGuardado[] {
  if (!g(m, "nombreFamiliar") && !g(m, "parentescoCsv") && !g(m, "fechaNacimientoFamiliar")) {
    return [];
  }
  return [
    {
      nombreFamiliar: g(m, "nombreFamiliar"),
      parentesco: g(m, "parentescoCsv"),
      fechaNacimiento: g(m, "fechaNacimientoFamiliar"),
      beneficiarioBancario: beneficiarioNorm(g(m, "beneficiarioBancario")),
    },
  ];
}

export type ColaboradoresCsvMasivoOptions = {
  preserveMoper?: boolean;
  /** Si true, mezcla cada fila con el expediente ya guardado (requiere mapa previo). */
  mergeExisting?: boolean;
  chunkSize?: number;
  existingByNo?: Map<string, ColaboradorCompleto>;
};

export type ColaboradoresCsvMasivoResult = AltasCsvImportResult & {
  lotes: number;
  filasProcesadas: number;
};

/** Parsea CSV a payloads sin persistir (para pruebas o lotes en servidor). */
export function parseColaboradoresCsvMasivo(
  text: string,
  options?: ColaboradoresCsvMasivoOptions,
): { payloads: ColaboradorCompleto[]; skippedEmpty: number; errors: Array<{ row: number; message: string }> } {
  const preserveMoper = options?.preserveMoper !== false;
  const mergeExisting = options?.mergeExisting === true;
  const existingByNo = options?.existingByNo ?? new Map();

  const stripped = text.replace(/^\uFEFF/, "");
  const rows = parseCsvContent(stripped);
  if (rows.length < 2) {
    return {
      payloads: [],
      skippedEmpty: 0,
      errors: [{ row: 1, message: "EL ARCHIVO NO TIENE FILAS DE DATOS (MINIMO: ENCABEZADOS + 1 FILA)." }],
    };
  }

  if (rows.length - 1 > COLABORADORES_CSV_MASIVO_FILAS_MAX) {
    return {
      payloads: [],
      skippedEmpty: 0,
      errors: [
        {
          row: 0,
          message: `MAXIMO ${COLABORADORES_CSV_MASIVO_FILAS_MAX} FILAS POR ARCHIVO. DIVIDE EL CSV O IMPORTA EN DOS TANDAS.`,
        },
      ],
    };
  }

  const headerRow = rows[0]!.map((c) => String(c ?? "").trim());
  const fieldIndex = buildHeaderFieldIndex(headerRow);
  const formColIx = buildFormColumnIndex(headerRow);
  const layoutFamiliaresAncho = parseWideFamiliaresLayout(headerRow);

  const payloads: ColaboradorCompleto[] = [];
  let skippedEmpty = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => String(c ?? "").trim() !== "")) {
      skippedEmpty++;
      continue;
    }

    const fieldMap = omitServicioPosicionEnImportPick(rowToFieldMap(cells, fieldIndex));
    const formExtras = formRecordSinServicioPosicionImport(collectFormCells(cells, formColIx));
    const ultimoServicioExplicitDesdeFila =
      g(fieldMap, "ultimoServicio").trim() || (formExtras.ultimoServicio ?? "").trim();

    const noRaw =
      g(fieldMap, "noEmpleado").trim() || formExtras.noEmpleado1?.trim() || formExtras.NO_EMPLEADO1?.trim() || "";
    const no = normalizeNo(noRaw);
    const rowLabel = r + 1;

    if (!no) {
      errors.push({ row: rowLabel, message: "SIN N° DE EMPLEADO." });
      continue;
    }

    const existing = mergeExisting ? (existingByNo.get(no) ?? null) : null;
    let formPartial = mergeAltasForm(fieldMap, formExtras);
    formPartial = mergeFormPreserve(existing?.form ?? {}, formPartial);
    formPartial.noEmpleado1 = no;

    const nombreCompleto = nombreCompletoFrom(fieldMap, formPartial);
    const nombreFinal = pickStr(nombreCompleto, existing?.nombreCompleto ?? "");
    if (!nombreFinal) {
      errors.push({ row: rowLabel, message: "SIN NOMBRE (NOMBRE_COMPLETO O NOMBRES+APELLIDOS)." });
      continue;
    }

    const servicioCsv = ALTAS_IMPORT_OMITE_SERVICIO_POSICION
      ? String(existing?.servicioAsignado ?? "").trim()
      : pickStr(formPartial.servicio, existing?.servicioAsignado ?? "");
    const puestoCsv = pickStr(formPartial.puesto, existing?.puesto ?? "");
    const mergedMoper = mergeMoperEnImportColaboradorCsv({
      preserveMoper,
      existing,
      csvUltimoServicioExplicit: ultimoServicioExplicitDesdeFila,
      servicioCsv,
      puestoCsv,
    });

    const registradoRaw = (g(fieldMap, "registradoAt") || formPartial.registeredAt || "").trim();
    const registeredAt = registradoRaw || existing?.registeredAt || new Date().toISOString();

    const famAnchos = layoutFamiliaresAncho ? familiaresDesdeFilaAncha(cells, layoutFamiliaresAncho) : [];
    const famClasico = buildFamiliaresClasico(fieldMap);
    const familiares = layoutFamiliaresAncho
      ? famAnchos.length > 0
        ? famAnchos
        : (existing?.familiares ?? [])
      : famClasico.length > 0
        ? famClasico
        : (existing?.familiares ?? []);

    let formOut = formPartial;
    if (ALTAS_IMPORT_OMITE_SERVICIO_POSICION) {
      formOut = formRecordSinServicioPosicionImport(formPartial);
    }

    payloads.push(
      colaboradorCompletoMayusculas({
        noEmpleado: no,
        nombreCompleto: nombreFinal,
        fechaIngreso: pickStr(formPartial.fechaIngreso, existing?.fechaIngreso ?? ""),
        servicioAsignado: servicioCsv,
        ultimoServicio: mergedMoper.ultimoServicio,
        nss: pickStr(formPartial.imss, existing?.nss ?? ""),
        posicion: ALTAS_IMPORT_OMITE_SERVICIO_POSICION
          ? String(existing?.posicion ?? "").trim()
          : pickStr(formPartial.posicion, existing?.posicion ?? ""),
        puesto: puestoCsv,
        moperActual: mergedMoper.moperActual,
        registeredAt,
        form: formOut,
        familiares,
      }),
    );
  }

  return { payloads, skippedEmpty, errors };
}

async function persistChunks(
  admin: SupabaseClient,
  items: ColaboradorCompleto[],
  chunkSize: number,
): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const rows = chunk.map((p) => ({
      no_empleado: p.noEmpleado,
      data: p as unknown as Record<string, unknown>,
      updated_at: now,
    }));
    const { error } = await admin.from("colaboradores").upsert(rows, { onConflict: "no_empleado" });
    if (error) throw new Error(hintSupabaseClientError(error.message));
  }
}

/** Importación en servidor: parsea y guarda por lotes. */
export async function importColaboradoresCsvMasivoEnServidor(
  admin: SupabaseClient,
  csvText: string,
  options?: ColaboradoresCsvMasivoOptions,
): Promise<ColaboradoresCsvMasivoResult> {
  const chunkSize = Math.min(
    COLABORADORES_CSV_MASIVO_CHUNK_MAX,
    Math.max(50, options?.chunkSize ?? COLABORADORES_CSV_MASIVO_CHUNK_DEFAULT),
  );

  let existingByNo = options?.existingByNo;
  if (options?.mergeExisting && !existingByNo) {
    const { data, error } = await admin.from("colaboradores").select("no_empleado, data");
    if (error) throw new Error(hintSupabaseClientError(error.message));
    existingByNo = new Map();
    for (const row of data ?? []) {
      const no = String((row as { no_empleado: string }).no_empleado ?? "").trim().toUpperCase();
      const raw = (row as { data: ColaboradorCompleto }).data;
      if (no && raw) existingByNo.set(no, raw);
    }
  }

  const parsed = parseColaboradoresCsvMasivo(csvText, {
    ...options,
    existingByNo: existingByNo ?? new Map(),
  });

  if (parsed.errors.some((e) => e.row === 0)) {
    return {
      imported: 0,
      skippedEmpty: parsed.skippedEmpty,
      errors: parsed.errors,
      lotes: 0,
      filasProcesadas: 0,
    };
  }

  const lotes = parsed.payloads.length > 0 ? Math.ceil(parsed.payloads.length / chunkSize) : 0;
  if (parsed.payloads.length > 0) {
    await persistChunks(admin, parsed.payloads, chunkSize);
  }

  return {
    imported: parsed.payloads.length,
    skippedEmpty: parsed.skippedEmpty,
    errors: parsed.errors,
    lotes,
    filasProcesadas: parsed.payloads.length + parsed.skippedEmpty + parsed.errors.length,
  };
}
