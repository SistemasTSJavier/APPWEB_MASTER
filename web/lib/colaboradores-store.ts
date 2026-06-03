/**
 * Reexport central: tipos, datos (Supabase via API servidor) y ayudas MOPER.
 */
export type {
  ColaboradorCompleto,
  ColaboradorSnapshot,
  FamiliarGuardado,
  MoperEstadoLinea,
} from "@/lib/colaboradores-types";

export type { SincronizarMoperResultado } from "@/lib/colaboradores-data";

export {
  listColaboradoresCompletos,
  invalidateColaboradoresListCache,
  findColaboradorCompletoByNo,
  findColaboradorByNo,
  upsertColaboradorCompleto,
  upsertColaboradoresBatch,
  aplicarMoperMovimiento,
  mergeColaboradorConDestinoMoper,
  sincronizarColaboradoresConHistorialMoper,
} from "@/lib/colaboradores-data";

export { getMoperInicialesParaFormulario } from "@/lib/colaboradores-moper-iniciales";

/** @deprecated Usar upsertColaboradorCompleto; mantenido por compatibilidad con imports antiguos. */
import type { ColaboradorSnapshot } from "@/lib/colaboradores-types";
import { findColaboradorCompletoByNo, upsertColaboradorCompleto } from "@/lib/colaboradores-data";

export async function upsertColaborador(snapshot: ColaboradorSnapshot): Promise<void> {
  const existing = await findColaboradorCompletoByNo(snapshot.noEmpleado);
  await upsertColaboradorCompleto({
    ...snapshot,
    noEmpleado: snapshot.noEmpleado,
    nombreCompleto: snapshot.nombreCompleto,
    fechaIngreso: snapshot.fechaIngreso,
    servicioAsignado: snapshot.servicioAsignado,
    ultimoServicio: snapshot.ultimoServicio,
    nss: snapshot.nss,
    posicion: snapshot.posicion,
    puesto: snapshot.puesto ?? "",
    registeredAt: existing?.registeredAt ?? new Date().toISOString(),
    form: existing?.form ?? {},
    familiares: existing?.familiares ?? [],
    moperActual: existing?.moperActual,
  });
}
