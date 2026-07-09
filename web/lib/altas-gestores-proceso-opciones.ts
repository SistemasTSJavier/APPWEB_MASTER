import { ALTAS_GESTORES_PROCESO_OPCIONES } from "@/lib/altas-form-catalogo";
import { normalizarNombreParaCoincidencia } from "@/lib/altas-coincidencia-nombre";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";

function textoSinAcentos(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** true si el texto contiene "reclutadora" (sin importar acentos o mayúsculas). */
export function contieneReclutadora(texto: string): boolean {
  return /reclutadora/i.test(textoSinAcentos(String(texto ?? "").trim()));
}

export function puestoColaboradorAlta(c: ColaboradorCompleto): string {
  return String(c.puesto ?? c.form?.puesto ?? c.moperActual?.puesto ?? "").trim();
}

export function esColaboradorGestorReclutadora(c: ColaboradorCompleto): boolean {
  return contieneReclutadora(puestoColaboradorAlta(c));
}

function nombreGestorDesdeColaborador(c: ColaboradorCompleto): string {
  const snap = String(c.nombreCompleto ?? "").trim();
  if (snap) return snap.toUpperCase();
  const f = c.form ?? {};
  return [f.nombres, f.apellidoPaterno, f.apellidoMaterno]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

/**
 * Opciones para el select de Gestor del proceso en Altas:
 * catálogo fijo + colaboradores con "reclutadora" en el puesto
 * (p. ej. RECLUTADORA NUEVO LAREDO) y el texto del puesto como opción.
 */
export function opcionesGestorProcesoDesdeColaboradores(list: ColaboradorCompleto[]): string[] {
  const estaticas = new Set<string>(ALTAS_GESTORES_PROCESO_OPCIONES);
  const dinamicas = new Set<string>();

  for (const c of list) {
    if (!esColaboradorGestorReclutadora(c)) continue;

    const nombre = nombreGestorDesdeColaborador(c);
    if (nombre) dinamicas.add(nombre);

    const puesto = puestoColaboradorAlta(c).toUpperCase();
    if (puesto && contieneReclutadora(puesto)) {
      dinamicas.add(puesto);
    }
  }

  const extras = [...dinamicas]
    .filter((o) => !estaticas.has(o))
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  return [...ALTAS_GESTORES_PROCESO_OPCIONES, ...extras];
}

/** Busca colaborador reclutadora por texto de puesto capturado en alta. */
export function colaboradorGestorPorTextoPuestoReclutadora(
  list: ColaboradorCompleto[],
  gestorTexto: string,
): ColaboradorCompleto | null {
  const clave = normalizarNombreParaCoincidencia(gestorTexto);
  if (!clave || !contieneReclutadora(gestorTexto)) return null;

  for (const c of list) {
    if (!esColaboradorGestorReclutadora(c)) continue;
    const puestoNorm = normalizarNombreParaCoincidencia(puestoColaboradorAlta(c));
    if (puestoNorm === clave) return c;
  }
  return null;
}
