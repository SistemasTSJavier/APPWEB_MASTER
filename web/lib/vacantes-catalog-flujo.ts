import {
  consumirVacanteEnAlta,
  consumirVacantePorId,
  type AltaServicioContexto,
} from "@/lib/altas-vacantes";
import { loadVacantesCatalogo } from "@/lib/vacantes-catalog";
import { pushVacantesCatalogRemote } from "@/lib/vacantes-catalog-remote";
import {
  registrarVacantePorBajaColaborador,
  type RegistrarVacanteBajaResult,
} from "@/lib/vacantes-desde-baja";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";

export type PersistVacantesResult = {
  ok: boolean;
  uploaded: number;
  aviso?: string;
};

/** Publica en Supabase el catálogo local actual (tras alta, baja o edición). */
export async function persistirVacantesCatalogoEnServidor(): Promise<PersistVacantesResult> {
  const items = loadVacantesCatalogo();
  const r = await pushVacantesCatalogRemote(items);
  if (!r.ok) {
    return {
      ok: false,
      uploaded: 0,
      aviso:
        r.meta?.status === "no_config"
          ? "Cambio guardado solo en este navegador (Supabase no configurado)."
          : r.meta?.message ?? "No se pudo sincronizar vacantes con producción.",
    };
  }
  return { ok: true, uploaded: r.uploaded };
}

export type ConsumirVacanteAltaResult = {
  consumida: boolean;
  sync: PersistVacantesResult;
};

/**
 * Al guardar un alta: quita la vacante del catálogo (por id o por posición/servicio/planta)
 * y sincroniza con producción.
 */
export async function consumirVacanteTrasAlta(params: {
  vacanteId?: string;
  alta: AltaServicioContexto;
  posicion: string;
}): Promise<ConsumirVacanteAltaResult> {
  let consumida = false;
  const id = params.vacanteId?.trim();
  if (id) consumida = consumirVacantePorId(id);
  if (!consumida && params.posicion.trim()) {
    consumida = consumirVacanteEnAlta(params.alta, params.posicion);
  }
  const sync = consumida
    ? await persistirVacantesCatalogoEnServidor()
    : { ok: true, uploaded: 0 };
  return { consumida, sync };
}

export type RegistrarVacanteBajaCompletoResult = RegistrarVacanteBajaResult & {
  sync: PersistVacantesResult;
};

/**
 * Al dar de baja: registra la posición como vacante nueva y sincroniza con producción.
 */
export async function registrarVacanteTrasBaja(
  c: ColaboradorCompleto,
  catalogo: CatalogoServicioItem[] = [],
): Promise<RegistrarVacanteBajaCompletoResult> {
  const base = registrarVacantePorBajaColaborador(c, catalogo);
  const sync = base.creada ? await persistirVacantesCatalogoEnServidor() : { ok: true, uploaded: 0 };
  return { ...base, sync };
}
