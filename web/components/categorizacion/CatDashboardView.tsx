"use client";

import { forwardRef } from "react";
import type { CatDashboardEmpleado } from "@/lib/categorizacion-dashboard-types";
import type { CatNivelId, CatPaqueteId } from "@/lib/categorizacion-calificaciones";
import { CAT_NIVEL_REGLAS, CAT_PAQUETE_REGLAS } from "@/lib/categorizacion-calificaciones";
import { CatBarChartModulos } from "@/components/categorizacion/CatDashboardCharts";
import { CAT_DASHBOARD_LOGO_FALLBACKS } from "@/lib/brand-logo";
import { TacticalSupportLogo } from "@/components/tactical-support-logo";

export const CatDashboardView = forwardRef<
  HTMLDivElement,
  { empleado: CatDashboardEmpleado; generadoEn: string; presentacion?: boolean }
>(function CatDashboardView({ empleado, generadoEn, presentacion = false }, ref) {
  const fecha = new Date(generadoEn).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  const nivelLabel = empleado.nivelId ? empleado.nivelId.toUpperCase() : "—";
  const paqueteLabel = empleado.paqueteId
    ? empleado.paqueteId === "basico"
      ? "Básico"
      : empleado.paqueteId.charAt(0).toUpperCase() + empleado.paqueteId.slice(1)
    : "—";

  return (
    <div
      ref={ref}
      className={
        presentacion
          ? "flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-none"
          : "overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md"
      }
    >
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col items-center justify-center gap-3 text-center sm:gap-4">
          <TacticalSupportLogo priority={presentacion} fallbacks={CAT_DASHBOARD_LOGO_FALLBACKS} />
          <div>
            <h1 className="text-lg font-extrabold uppercase tracking-[0.12em] text-slate-800 sm:text-2xl">
              Tactical Support
            </h1>
            <p className="mt-1 text-[10px] font-semibold text-slate-500 sm:text-xs">
              Dashboard de categorización · {fecha}
            </p>
          </div>
        </div>
      </div>

      <div
        className={
          presentacion
            ? "grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto xl:grid-cols-12 xl:overflow-hidden"
            : "grid grid-cols-1 gap-0 lg:grid-cols-12"
        }
      >
        <aside className="border-b border-slate-200 bg-white px-5 py-6 sm:px-6 sm:py-8 xl:col-span-3 xl:border-b-0 xl:border-r xl:overflow-y-auto">
          <p className="text-[10px] font-bold uppercase text-slate-500">Nombre</p>
          <p className="mt-1 text-sm font-extrabold uppercase leading-snug text-slate-900 sm:text-base">
            {empleado.nombre}
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">N° {empleado.noEmpleado}</p>

          <p className="mt-6 text-2xl font-light leading-tight text-slate-800 sm:text-3xl">{empleado.tiempoEnEmpresa}</p>
          <p className="text-[10px] font-bold uppercase text-slate-500">en la empresa</p>
          {empleado.fechaIngreso ? (
            <p className="mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">
              Desde {formatearFechaLegible(empleado.fechaIngreso)} a la fecha
            </p>
          ) : null}

          <dl className="mt-8 space-y-5">
            <Dato label="Edad" valor={empleado.edad || "—"} />
            <Dato label="Escolaridad" valor={empleado.escolaridad || "—"} />
            <Dato label="Servicio" valor={empleado.servicio} />
            <Dato label="Puesto" valor={empleado.puesto || "—"} />
          </dl>
        </aside>

        <section className="border-b border-slate-200 px-5 py-6 sm:px-6 sm:py-8 xl:col-span-5 xl:border-b-0 xl:border-r xl:overflow-y-auto">
          <h3 className="mb-4 text-center text-xs font-bold uppercase text-slate-700 sm:text-sm">
            Promedio por módulo (escala 1–5)
          </h3>
          <CatBarChartModulos
            presentacion={presentacion}
            capacitacion={empleado.promedioCapacitacion}
            operaciones={empleado.promedioOperaciones}
            enfoque={empleado.promedioEnfoque}
          />

          {empleado.faltasMesActual > 0 ? (
            <div className="mt-5 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-4">
              <p className="text-[10px] font-bold uppercase text-amber-950">
                Ausentismos — cuadrícula ({empleado.faltasMesYm || "mes actual"})
              </p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums text-amber-950">{empleado.faltasMesActual}</p>
              <p className="text-xs font-semibold uppercase text-amber-900">
                {empleado.faltasMesActual === 1 ? "falta registrada" : "faltas registradas"} en asistencia
              </p>
              {empleado.faltasMesDetalle ? (
                <p className="mt-2 text-[11px] font-medium leading-relaxed text-amber-950">{empleado.faltasMesDetalle}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="flex flex-col px-5 py-6 pb-8 sm:px-6 sm:py-8 sm:pb-10 xl:col-span-4 xl:overflow-y-auto xl:pb-10">
          <TablaNiveles activo={empleado.nivelId} />
          <div className="mt-5">
            <TablaPaquetes activo={empleado.paqueteId} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border-2 border-violet-400 bg-violet-50 px-4 py-4 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-600">Paquete de prestaciones</p>
              <p className="mt-2 text-xl font-extrabold uppercase text-violet-950 sm:text-2xl">{paqueteLabel}</p>
            </div>
            <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-4 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-600">Nivel</p>
              <p className="mt-2 text-xl font-extrabold uppercase text-amber-950 sm:text-2xl">{nivelLabel}</p>
            </div>
          </div>

          {empleado.promedioGeneral != null ? (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-center">
              <p className="text-[11px] font-bold uppercase text-slate-600">Promedio general (4 módulos)</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
                {empleado.promedioGeneral.toFixed(2)}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
});

function formatearFechaLegible(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  try {
    return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return ymd;
  }
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold uppercase text-slate-900">{valor}</dd>
    </div>
  );
}

function TablaNiveles({ activo }: { activo: CatNivelId | null }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-[10px] font-bold uppercase text-slate-600">Nivel</p>
      <table className="w-full min-w-[200px] border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-[10px] font-bold uppercase">
            <th className="border border-slate-300 px-2 py-1.5 text-left">Nivel</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Promedio</th>
          </tr>
        </thead>
        <tbody>
          {CAT_NIVEL_REGLAS.map((r) => {
            const sel = activo === r.id;
            return (
              <tr key={r.id} className={sel ? "bg-amber-100 font-bold" : ""}>
                <td className="border border-slate-300 px-2 py-1.5 uppercase">{r.label}</td>
                <td className="border border-slate-300 px-2 py-1.5">{r.rango}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TablaPaquetes({ activo }: { activo: CatPaqueteId | null }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-[10px] font-bold uppercase text-slate-600">Paquete de prestaciones</p>
      <table className="w-full min-w-[280px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-100 text-[10px] font-bold uppercase">
            <th className="border border-slate-300 px-2 py-1.5 text-left">Paquete</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Promedio</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Incluye</th>
          </tr>
        </thead>
        <tbody>
          {CAT_PAQUETE_REGLAS.map((r) => {
            const sel = activo === r.id;
            return (
              <tr key={r.id} className={sel ? "bg-violet-100 font-bold" : ""}>
                <td className="border border-slate-300 px-2 py-1.5 uppercase">{r.label}</td>
                <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap">{r.rango}</td>
                <td className="border border-slate-300 px-2 py-1.5 leading-snug text-slate-700">{r.incluye}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
