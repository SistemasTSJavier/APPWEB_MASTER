import type { MoperRegistroApi } from "@/lib/moper-registros-types";

/** Registro MOPER para UI del workflow. */
export type RegistroMoper = MoperRegistroApi & {
  id: number;
  folio: string | null;
};
