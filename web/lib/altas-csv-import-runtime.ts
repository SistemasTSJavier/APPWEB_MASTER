import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { listColaboradoresCompletos, upsertColaboradoresBatch } from "@/lib/colaboradores-data";

export const ALTAS_CSV_IMPORT_BATCH_SIZE = 50;

export type AltasCsvImportCache = {
  byNo: Map<string, ColaboradorCompleto>;
};

export function normalizeNoEmpleadoImport(no: string): string {
  return no.trim().toUpperCase();
}

export function buildAltasCsvImportCache(list: ColaboradorCompleto[]): AltasCsvImportCache {
  const byNo = new Map<string, ColaboradorCompleto>();
  for (const c of list) {
    const key = normalizeNoEmpleadoImport(c.noEmpleado);
    if (key) byNo.set(key, c);
  }
  return { byNo };
}

export async function loadAltasCsvImportCache(): Promise<AltasCsvImportCache> {
  const list = await listColaboradoresCompletos();
  return buildAltasCsvImportCache(list);
}

export function findEnCacheImport(cache: AltasCsvImportCache, noEmpleado: string): ColaboradorCompleto | null {
  return cache.byNo.get(normalizeNoEmpleadoImport(noEmpleado)) ?? null;
}

export type AltasCsvBatchWriter = {
  cache: AltasCsvImportCache;
  apply: boolean;
  pending: ColaboradorCompleto[];
  batchSize: number;
};

export function createAltasCsvBatchWriter(
  cache: AltasCsvImportCache,
  apply: boolean,
  batchSize = ALTAS_CSV_IMPORT_BATCH_SIZE,
): AltasCsvBatchWriter {
  return { cache, apply, pending: [], batchSize };
}

/** Actualiza caché en memoria y encola persistencia por lotes. */
export function queueColaboradorImport(writer: AltasCsvBatchWriter, payload: ColaboradorCompleto): void {
  const key = normalizeNoEmpleadoImport(payload.noEmpleado);
  writer.cache.byNo.set(key, payload);
  if (writer.apply) {
    writer.pending.push(payload);
  }
}

export async function flushColaboradorImportBatch(writer: AltasCsvBatchWriter): Promise<void> {
  if (!writer.apply || writer.pending.length === 0) return;
  const chunk = writer.pending.splice(0, writer.pending.length);
  await upsertColaboradoresBatch(chunk);
}

export async function flushColaboradorImportIfFull(writer: AltasCsvBatchWriter): Promise<void> {
  while (writer.pending.length >= writer.batchSize) {
    const chunk = writer.pending.splice(0, writer.batchSize);
    await upsertColaboradoresBatch(chunk);
  }
}

export async function finalizeColaboradorImport(writer: AltasCsvBatchWriter): Promise<void> {
  await flushColaboradorImportBatch(writer);
}
