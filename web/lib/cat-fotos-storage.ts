import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Índice de fotos en Supabase Storage por número de empleado.
 *
 * Las fotos se guardan en el bucket `colaboradores-fotos` con la ruta
 * `{NO_EMPLEADO}/{uuid}.{ext}`. Este helper recorre el bucket y arma un mapa
 * NO_EMPLEADO (MAYÚSCULAS) → URL pública de la foto más reciente, para que el
 * dashboard muestre la foto aunque el expediente no tenga guardada la URL.
 */

const FOTOS_BUCKET = "colaboradores-fotos";
const IMG_EXT = /\.(jpe?g|png|webp|gif)$/i;
const CONCURRENCIA = 12;

type StorageItem = {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: { size?: number } | null;
};

function urlPublica(client: SupabaseClient, path: string): string {
  const { data } = client.storage.from(FOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function esArchivoImagen(name: string): boolean {
  return IMG_EXT.test(name);
}

/** Carpetas de empleado en la raíz del bucket: solo dígitos (p. ej. 7444). */
function esCarpetaEmpleado(name: string): boolean {
  return /^\d+$/.test(name.trim());
}

function fechaOrden(item: StorageItem): number {
  const raw = item.updated_at ?? item.created_at ?? "";
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Foto más reciente dentro de la carpeta de un empleado. */
export async function fotoStoragePorEmpleado(
  client: SupabaseClient,
  noEmpleado: string,
): Promise<string | null> {
  const no = noEmpleado.trim();
  if (!no) return null;
  const url = await fotoDeCarpeta(client, no);
  if (url) return url;
  const mayus = no.toUpperCase();
  if (mayus !== no) return fotoDeCarpeta(client, mayus);
  return null;
}

async function fotoDeCarpeta(client: SupabaseClient, carpeta: string): Promise<string | null> {
  const { data, error } = await client.storage.from(FOTOS_BUCKET).list(carpeta, {
    limit: 100,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error || !data?.length) return null;

  const imagenes = (data as StorageItem[]).filter((it) => esArchivoImagen(it.name));
  if (!imagenes.length) return null;

  imagenes.sort((a, b) => fechaOrden(b) - fechaOrden(a));
  const elegida = imagenes[0];
  return urlPublica(client, `${carpeta}/${elegida.name}`);
}

async function enLotes<T, R>(items: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limite) {
    const lote = items.slice(i, i + limite);
    const res = await Promise.all(lote.map(fn));
    out.push(...res);
  }
  return out;
}

/**
 * Recorre el bucket y devuelve NO_EMPLEADO (MAYÚSCULAS) → URL pública.
 * Solo consulta las carpetas de los empleados solicitados (si se pasan) para
 * limitar el número de llamadas a Storage.
 */
export async function mapaFotosStoragePorEmpleado(
  client: SupabaseClient,
  soloEmpleados?: Iterable<string>,
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();

  const { data: raiz, error } = await client.storage.from(FOTOS_BUCKET).list("", { limit: 10000 });
  if (error || !raiz?.length) return mapa;

  const carpetas = (raiz as StorageItem[])
    .map((it) => it.name.replace(/\/$/, ""))
    .filter((name) => esCarpetaEmpleado(name));

  const filtro = soloEmpleados
    ? new Set(Array.from(soloEmpleados, (e) => e.trim().toUpperCase()).filter(Boolean))
    : null;

  const objetivo = filtro
    ? carpetas.filter((c) => filtro.has(c.trim().toUpperCase()))
    : carpetas;

  await enLotes(objetivo, CONCURRENCIA, async (carpeta) => {
    const url = await fotoDeCarpeta(client, carpeta);
    if (url) mapa.set(carpeta.trim().toUpperCase(), url);
  });

  return mapa;
}
