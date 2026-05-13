import { familiaresDesdeFilaAncha, parseWideFamiliaresLayout } from "@/lib/altas-familiares-csv-ancho";
import { mergeMoperEnImportColaboradorCsv } from "@/lib/colaboradores-import-moper-merge";
import { parseCsvContent } from "@/lib/csv";
import { buildHeaderFieldIndex, rowToFieldMap, type CsvFieldKey } from "@/lib/empleado-csv-map";
import type { ColaboradorCompleto, FamiliarGuardado } from "@/lib/colaboradores-types";
import { findColaboradorCompletoByNo, upsertColaboradorCompleto } from "@/lib/colaboradores-data";

function normalizeNo(no: string): string {
  return no.trim().toUpperCase();
}

function g(m: Partial<Record<CsvFieldKey, string>>, k: CsvFieldKey): string {
  return (m[k] ?? "").trim();
}

function beneficiarioNorm(s: string): string {
  const u = s.trim().toUpperCase();
  if (u === "SI" || u === "SÍ" || u === "1" || u === "TRUE") return "SI";
  return "NO";
}

function buildTelefonoPersonal(m: Partial<Record<CsvFieldKey, string>>): string {
  const tpc = g(m, "telefonoPersonalCasa");
  if (tpc) return tpc;
  const t1 = g(m, "telefono");
  const t2 = g(m, "telefonoCasa");
  return [t1, t2].filter(Boolean).join(" / ");
}

function mergeFormPreserve(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (String(v ?? "").trim() !== "") out[k] = v;
  }
  return out;
}

function pickStr(csv: string | undefined | null, prev?: string | null): string {
  const t = String(csv ?? "").trim();
  if (t) return t;
  return String(prev ?? "").trim();
}

/** Columnas FORM_* del export de COLABORADORES → claves del formulario ALTAS. */
function buildFormColumnIndex(headerRow: string[]): Map<number, string> {
  const m = new Map<number, string>();
  headerRow.forEach((raw, idx) => {
    const t = String(raw ?? "").trim();
    if (/^FORM_/i.test(t)) {
      m.set(idx, t.replace(/^FORM_/i, "").trim()); // FORM_apellidoPaterno → apellidoPaterno
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

function mergeAltasForm(fieldMap: Partial<Record<CsvFieldKey, string>>, formExtras: Record<string, string>): Record<string, string> {
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
  set("servicio", g(fieldMap, "servicio"));
  set("posicion", g(fieldMap, "posicion"));
  set("localForaneo", g(fieldMap, "localForaneo") || "LOCAL");
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
  set("direccionCompleta", g(fieldMap, "domicilio"));
  set("telefonoPersonalCasa", buildTelefonoPersonal(fieldMap));
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
  if (g(fieldMap, "servicioFinal")) set("servicioFinal", g(fieldMap, "servicioFinal"));

  const moperKeys = ["moper1", "moper2", "moper3", "moper4", "moper5", "moper6", "moper7"] as const;
  for (const mk of moperKeys) {
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
    n = [g(fieldMap, "nombres") || form.nombres, g(fieldMap, "apellidoPaterno") || form.apellidoPaterno, g(fieldMap, "apellidoMaterno") || form.apellidoMaterno]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return n;
}

function buildFamiliares(m: Partial<Record<CsvFieldKey, string>>): FamiliarGuardado[] {
  if (!g(m, "nombreFamiliar") && !g(m, "parentescoCsv") && !g(m, "fechaNacimientoFamiliar") && !g(m, "beneficiarioBancario")) {
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

export type AltasCsvImportResult = {
  imported: number;
  /** Solo filas en blanco. */
  skippedEmpty: number;
  errors: Array<{ row: number; message: string }>;
};

export type AltasCsvImportOptions = {
  /**
   * Si true (defecto), no se rebasa `moperActual` con columnas SERVICIO/PUESTO de alta al reimportar.
   * Solo se actualiza la línea operativa si la fila trae ULTIMO_SERVICIO con texto (sync explícita).
   */
  preserveMoper?: boolean;
  /** Si false, solo cuenta filas sin persistir en API (prueba seca). */
  apply?: boolean;
};

export async function importColaboradoresDesdeCsv(
  text: string,
  options?: AltasCsvImportOptions,
): Promise<AltasCsvImportResult> {
  const preserveMoper = options?.preserveMoper !== false;
  const apply = options?.apply !== false;

  const stripped = text.replace(/^\uFEFF/, "");
  const rows = parseCsvContent(stripped);
  if (rows.length < 2) {
    return {
      imported: 0,
      skippedEmpty: 0,
      errors: [{ row: 1, message: "EL ARCHIVO NO TIENE FILAS DE DATOS (MINIMO: ENCABEZADOS + 1 FILA)." }],
    };
  }

  const headerRow = rows[0]!.map((c) => String(c ?? "").trim());
  const fieldIndex = buildHeaderFieldIndex(headerRow);
  const formColIx = buildFormColumnIndex(headerRow);
  const layoutFamiliaresAncho = parseWideFamiliaresLayout(headerRow);

  let imported = 0;
  let skippedEmpty = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => String(c ?? "").trim() !== "")) {
      skippedEmpty++;
      continue;
    }

    const fieldMap = rowToFieldMap(cells, fieldIndex);
    const formExtras = collectFormCells(cells, formColIx);
    /** Solo celdas de esta fila; no usar valor fusionado del expediente guardado (evita falsos positivos). */
    const ultimoServicioExplicitDesdeFila =
      g(fieldMap, "ultimoServicio").trim() || (formExtras.ultimoServicio ?? "").trim();

    const noRaw =
      g(fieldMap, "noEmpleado").trim() || formExtras.noEmpleado1?.trim() || formExtras.NO_EMPLEADO1?.trim() || "";

    const no = normalizeNo(noRaw);
    const rowLabel = r + 1;

    if (!no) {
      errors.push({ row: rowLabel, message: "SIN N° DE EMPLEADO (COLUMNA NO_EMPLEADO / CLAVE)." });
      continue;
    }

    const existing = await findColaboradorCompletoByNo(no);
    let formPartial = mergeAltasForm(fieldMap, formExtras);
    formPartial = mergeFormPreserve(existing?.form ?? {}, formPartial);
    formPartial.noEmpleado1 = no;

    const nombreCompleto = nombreCompletoFrom(fieldMap, formPartial);
    const nombreFinal = pickStr(nombreCompleto, existing?.nombreCompleto);
    if (!nombreFinal.trim()) {
      errors.push({
        row: rowLabel,
        message: "SIN NOMBRE COMPLETO (COLUMNAS NOMBRE_COMPLETO O NOMBRES+APELLIDOS, O YA DEBE EXISTIR EN SISTEMA).",
      });
      continue;
    }

    const servicioCsv = pickStr(formPartial.servicio, existing?.servicioAsignado);
    const puestoCsv = pickStr(formPartial.puesto, existing?.puesto);
    const csvUltimoCombinado = (g(fieldMap, "ultimoServicio") || formPartial.ultimoServicio || "").trim();

    const mergedMoper = mergeMoperEnImportColaboradorCsv({
      preserveMoper,
      existing,
      csvUltimoServicioExplicit: ultimoServicioExplicitDesdeFila,
      servicioCsv,
      puestoCsv,
    });
    const moperActual = mergedMoper.moperActual;
    const ultimoServicio = !preserveMoper ? csvUltimoCombinado : mergedMoper.ultimoServicio;

    const registradoRaw = (g(fieldMap, "registradoAt") || formPartial.registeredAt || "").trim();
    const registeredAt = registradoRaw || existing?.registeredAt || new Date().toISOString();

    const famAnchos = layoutFamiliaresAncho ? familiaresDesdeFilaAncha(cells, layoutFamiliaresAncho) : [];
    const famFromCsv = buildFamiliares(fieldMap);
    const familiares = layoutFamiliaresAncho
      ? famAnchos.length > 0
        ? famAnchos
        : (existing?.familiares ?? [])
      : famFromCsv.length
        ? famFromCsv
        : (existing?.familiares ?? []);

    const fechaIngreso = pickStr(formPartial.fechaIngreso, existing?.fechaIngreso);
    const nss = pickStr(formPartial.imss, existing?.nss);
    const posicion = pickStr(formPartial.posicion, existing?.posicion);

    const payload: ColaboradorCompleto = {
      noEmpleado: no,
      nombreCompleto: nombreFinal,
      fechaIngreso,
      servicioAsignado: servicioCsv,
      ultimoServicio,
      nss,
      posicion,
      puesto: puestoCsv,
      moperActual,
      registeredAt,
      form: formPartial,
      familiares,
    };

    if (apply) {
      await upsertColaboradorCompleto(payload);
    }
    imported++;
  }

  return { imported, skippedEmpty, errors };
}

/** Encabezados sugeridos (una fila) para una plantilla compatible con el importador. */
export function encabezadosPlantillaAltasCsv(): string[] {
  return [
    "NO_EMPLEADO",
    "NOMBRE_COMPLETO",
    "FECHA_INGRESO",
    "FECHA_BAJA",
    "PUESTO",
    "SERVICIO",
    "SERVICIO_ASIGNADO",
    "POSICION",
    "LOCAL_FORANEO",
    "IMSS",
    "APELLIDO_PATERNO",
    "APELLIDO_MATERNO",
    "NOMBRES",
    "CURP",
    "RFC",
    "TELEFONO_PERSONAL_CASA",
    "BANCO",
    "REGISTRADO_EN",
    "ULTIMO_SERVICIO",
  ];
}

export function generarCsvPlantillaAltas(): string {
  const h = encabezadosPlantillaAltasCsv();
  const esc = (s: string) => (/,|\n|"/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return "\uFEFF" + h.map(esc).join(",") + "\r\n";
}
