import { parseCsvContent } from "@/lib/csv";
import { CSV_TABLE_KEYS, pickFieldsForTable, type CsvMysqlTable } from "@/lib/csv-mysql-modules";
import { buildHeaderFieldIndex, rowToFieldMap, type CsvFieldKey } from "@/lib/empleado-csv-map";
import type { ColaboradorCompleto, FamiliarGuardado } from "@/lib/colaboradores-store";
import { findColaboradorCompletoByNo, upsertColaboradorCompleto } from "@/lib/colaboradores-store";
import type { AltasCsvImportResult, AltasCsvImportOptions } from "@/lib/altas-csv-import";

/** PARTE ALTAS ↔ bloque CSV (archivos separados). */
export const ALTAS_PARTE_A_TABLA: Record<number, CsvMysqlTable> = {
  1: "empleado_master",
  2: "empleado_identidad",
  3: "empleado_salud",
  4: "empleado_nomina_reclutamiento",
  5: "familiar",
  6: "empleado_moper",
};

export const ALTAS_ETIQUETA_PARTE_IMPORT: Record<number, string> = {
  1: "PARTE 1 · Datos generales (master)",
  2: "PARTE 2 · Identidad y domicilio",
  3: "PARTE 3 · Salud",
  4: "PARTE 4 · Nómina y reclutamiento",
  5: "PARTE 5 · Familiares (una fila = un familiar)",
  6: "MOPER (columnas MOPER_1 … MOPER_7 en el expediente)",
};

function normalizeNo(no: string): string {
  return no.trim().toUpperCase();
}

function g(p: Partial<Record<CsvFieldKey, string>>, k: CsvFieldKey): string {
  return (p[k] ?? "").trim();
}

function beneficiarioNorm(s: string): string {
  const u = s.trim().toUpperCase();
  if (u === "SI" || u === "SÍ" || u === "1" || u === "TRUE") return "SI";
  return "NO";
}

function buildFamiliaresRow(m: Partial<Record<CsvFieldKey, string>>): FamiliarGuardado[] {
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

function nombreCompletoDesde(picked: Partial<Record<CsvFieldKey, string>>, form: Record<string, string>): string {
  let n = g(picked, "nombreCompleto") || form.nombreCompleto?.trim() || "";
  if (!n) {
    n = [g(picked, "nombres") || form.nombres, g(picked, "apellidoPaterno") || form.apellidoPaterno, g(picked, "apellidoMaterno") || form.apellidoMaterno]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return n;
}

function buildTelefonoPersonalPartial(p: Partial<Record<CsvFieldKey, string>>): string {
  const tpc = g(p, "telefonoPersonalCasa");
  if (tpc) return tpc;
  const t1 = g(p, "telefono");
  const t2 = g(p, "telefonoCasa");
  return [t1, t2].filter(Boolean).join(" / ");
}

function mergeFormPreserve(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (String(v ?? "").trim() !== "") out[k] = v;
  }
  return out;
}

function emptyColaboradorStub(no: string): ColaboradorCompleto {
  const now = new Date().toISOString();
  return {
    noEmpleado: no,
    nombreCompleto: "",
    fechaIngreso: "",
    servicioAsignado: "",
    ultimoServicio: "",
    nss: "",
    posicion: "",
    puesto: "",
    registeredAt: now,
    form: {},
    familiares: [],
    moperActual: { servicio: "", puesto: "" },
  };
}

/** Solo campos presentes en `picked` → no borra el resto del expediente. */
function formDeltaDesdePick(picked: Partial<Record<CsvFieldKey, string>>): Record<string, string> {
  const f: Record<string, string> = {};
  const z = picked;

  const put = (formKey: string, ck: CsvFieldKey) => {
    if (z[ck] === undefined) return;
    f[formKey] = String(z[ck]).trim();
  };

  put("fechaIngreso", "fechaIngreso");
  put("fechaBaja", "fechaBaja");
  put("envio", "envio");
  put("reyna", "reyna");
  put("reingreso", "reingreso");
  put("nombreCompleto", "nombreCompleto");
  put("puesto", "puesto");
  put("servicio", "servicio");
  put("posicion", "posicion");
  put("localForaneo", "localForaneo");
  put("numeroFolio", "numeroFolio");
  put("apellidoPaterno", "apellidoPaterno");
  put("apellidoMaterno", "apellidoMaterno");
  put("nombres", "nombres");
  put("fechaNacimiento", "fechaNacimiento");
  put("edad", "edad");
  put("curp", "curp");
  put("rfc", "rfc");
  put("imss", "imss");
  put("codigoPostal", "codigoPostal");
  put("estadoNatal", "estadoNatal");
  if (z.domicilio !== undefined) {
    const v = g(z, "domicilio");
    if (v) f.direccionCompleta = v;
  }

  if (z.telefono !== undefined || z.telefonoCasa !== undefined || z.telefonoPersonalCasa !== undefined) {
    const merged = buildTelefonoPersonalPartial(z);
    if (merged) f.telefonoPersonalCasa = merged;
  }

  put("escolaridad", "escolaridad");

  put("estaturaPeso", "estaturaPeso");
  put("tipoSangre", "tipoSangre");
  put("alergicoA", "alergicoA");
  put("enfermedadTratamiento", "enfermedadTratamiento");
  if (z.diabetico !== undefined) f.diabetico = g(z, "diabetico") || "NO";
  if (z.hipertenso !== undefined) f.hipertenso = g(z, "hipertenso") || "NO";
  put("emergenciaLlamarA", "emergenciaNombre");
  put("telefonoEmergencia", "emergenciaTelefono");

  put("banco", "banco");
  put("numeroCuenta", "numeroCuenta");
  put("clabeInterbancaria", "clabeInterbancaria");
  put("noTarjeta", "noTarjeta");
  put("sueldoMensual", "sueldoMensual");
  put("fuenteReclutamiento", "fuenteReclutamiento");
  put("gestorProceso", "gestorProceso");
  put("estudioSocioeconomico", "estudioSocioeconomico");
  put("documentacionOriginal", "documentacionOriginal");

  if (z.estatusEmpleado !== undefined) f.estatusEmpleado = g(z, "estatusEmpleado");
  if (z.puestoFinal !== undefined) f.puestoFinal = g(z, "puestoFinal");
  if (z.servicioFinal !== undefined) f.servicioFinal = g(z, "servicioFinal");

  const mopers = ["moper1", "moper2", "moper3", "moper4", "moper5", "moper6", "moper7"] as const;
  for (const mk of mopers) {
    if (z[mk] !== undefined && g(z, mk)) f[mk] = g(z, mk);
  }

  if (z.ultimoServicio !== undefined) f.ultimoServicio = g(z, "ultimoServicio");
  if (z.registradoAt !== undefined) f.registeredAt = g(z, "registradoAt");

  return f;
}

function aplicarSnapDesdePick(base: ColaboradorCompleto, picked: Partial<Record<CsvFieldKey, string>>): ColaboradorCompleto {
  const n = { ...base };
  if (picked.nombreCompleto !== undefined) n.nombreCompleto = g(picked, "nombreCompleto");
  if (picked.fechaIngreso !== undefined) n.fechaIngreso = g(picked, "fechaIngreso");
  if (picked.servicio !== undefined) n.servicioAsignado = g(picked, "servicio");
  if (picked.puesto !== undefined) n.puesto = g(picked, "puesto");
  if (picked.posicion !== undefined) n.posicion = g(picked, "posicion");
  if (picked.imss !== undefined) n.nss = g(picked, "imss");
  if (picked.ultimoServicio !== undefined) n.ultimoServicio = g(picked, "ultimoServicio");
  if (picked.registradoAt !== undefined) {
    const r = g(picked, "registradoAt");
    if (r) n.registeredAt = r;
  }
  return n;
}

/**
 * Importa un CSV de un solo bloque (PARTE 1…5 o MOPER). Mezcla por N° empleado.
 * PARTE 5: cada fila agrega un familiar (no elimina los anteriores).
 */
export function importColaboradoresDesdeCsvPorParte(
  text: string,
  parteNum: number,
  options?: AltasCsvImportOptions,
): AltasCsvImportResult & { tabla: CsvMysqlTable } {
  const tabla = ALTAS_PARTE_A_TABLA[parteNum];
  if (!tabla) {
    return {
      imported: 0,
      skippedEmpty: 0,
      errors: [{ row: 0, message: "NUMERO DE PARTE INVALIDO (USE 1 A 6)." }],
      tabla: "empleado_master",
    };
  }

  const preserveMoper = options?.preserveMoper !== false;
  const apply = options?.apply !== false;

  const stripped = text.replace(/^\uFEFF/, "");
  const rows = parseCsvContent(stripped);
  if (rows.length < 2) {
    return {
      imported: 0,
      skippedEmpty: 0,
      errors: [{ row: 1, message: "EL ARCHIVO NO TIENE DATOS (MINIMO: ENCABEZADOS + 1 FILA)." }],
      tabla,
    };
  }

  const headerRow = rows[0]!.map((c) => c.trim());
  const fieldIndex = buildHeaderFieldIndex(headerRow);

  let imported = 0;
  let skippedEmpty = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => c.trim() !== "")) {
      skippedEmpty++;
      continue;
    }

    const fieldMapFull = rowToFieldMap(cells, fieldIndex);
    const picked = pickFieldsForTable(fieldMapFull, tabla);
    const masterTraeServicioPuesto =
      parteNum === 1 && (picked.servicio !== undefined || picked.puesto !== undefined);

    const noRaw = g(picked, "noEmpleado");
    const rowLabel = r + 1;

    if (!picked.noEmpleado || !noRaw) {
      errors.push({
        row: rowLabel,
        message: `FALTA N° EMPLEADO. Columna tipica: NO_EMPLEADO (${ALTAS_ETIQUETA_PARTE_IMPORT[parteNum]}).`,
      });
      continue;
    }

    const no = normalizeNo(noRaw);
    const prev = findColaboradorCompletoByNo(no);

    if (tabla === "familiar") {
      if (!prev) {
        errors.push({ row: rowLabel, message: `NO EXISTE ${no}. IMPORTA PARTE 1 (O ALTA) ANTES DE FAMILIARES.` });
        continue;
      }
      const fam = buildFamiliaresRow(picked);
      if (!fam.length) {
        errors.push({ row: rowLabel, message: "SIN DATOS DE FAMILIAR (NOMBRE FAMILIAR, PARENTESCO, ETC.)." });
        continue;
      }
      const merged: ColaboradorCompleto = {
        ...prev,
        form: { ...prev.form, noEmpleado1: no },
        familiares: [...prev.familiares, ...fam],
      };
      if (apply) upsertColaboradorCompleto(merged);
      imported++;
      continue;
    }

    let merged: ColaboradorCompleto = prev
      ? { ...prev, form: { ...prev.form }, familiares: [...prev.familiares] }
      : emptyColaboradorStub(no);

    const delta = formDeltaDesdePick(picked);
    merged.form = mergeFormPreserve(merged.form, delta);
    merged.form.noEmpleado1 = no;
    merged = aplicarSnapDesdePick(merged, picked);

    const nombreComp = nombreCompletoDesde(picked, merged.form);
    const nombreFinal = nombreComp.trim() || merged.nombreCompleto.trim() || prev?.nombreCompleto.trim() || "";

    if (!nombreFinal.trim() && tabla === "empleado_master") {
      errors.push({
        row: rowLabel,
        message: "PARTE 1: FALTA NOMBRE (NOMBRE_COMPLETO O NOMBRES + APELLIDOS EN ESTE ARCHIVO).",
      });
      continue;
    }

    if (!nombreFinal.trim() && !prev?.nombreCompleto.trim()) {
      errors.push({
        row: rowLabel,
        message: `SIN NOMBRE PARA ${no}. IMPORTA PARTE 1 CON NOMBRE O COMPLETA PARTE 2 (NOMBRES / APELLIDOS).`,
      });
      continue;
    }

    merged.nombreCompleto = nombreFinal;

    merged.servicioAsignado =
      merged.servicioAsignado.trim() || merged.form.servicio.trim() || prev?.servicioAsignado || "";
    merged.puesto = merged.puesto.trim() || merged.form.puesto.trim() || prev?.puesto || "";
    merged.fechaIngreso = merged.fechaIngreso.trim() || merged.form.fechaIngreso || prev?.fechaIngreso || "";
    merged.posicion = merged.posicion.trim() || merged.form.posicion || prev?.posicion || "";
    merged.nss = merged.nss.trim() || merged.form.imss.trim() || prev?.nss || "";
    merged.ultimoServicio =
      merged.ultimoServicio.trim() || merged.form.ultimoServicio?.trim() || prev?.ultimoServicio || "";

    const registRaw = merged.form.registeredAt?.trim() || merged.registeredAt;
    merged.registeredAt = registRaw || prev?.registeredAt || merged.registeredAt;

    const servFinal = merged.servicioAsignado;
    const ptoFinal = merged.puesto;
    let ultimoServicio = merged.ultimoServicio;
    let moperActual: ColaboradorCompleto["moperActual"];

    if (preserveMoper && prev?.moperActual && prev.noEmpleado === no) {
      if (parteNum === 1 && !masterTraeServicioPuesto) {
        moperActual = { ...prev.moperActual };
        ultimoServicio = ultimoServicio || prev.ultimoServicio || "";
      } else if (parteNum === 1 && masterTraeServicioPuesto) {
        moperActual = {
          servicio: servFinal || prev.moperActual.servicio,
          puesto: ptoFinal || prev.moperActual.puesto,
        };
        if (picked.ultimoServicio !== undefined && g(picked, "ultimoServicio")) {
          ultimoServicio = g(picked, "ultimoServicio");
        } else {
          ultimoServicio = ultimoServicio || prev.ultimoServicio || "";
        }
      } else {
        moperActual = { ...prev.moperActual };
        ultimoServicio = ultimoServicio || prev.ultimoServicio || "";
      }
    } else {
      moperActual = { servicio: servFinal, puesto: ptoFinal };
    }

    merged.ultimoServicio = ultimoServicio;
    merged.moperActual = moperActual;

    if (apply) {
      upsertColaboradorCompleto(merged);
    }
    imported++;
  }

  return { imported, skippedEmpty, errors, tabla };
}

export function csvFieldKeysToCabecerasExcel(keys: readonly CsvFieldKey[]): string[] {
  return [...keys].map((k) =>
    k
      .replace(/Csv$/i, "")
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .toUpperCase(),
  );
}

export function encabezadosPlantillaCsvPorParte(parteNum: number): string[] {
  const tabla = ALTAS_PARTE_A_TABLA[parteNum];
  if (!tabla) return [];
  return csvFieldKeysToCabecerasExcel(CSV_TABLE_KEYS[tabla]);
}

export function generarCsvPlantillaAltasPorParte(parteNum: number): string {
  const h = encabezadosPlantillaCsvPorParte(parteNum);
  if (h.length === 0) return "\uFEFF";
  const esc = (s: string) => (/,|\n|"/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return `\uFEFF${h.map(esc).join(",")}\r\n`;
}
