import type { AppRole } from "@/lib/app-role";

export type CatalogoTipo = "departamento" | "rol";

export type CatalogoItem = {
  id: string;
  tipo: CatalogoTipo;
  label: string;
  baseRole: AppRole | null;
  activo: boolean;
  createdAt: string;
  esBuiltin?: boolean;
};

export type DepartamentoOpcion = { id: string; label: string; esBuiltin: boolean };

/** Prefijo en el select de usuarios para roles del catálogo. */
export const ROL_CATALOGO_PREFIX = "catalogo:";

/** Slug seguro para id de catálogo / carpeta SGC. */
export function slugCatalogo(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function esSlugCatalogoValido(id: string): boolean {
  return /^[a-z][a-z0-9-]{0,47}$/.test(id);
}

export function encodeRolSelectValue(opts: {
  appRole: AppRole | string;
  rolCustomId?: string | null;
}): string {
  const custom = String(opts.rolCustomId ?? "").trim();
  if (custom) return `${ROL_CATALOGO_PREFIX}${custom}`;
  return String(opts.appRole ?? "");
}

export function decodeRolSelectValue(raw: string): {
  kind: "builtin" | "catalogo";
  appRole?: string;
  catalogoId?: string;
} {
  const v = String(raw ?? "").trim();
  if (v.startsWith(ROL_CATALOGO_PREFIX)) {
    return { kind: "catalogo", catalogoId: v.slice(ROL_CATALOGO_PREFIX.length) };
  }
  return { kind: "builtin", appRole: v };
}
