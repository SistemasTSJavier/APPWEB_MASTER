"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { colaboradorToEmpleadoIncidencia, colaboradoresActivosTodos } from "./cuadriculaColaboradoresBridge";

type CuadriculaDataState = {
  catalogo: CatalogoServicioItem[];
  colaboradores: ColaboradorCompleto[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Lista para buscadores (incidencias / comidas): activos, expediente real. */
  empleadosBusqueda: ReturnType<typeof colaboradorToEmpleadoIncidencia>[];
};

const CuadriculaDataContext = createContext<CuadriculaDataState | null>(null);

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (r.status === 401 || r.status === 403) {
    throw new Error("NO AUTORIZADO PARA CARGAR DATOS. REVISA TU SESION Y ROL.");
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export function CuadriculaDataProvider({ children }: { children: ReactNode }) {
  const [catalogo, setCatalogo] = useState<CatalogoServicioItem[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cat, coll] = await Promise.all([
        fetchJson<{ items: CatalogoServicioItem[] }>("/api/servicios"),
        fetchJson<ColaboradorCompleto[]>("/api/colaboradores"),
      ]);
      setCatalogo(Array.isArray(cat.items) ? cat.items : []);
      setColaboradores(Array.isArray(coll) ? coll : []);
    } catch (e) {
      setCatalogo([]);
      setColaboradores([]);
      setError(e instanceof Error ? e.message : "ERROR AL CARGAR CATALOGO O COLABORADORES.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empleadosBusqueda = useMemo(
    () => colaboradoresActivosTodos(colaboradores).map(colaboradorToEmpleadoIncidencia),
    [colaboradores],
  );

  const value = useMemo(
    () => ({
      catalogo,
      colaboradores,
      loading,
      error,
      reload: load,
      empleadosBusqueda,
    }),
    [catalogo, colaboradores, loading, error, load, empleadosBusqueda],
  );

  return <CuadriculaDataContext.Provider value={value}>{children}</CuadriculaDataContext.Provider>;
}

export function useCuadriculaData(): CuadriculaDataState {
  const ctx = useContext(CuadriculaDataContext);
  if (!ctx) {
    throw new Error("useCuadriculaData debe usarse dentro de CuadriculaDataProvider");
  }
  return ctx;
}
