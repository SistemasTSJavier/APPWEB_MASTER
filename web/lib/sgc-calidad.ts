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
  | "marketing"
  | (string & {});

export type SgcCategoriaMeta = {
  id: SgcCategoriaId;
  label: string;
  description: string;
  icon: string;
  /** Clases Tailwind para acento (borde, fondo suave, texto). */
  accent: string;
};

export const SGC_CATEGORIAS: readonly SgcCategoriaMeta[] = [
  {
    id: "documentos",
    label: "Documentos",
    description: "Registros y evidencias del sistema de calidad",
    icon: "📄",
    accent: "border-sky-200 bg-sky-50/80 text-sky-950 ring-sky-100",
  },
  {
    id: "formatos",
    label: "Formatos",
    description: "Plantillas y formatos estandarizados",
    icon: "📋",
    accent: "border-violet-200 bg-violet-50/80 text-violet-950 ring-violet-100",
  },
  {
    id: "instruccion-trabajo",
    label: "Instrucción de trabajo",
    description: "IT con pasos operativos por área",
    icon: "🛠️",
    accent: "border-amber-200 bg-amber-50/80 text-amber-950 ring-amber-100",
  },
  {
    id: "manual",
    label: "Manual",
    description: "Manuales de calidad y referencia",
    icon: "📘",
    accent: "border-indigo-200 bg-indigo-50/80 text-indigo-950 ring-indigo-100",
  },
  {
    id: "politicas",
    label: "Políticas",
    description: "Políticas corporativas y de calidad",
    icon: "⚖️",
    accent: "border-rose-200 bg-rose-50/80 text-rose-950 ring-rose-100",
  },
  {
    id: "procedimientos",
    label: "Procedimientos",
    description: "Procedimientos documentados (P)",
    icon: "📑",
    accent: "border-teal-200 bg-teal-50/80 text-teal-950 ring-teal-100",
  },
  {
    id: "protocolos",
    label: "Protocolos",
    description: "Protocolos y guías específicas",
    icon: "🔬",
    accent: "border-cyan-200 bg-cyan-50/80 text-cyan-950 ring-cyan-100",
  },
  {
    id: "reglamentos",
    label: "Reglamentos",
    description: "Reglamentos internos y normativos",
    icon: "📜",
    accent: "border-slate-300 bg-slate-50/90 text-slate-950 ring-slate-200",
  },
] as const;

export function sgcCategoriaMeta(id: SgcCategoriaId): SgcCategoriaMeta {
  return SGC_CATEGORIAS.find((c) => c.id === id) ?? SGC_CATEGORIAS[0];
}

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

/** Id de departamento fijo o del catálogo (slug). */
export function esFormatoDepartamentoId(v: string): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (isSgcDepartamentoId(s)) return true;
  return /^[a-z][a-z0-9-]{0,47}$/.test(s);
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

export type SgcFileKind = "pdf" | "office" | "image" | "archive" | "other";

export function sgcFileKindFromName(name: string): SgcFileKind {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv"].includes(ext)) return "office";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  if (["zip", "rar", "7z"].includes(ext)) return "archive";
  return "other";
}

export function sgcFormatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
