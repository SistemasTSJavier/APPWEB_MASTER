/** Sistemas de gestión de calidad — categorías y departamentos. */

export const SGC_BUCKET = "sgc-gestion-calidad";

/** 50 MB por archivo (ajustable en migración del bucket). */
export const SGC_MAX_BYTES = 50 * 1024 * 1024;

export type SgcCategoriaId =
  | "documentos"
  | "formatos"
  | "instruccion-trabajo"
  | "manual"
  | "politicas"
  | "procedimientos"
  | "protocolos"
  | "reglamentos";

export type SgcDepartamentoId =
  | "operaciones"
  | "contabilidad"
  | "recursos-humanos"
  | "mejora-continua"
  | "legal"
  | "relaciones-laborales"
  | "direccion"
  | "marketing";

export const SGC_CATEGORIAS: readonly { id: SgcCategoriaId; label: string }[] = [
  { id: "documentos", label: "Documentos" },
  { id: "formatos", label: "Formatos" },
  { id: "instruccion-trabajo", label: "Instrucción de trabajo" },
  { id: "manual", label: "Manual" },
  { id: "politicas", label: "Políticas" },
  { id: "procedimientos", label: "Procedimientos" },
  { id: "protocolos", label: "Protocolos" },
  { id: "reglamentos", label: "Reglamentos" },
] as const;

export const SGC_DEPARTAMENTOS: readonly { id: SgcDepartamentoId; label: string }[] = [
  { id: "operaciones", label: "Operaciones" },
  { id: "contabilidad", label: "Contabilidad" },
  { id: "recursos-humanos", label: "Recursos humanos" },
  { id: "mejora-continua", label: "Mejora continua" },
  { id: "legal", label: "Legal" },
  { id: "relaciones-laborales", label: "Relaciones laborales" },
  { id: "direccion", label: "Dirección" },
  { id: "marketing", label: "Marketing" },
] as const;

const CATEGORIA_SET = new Set<string>(SGC_CATEGORIAS.map((c) => c.id));
const DEPARTAMENTO_SET = new Set<string>(SGC_DEPARTAMENTOS.map((d) => d.id));

export function isSgcCategoriaId(v: string): v is SgcCategoriaId {
  return CATEGORIA_SET.has(v);
}

export function isSgcDepartamentoId(v: string): v is SgcDepartamentoId {
  return DEPARTAMENTO_SET.has(v);
}

export function sgcCategoriaLabel(id: SgcCategoriaId): string {
  return SGC_CATEGORIAS.find((c) => c.id === id)?.label ?? id;
}

export function sgcDepartamentoLabel(id: SgcDepartamentoId): string {
  return SGC_DEPARTAMENTOS.find((d) => d.id === id)?.label ?? id;
}

/** Carpeta en Storage: `{categoria}/{departamento}/` */
export function sgcStoragePrefix(categoria: SgcCategoriaId, departamento: SgcDepartamentoId): string {
  return `${categoria}/${departamento}`;
}

export function assertSafeUploadFileName(name: string): string | null {
  const base = name.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  if (!base || base.includes("..") || base.length > 180) return null;
  if (/[\x00-\x1f]/.test(base)) return null;
  return base;
}

export function sgcObjectPath(
  categoria: SgcCategoriaId,
  departamento: SgcDepartamentoId,
  fileName: string,
  uuid: string,
): string {
  const safe = assertSafeUploadFileName(fileName);
  if (!safe) throw new Error("Nombre de archivo no permitido");
  return `${sgcStoragePrefix(categoria, departamento)}/${uuid}_${safe}`;
}

/** Nombre legible desde objeto `{uuid}_{nombre original}`. */
export function sgcDisplayNameFromObject(objectName: string): string {
  const base = objectName.split("/").pop() ?? objectName;
  const idx = base.indexOf("_");
  if (idx > 0 && idx < base.length - 1) return base.slice(idx + 1);
  return base;
}
