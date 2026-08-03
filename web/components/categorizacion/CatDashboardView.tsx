"use client";

import { forwardRef, useMemo } from "react";
import type { CatDashboardEmpleado } from "@/lib/categorizacion-dashboard-types";
import type { CatNivelId, CatPaqueteId } from "@/lib/categorizacion-calificaciones";
import { CAT_NIVEL_REGLAS, CAT_PAQUETE_REGLAS } from "@/lib/categorizacion-calificaciones";
import { CatBarChartModulos, colorPuntajeCategorizacion } from "@/components/categorizacion/CatDashboardCharts";
import { CatDashboardBanner } from "@/components/categorizacion/CatDashboardBanner";
import { CatOficialFoto } from "@/components/categorizacion/CatOficialFoto";

export const CatDashboardView = forwardRef<
  HTMLDivElement,
  {
    empleado: CatDashboardEmpleado;
    generadoEn: string;
    presentacion?: boolean;
    rankingServicio?: CatDashboardEmpleado[];
    onSeleccionarColaborador?: (noEmpleado: string) => void;
    puedeSubirFoto?: boolean;
    onFotoActualizada?: (noEmpleado: string, url: string) => void;
    logoServicioUrl?: string | null;
    puedeSubirLogo?: boolean;
    onLogoServicioActualizado?: (url: string | null) => void;
  }
>(function CatDashboardView(
  {
    empleado,
    generadoEn,
    presentacion = false,
    rankingServicio,
    onSeleccionarColaborador,
    puedeSubirFoto = false,
    onFotoActualizada,
    logoServicioUrl = null,
    puedeSubirLogo = false,
    onLogoServicioActualizado,
  },
  ref,
) {
  const nivelLabel = empleado.nivelId ? empleado.nivelId.toUpperCase() : "—";
  const paqueteLabel = empleado.paqueteId
    ? empleado.paqueteId === "basico"
      ? "Básico"
      : empleado.paqueteId.charAt(0).toUpperCase() + empleado.paqueteId.slice(1)
    : "—";

  const pad = presentacion
    ? "px-3 py-3 sm:px-4 sm:py-4 [@media(max-height:800px)]:px-2.5 [@media(max-height:800px)]:py-2.5"
    : "px-3 py-3 sm:px-4 sm:py-4";

  return (
    <div
      ref={ref}
      data-cat-dashboard="true"
      className={
        presentacion
          ? "flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-none"
          : "overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md"
      }
    >
      <CatDashboardBanner
        servicio={empleado.servicio}
        logoClienteUrl={logoServicioUrl}
        puedeSubirLogo={puedeSubirLogo}
        onLogoActualizado={onLogoServicioActualizado}
        presentacion={presentacion}
      />

      <div
        data-cat-export-expand
        className={
          presentacion
            ? "grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-12 lg:overflow-hidden"
            : "grid grid-cols-1 gap-0 lg:grid-cols-12"
        }
      >
        <aside
          data-cat-export-expand
          className={`border-b border-slate-200 bg-white lg:col-span-3 lg:border-b-0 lg:border-r ${pad} ${
            presentacion ? "flex min-h-0 flex-col lg:overflow-hidden" : "lg:overflow-y-auto"
          }`}
        >
          <div className={presentacion ? "shrink-0" : undefined}>
            <div className="flex flex-nowrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-col justify-center pr-1">
                <p className="text-[9px] font-bold uppercase text-slate-500 sm:text-[10px]">Nombre</p>
                <p className="mt-0.5 text-xs font-extrabold uppercase leading-snug text-slate-900 sm:text-sm">
                  {empleado.nombre}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500 sm:text-xs">N° {empleado.noEmpleado}</p>
              </div>
              <CatOficialFoto
                noEmpleado={empleado.noEmpleado}
                nombre={empleado.nombre}
                fotoUrl={empleado.fotoUrl}
                puedeSubir={puedeSubirFoto}
                presentacion={presentacion}
                onActualizada={(url) => onFotoActualizada?.(empleado.noEmpleado, url)}
              />
            </div>

            <p className="mt-3 text-base font-light leading-tight text-slate-800 sm:text-lg">{empleado.tiempoEnEmpresa}</p>
            <p className="text-[9px] font-bold uppercase text-slate-500 sm:text-[10px]">en la empresa</p>
            {empleado.fechaIngreso ? (
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 sm:text-[11px]">
                Desde {formatearFechaLegible(empleado.fechaIngreso)} a la fecha
              </p>
            ) : null}
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-0 gap-y-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 text-[10px] sm:text-[11px]">
            <DatoGrid label="Edad" valor={empleado.edad || "—"} />
            <DatoGrid label="Escolaridad" valor={empleado.escolaridad || "—"} />
            <DatoGrid label="Servicio" valor={empleado.servicio} />
            <DatoGrid label="Puesto" valor={empleado.puesto || "—"} />
          </dl>

          {rankingServicio && rankingServicio.length > 1 ? (
            <RankingServicio
              actual={empleado.noEmpleado}
              lista={rankingServicio}
              onSeleccionar={onSeleccionarColaborador}
              presentacion={presentacion}
            />
          ) : null}
        </aside>

        <section
          className={`border-b border-slate-200 lg:col-span-5 lg:border-b-0 lg:border-r lg:overflow-y-auto ${pad}`}
        >
          <h3 className="mb-2 text-center text-[10px] font-bold uppercase text-slate-700 sm:mb-3 sm:text-xs">
            Promedio por módulo (escala 1–5)
          </h3>
          <CatBarChartModulos
            presentacion={presentacion}
            capacitacion={empleado.promedioCapacitacion}
            operaciones={empleado.promedioOperaciones}
            enfoque={empleado.promedioEnfoque}
          />

          {empleado.faltasMesActual > 0 ? (
            <div className="mt-3 rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase text-amber-950 sm:text-[10px]">
                Ausentismos — cuadrícula ({empleado.faltasMesYm || "mes actual"})
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-950">{empleado.faltasMesActual}</p>
              <p className="text-[10px] font-semibold uppercase text-amber-900 sm:text-xs">
                {empleado.faltasMesActual === 1 ? "falta registrada" : "faltas registradas"} en asistencia
              </p>
              {empleado.faltasMesDetalle ? (
                <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-amber-950 sm:text-[11px]">
                  {empleado.faltasMesDetalle}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={`flex flex-col lg:col-span-4 lg:overflow-y-auto ${pad}`}>
          <TablaNiveles activo={empleado.nivelId} />
          <div className="mt-3">
            <TablaPaquetes activo={empleado.paqueteId} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border-2 border-violet-400 bg-violet-50 px-2.5 py-2.5 text-center sm:px-3">
              <p className="text-[8px] font-bold uppercase text-slate-600 sm:text-[9px]">Paquete de prestaciones</p>
              <p className="mt-1 text-sm font-extrabold uppercase text-violet-950 sm:text-base lg:text-lg">
                {paqueteLabel}
              </p>
            </div>
            <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-2.5 py-2.5 text-center sm:px-3">
              <p className="text-[8px] font-bold uppercase text-slate-600 sm:text-[9px]">Nivel</p>
              <p className="mt-1 text-sm font-extrabold uppercase text-amber-950 sm:text-base lg:text-lg">
                {nivelLabel}
              </p>
            </div>
          </div>

          {empleado.promedioGeneral != null ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
              <p className="text-[9px] font-bold uppercase text-slate-600 sm:text-[10px]">
                Promedio general (4 módulos)
              </p>
              <p className="mt-0.5 text-xl font-extrabold tabular-nums text-slate-900 sm:text-2xl">
                {empleado.promedioGeneral.toFixed(2)}
              </p>
            </div>
          ) : null}
        </section>
      </div>
      {/* generadoEn reserved for export metadata */}
      <span className="sr-only">{generadoEn}</span>
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

function DatoGrid({ label, valor }: { label: string; valor: string }) {
  return (
    <>
      <dt className="border-b border-r border-slate-200/80 bg-slate-100/90 px-1.5 py-1.5 font-bold uppercase text-slate-600 sm:px-2">
        {label}
      </dt>
      <dd className="truncate border-b border-slate-200/80 px-1.5 py-1.5 font-semibold uppercase text-slate-900 sm:px-2" title={valor}>
        {valor}
      </dd>
    </>
  );
}

function RankingServicio({
  actual,
  lista,
  onSeleccionar,
  presentacion = false,
}: {
  actual: string;
  lista: CatDashboardEmpleado[];
  onSeleccionar?: (noEmpleado: string) => void;
  presentacion?: boolean;
}) {
  const actualKey = actual.trim().toUpperCase();
  const ordenados = useMemo(
    () =>
      [...lista].sort((a, b) => {
        const pa = a.promedioGeneral ?? -1;
        const pb = b.promedioGeneral ?? -1;
        if (pb !== pa) return pb - pa;
        return a.nombre.localeCompare(b.nombre, "es");
      }),
    [lista],
  );
  const total = ordenados.length;
  const umbralBajo = 3;
  const compacto = total > 12;

  return (
    <div
      data-cat-export-expand
      className={`mt-3 flex min-h-0 flex-col border-t border-slate-200 pt-3 ${
        presentacion ? "flex-1" : "max-h-[14rem] lg:max-h-[18rem]"
      }`}
    >
      <p className="shrink-0 text-[9px] font-bold uppercase text-slate-600 sm:text-[10px]">Ranking del servicio</p>
      <p className="mt-0.5 shrink-0 text-[8px] font-medium text-slate-500 sm:text-[9px]">
        Por promedio general · ámbar: puede mejorar (&lt; {umbralBajo.toFixed(1)})
        {onSeleccionar ? " · clic para ver dashboard" : ""}
      </p>
      <ol
        data-cat-ranking-list
        className={`mt-1.5 min-h-0 flex-1 overflow-y-auto pr-0.5 ${
          compacto ? "space-y-0 text-[8px] sm:text-[9px]" : "space-y-0.5 text-[9px] sm:text-[10px]"
        }`}
      >
        {ordenados.map((e, i) => {
          const rank = i + 1;
          const esActual = e.noEmpleado.trim().toUpperCase() === actualKey;
          const prom = e.promedioGeneral;
          const top = rank <= 3 && prom != null;
          const mejorar = prom != null && prom < umbralBajo;
          const dot = colorPuntajeCategorizacion(prom);
          const filaClass = `flex w-full items-center gap-1 rounded-md px-1 text-left ${
            compacto ? "py-0.5" : "py-0.5 sm:py-1"
          } ${
            esActual
              ? "bg-violet-100 font-bold text-violet-950 ring-1 ring-violet-300"
              : top
                ? "bg-emerald-50/80"
                : mejorar
                  ? "bg-amber-50/90"
                  : "hover:bg-slate-50"
          }`;
          return (
            <li key={e.noEmpleado}>
              {onSeleccionar ? (
                <button
                  type="button"
                  className={`${filaClass} cursor-pointer transition-colors hover:ring-1 hover:ring-violet-200`}
                  onClick={() => onSeleccionar(e.noEmpleado)}
                  aria-current={esActual ? "true" : undefined}
                  aria-label={`Ver dashboard de ${e.nombre}, posición ${rank}`}
                >
                  <span className="w-4 shrink-0 text-right font-mono font-bold tabular-nums text-slate-500 sm:w-5">
                    {rank}
                  </span>
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-black/10 sm:h-2 sm:w-2"
                    style={{ backgroundColor: dot }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate uppercase leading-tight" title={e.nombre}>
                    {e.nombre}
                  </span>
                  <span className="shrink-0 font-mono font-bold tabular-nums">
                    {prom != null ? prom.toFixed(2) : "—"}
                  </span>
                </button>
              ) : (
                <div className={filaClass}>
                  <span className="w-4 shrink-0 text-right font-mono font-bold tabular-nums text-slate-500 sm:w-5">
                    {rank}
                  </span>
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-black/10 sm:h-2 sm:w-2"
                    style={{ backgroundColor: dot }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate uppercase leading-tight" title={e.nombre}>
                    {e.nombre}
                  </span>
                  <span className="shrink-0 font-mono font-bold tabular-nums">
                    {prom != null ? prom.toFixed(2) : "—"}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 shrink-0 text-[8px] text-slate-500 sm:text-[9px]">
        {total} colaborador{total === 1 ? "" : "es"} en el servicio
      </p>
    </div>
  );
}

function TablaNiveles({ activo }: { activo: CatNivelId | null }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <p className="mb-1.5 text-[9px] font-bold uppercase text-slate-600 sm:text-[10px]">Nivel</p>
      <table className="w-full border-collapse text-[10px] sm:text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-[9px] font-bold uppercase sm:text-[10px]">
            <th className="border border-slate-300 px-1.5 py-1 text-left sm:px-2 sm:py-1.5">Nivel</th>
            <th className="border border-slate-300 px-1.5 py-1 text-left sm:px-2 sm:py-1.5">Promedio</th>
          </tr>
        </thead>
        <tbody>
          {CAT_NIVEL_REGLAS.map((r) => {
            const sel = activo === r.id;
            return (
              <tr key={r.id} className={sel ? "bg-amber-100 font-bold" : ""}>
                <td className="border border-slate-300 px-1.5 py-1 uppercase sm:px-2 sm:py-1.5">{r.label}</td>
                <td className="border border-slate-300 px-1.5 py-1 sm:px-2 sm:py-1.5">{r.rango}</td>
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
    <div className="min-w-0 overflow-x-auto">
      <p className="mb-1.5 text-[9px] font-bold uppercase text-slate-600 sm:text-[10px]">Paquete de prestaciones</p>
      <table className="w-full border-collapse text-[9px] sm:text-[10px]">
        <thead>
          <tr className="bg-slate-100 text-[9px] font-bold uppercase sm:text-[10px]">
            <th className="border border-slate-300 px-1.5 py-1 text-left sm:px-2 sm:py-1.5">Paquete</th>
            <th className="border border-slate-300 px-1.5 py-1 text-left sm:px-2 sm:py-1.5">Promedio</th>
            <th className="border border-slate-300 px-1.5 py-1 text-left sm:px-2 sm:py-1.5">Incluye</th>
          </tr>
        </thead>
        <tbody>
          {CAT_PAQUETE_REGLAS.map((r) => {
            const sel = activo === r.id;
            return (
              <tr key={r.id} className={sel ? "bg-violet-100 font-bold" : ""}>
                <td className="border border-slate-300 px-1.5 py-1 uppercase sm:px-2 sm:py-1.5">{r.label}</td>
                <td className="whitespace-nowrap border border-slate-300 px-1.5 py-1 sm:px-2 sm:py-1.5">{r.rango}</td>
                <td className="border border-slate-300 px-1.5 py-1 leading-snug text-slate-700 sm:px-2 sm:py-1.5">
                  {r.incluye}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
