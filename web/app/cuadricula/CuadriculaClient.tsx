"use client";

import dynamic from "next/dynamic";
import "@/cuadricula/index.css";
import "@/cuadricula/App.css";
import { CuadriculaDataProvider } from "@/cuadricula/CuadriculaDataContext";

const CuadriculaApp = dynamic(() => import("@/cuadricula/App"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#f0f2f5] text-slate-600">
      <p className="text-sm font-semibold uppercase tracking-wide">Cargando cuadrícula…</p>
    </div>
  ),
});

/**
 * Panel de cuadrícula (asistencia, bajas, incidencias, comidas) embebido desde `web/cuadricula/src`.
 * Carga diferida sin SSR para alinear con localStorage y reducir el bundle inicial del resto del sitio.
 */
export function CuadriculaClient() {
  return (
    <div id="cuadricula-mount" className="cuadricula-mount">
      <CuadriculaDataProvider>
        <CuadriculaApp />
      </CuadriculaDataProvider>
    </div>
  );
}
