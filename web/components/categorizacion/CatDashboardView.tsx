"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
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
  const [mostrarCapacitaciones, setMostrarCapacitaciones] = useState(false);
  const capacitaciones = empleado.capacitaciones ?? [];

  useEffect(() => {
    setMostrarCapacitaciones(false);
  }, [empleado.noEmpleado]);

  const nivelLabel = empleado.nivelId ? empleado.nivelId.toUpperCase() : "—";
  const paqueteLabel = empleado.paqueteId
    ? empleado.paqueteId === "basico"
      ? "Básico"
      : empleado.paqueteId.charAt(0).toUpperCase() + empleado.paqueteId.slice(1)
    : "—";

  const pad = presentacion ? "p-2.5 sm:p-3 lg:p-3.5" : "p-3 sm:p-3.5 lg:p-4";

  return (
    <div
      ref={ref}
      data-cat-dashboard="true"
      className={
        presentacion
          ? "flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden bg-white"
          : "min-w-0 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md"
      }
    >
      <CatDashboardBanner
        servicio={empleado.servicio}
        logoClienteUrl={logoServicioUrl}
        puedeSubirLogo={puedeSubirLogo}
        onLogoActualizado={onLogoServicioActualizado}
        presentacion={presentacion}
      />

      {/*
        Estructura fija: 3 columnas en escritorio / presentación.
        En móvil se apilan. Nunca se manda la 3ª columna a ancho completo bajo la gráfica.
      */}
      <div
        data-cat-export-expand
        className={
          presentacion
            ? "grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,26%)_minmax(0,40%)_minmax(0,34%)]"
            : "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,26%)_minmax(0,40%)_minmax(0,34%)]"
        }
      >
        {/* Columna 1: perfil + ranking */}
        <aside
          data-cat-export-expand
          className={`min-h-0 min-w-0 border-b border-slate-200 bg-white lg:border-b-0 lg:border-r ${pad} ${
            presentacion ? "flex flex-col overflow-hidden" : "lg:overflow-y-auto"
          }`}
        >
          <div className="shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 pr-1">
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

            <p className="mt-2 text-base font-light leading-tight text-slate-800 sm:text-lg">
              {empleado.tiempoEnEmpresa}
            </p>
            <p className="text-[9px] font-bold uppercase text-slate-500">en la empresa</p>
            {empleado.fechaIngreso ? (
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                Desde {formatearFechaLegible(empleado.fechaIngreso)} a la fecha
              </p>
            ) : null}
          </div>

          <dl className="mt-2 grid shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 text-[10px] sm:text-[11px]">
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

        {/* Columna 2: gráfica (~mitad) + indicadores debajo */}
        <section
          className={`min-h-0 min-w-0 border-b border-slate-200 lg:border-b-0 lg:border-r ${pad} ${
            presentacion ? "flex flex-col overflow-hidden" : ""
          }`}
        >
          <h3 className="mb-1.5 shrink-0 text-center text-[10px] font-bold uppercase text-slate-700 sm:text-xs">
            Promedio por módulo (escala 1–5)
          </h3>
          <CatBarChartModulos
            presentacion={presentacion}
            capacitacion={empleado.promedioCapacitacion}
            operaciones={empleado.promedioOperaciones}
            enfoque={empleado.promedioEnfoque}
            capacitacionActiva={mostrarCapacitaciones}
            onClickCapacitacion={() => setMostrarCapacitaciones((v) => !v)}
          />

          <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto overscroll-contain sm:gap-2.5">
            <IndicadorCentro
              label="Faltas"
              valor={
                empleado.faltasMesActual > 0
                  ? String(empleado.faltasMesActual)
                  : "0"
              }
              detalle={
                empleado.faltasMesActual > 0
                  ? [
                      empleado.faltasMesDetalle,
                      empleado.faltasMesYm ? `Mes ${empleado.faltasMesYm}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  : empleado.faltasMesYm
                    ? `Mes anterior (${empleado.faltasMesYm}) · sin faltas`
                    : "Sin faltas en el mes anterior"
              }
              tono="amber"
            />
            <IndicadorCentro
              label="Bonos"
              valor={textoBonosValor(empleado.recompensas.bonos)}
              detalle={textoBonosDetalle(empleado.recompensas.bonos)}
              tono="sky"
            />
            <IndicadorCentro
              label="Empleado del mes"
              valor={textoEmpleadoMesValor(empleado.recompensas.empleadoDelMes)}
              detalle={textoEmpleadoMesDetalle(empleado.recompensas.empleadoDelMes)}
              tono="emerald"
            />
            <IndicadorCentro
              label="Reconocimientos"
              valor={textoReconocimientosValor(empleado.recompensas.reconocimientos)}
              detalle={textoReconocimientosDetalle(empleado.recompensas.reconocimientos)}
              tono="violet"
            />
          </div>

          {mostrarCapacitaciones ? (
            <KardexCapacitaciones items={capacitaciones} presentacion={presentacion} />
          ) : null}
        </section>

        {/* Columna 3: nivel + paquete + resumen */}
        <section
          className={`flex min-h-0 min-w-0 flex-col ${pad} ${
            presentacion ? "overflow-y-auto overscroll-contain" : "lg:overflow-y-auto"
          }`}
        >
          <TablaNiveles activo={empleado.nivelId} />
          <div className="mt-2.5">
            <TablaPaquetes activo={empleado.paqueteId} />
          </div>

          <div className="mt-auto grid shrink-0 grid-cols-2 gap-2 pt-3">
            <div className="rounded-lg border-2 border-violet-400 bg-violet-50 px-2 py-2.5 text-center">
              <p className="text-[8px] font-bold uppercase text-slate-600">Paquete</p>
              <p className="mt-0.5 text-sm font-extrabold uppercase text-violet-950 sm:text-base">{paqueteLabel}</p>
            </div>
            <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-2 py-2.5 text-center">
              <p className="text-[8px] font-bold uppercase text-slate-600">Nivel</p>
              <p className="mt-0.5 text-sm font-extrabold uppercase text-amber-950 sm:text-base">{nivelLabel}</p>
            </div>
          </div>

          {empleado.promedioGeneral != null ? (
            <div className="mt-2 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
              <p className="text-[9px] font-bold uppercase text-slate-600">Promedio general (4 módulos)</p>
              <p className="text-2xl font-extrabold tabular-nums text-slate-900 sm:text-3xl">
                {empleado.promedioGeneral.toFixed(2)}
              </p>
            </div>
          ) : null}
        </section>
      </div>
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

function textoBonosValor(items: { descripcion: string }[]): string {
  if (items.length === 0) return "—";
  if (items.length === 1) return items[0].descripcion || "1";
  return String(items.length);
}

function textoBonosDetalle(items: { descripcion: string; mesLabel: string }[]): string {
  if (items.length === 0) return "Sin bonos en el mes anterior";
  if (items.length === 1) return items[0].mesLabel;
  return items.map((i) => `${i.descripcion}${i.mesLabel ? ` (${i.mesLabel})` : ""}`).join(" · ");
}

function textoEmpleadoMesValor(items: { mesLabel: string }[]): string {
  if (items.length === 0) return "—";
  return items.map((i) => i.mesLabel).join(", ");
}

function textoEmpleadoMesDetalle(items: { descripcion: string }[]): string {
  if (items.length === 0) return "Sin registro en el mes anterior";
  const notas = items.map((i) => i.descripcion).filter(Boolean);
  return notas.length ? notas.join(" · ") : "Registrado";
}

function textoReconocimientosValor(items: { descripcion: string }[]): string {
  if (items.length === 0) return "—";
  if (items.length === 1) return items[0].descripcion || "1";
  return String(items.length);
}

function textoReconocimientosDetalle(items: { descripcion: string; mesLabel: string }[]): string {
  if (items.length === 0) return "Sin reconocimientos en el mes anterior";
  return items
    .map((i) => (i.descripcion ? `${i.descripcion} (${i.mesLabel})` : i.mesLabel))
    .join(" · ");
}

function DatoGrid({ label, valor }: { label: string; valor: string }) {
  return (
    <>
      <dt className="border-b border-r border-slate-200/80 bg-slate-100/90 px-1.5 py-1.5 font-bold uppercase text-slate-600">
        {label}
      </dt>
      <dd className="truncate border-b border-slate-200/80 px-1.5 py-1.5 font-semibold uppercase text-slate-900" title={valor}>
        {valor}
      </dd>
    </>
  );
}

function IndicadorCentro({
  label,
  valor,
  detalle,
  tono,
}: {
  label: string;
  valor: string;
  detalle?: string;
  tono: "amber" | "sky" | "emerald" | "violet";
}) {
  const estilos = {
    amber: "border-amber-400 bg-amber-50 text-amber-950",
    sky: "border-sky-300 bg-sky-50 text-sky-950",
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-950",
    violet: "border-violet-300 bg-violet-50 text-violet-950",
  }[tono];

  return (
    <div className={`rounded-lg border-2 px-2.5 py-2 ${estilos}`}>
      <p className="text-[8px] font-bold uppercase tracking-wide opacity-80 sm:text-[9px]">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold leading-snug capitalize sm:text-base">{valor}</p>
      {detalle ? (
        <p className="mt-1 line-clamp-2 text-[9px] font-medium leading-snug opacity-90 sm:text-[10px]">{detalle}</p>
      ) : null}
    </div>
  );
}

function KardexCapacitaciones({
  items,
  presentacion = false,
}: {
  items: CatDashboardEmpleado["capacitaciones"];
  presentacion?: boolean;
}) {
  return (
    <div
      className={`mt-2.5 shrink-0 rounded-lg border border-violet-200 bg-violet-50/60 ${
        presentacion ? "max-h-[7.5rem] overflow-y-auto" : "max-h-40 overflow-y-auto"
      }`}
    >
      <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b border-violet-200 bg-violet-100/90 px-2.5 py-1.5">
        <p className="text-[9px] font-bold uppercase text-violet-950 sm:text-[10px]">
          Kardex de capacitaciones ({items.length})
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-2.5 py-2.5 text-[10px] font-medium text-slate-600">
          Sin capacitaciones registradas en este mes.
        </p>
      ) : (
        <ul className="divide-y divide-violet-100">
          {items.map((c) => (
            <li key={c.id} className="px-2.5 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-[10px] font-bold uppercase leading-snug text-slate-900 sm:text-[11px]">
                  {c.cursoNombre}
                </p>
                <span className="shrink-0 font-mono text-[10px] font-extrabold tabular-nums text-violet-900 sm:text-[11px]">
                  {c.promedio != null
                    ? c.promedio.toFixed(1)
                    : c.desempeno != null
                      ? Number(c.desempeno).toFixed(1)
                      : "—"}
                </span>
              </div>
              {c.comentarios ? (
                <p className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-snug text-slate-600">
                  {c.comentarios}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const compacto = total > 10;

  return (
    <div
      data-cat-export-expand
      className={`mt-2 flex min-h-0 flex-col border-t border-slate-200 pt-2 ${
        presentacion ? "flex-1 overflow-hidden" : "max-h-[13rem] lg:max-h-[16rem]"
      }`}
    >
      <p className="shrink-0 text-[9px] font-bold uppercase text-slate-600">Ranking del servicio</p>
      <p className="mt-0.5 shrink-0 text-[8px] font-medium text-slate-500">
        Por promedio · ámbar &lt; {umbralBajo.toFixed(1)}
        {onSeleccionar ? " · clic para cambiar" : ""}
      </p>
      <ol
        data-cat-ranking-list
        className={`mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 ${
          compacto ? "space-y-0 text-[8px]" : "space-y-0.5 text-[9px] sm:text-[10px]"
        }`}
      >
        {ordenados.map((e, i) => {
          const rank = i + 1;
          const esActual = e.noEmpleado.trim().toUpperCase() === actualKey;
          const prom = e.promedioGeneral;
          const top = rank <= 3 && prom != null;
          const mejorar = prom != null && prom < umbralBajo;
          const dot = colorPuntajeCategorizacion(prom);
          const filaClass = `flex w-full items-center gap-1 rounded px-1 py-0.5 text-left ${
            esActual
              ? "bg-violet-100 font-bold text-violet-950 ring-1 ring-violet-300"
              : top
                ? "bg-emerald-50/80"
                : mejorar
                  ? "bg-amber-50/90"
                  : "hover:bg-slate-50"
          }`;
          const inner = (
            <>
              <span className="w-4 shrink-0 text-right font-mono font-bold tabular-nums text-slate-500">{rank}</span>
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: dot }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate uppercase leading-tight" title={e.nombre}>
                {e.nombre}
              </span>
              <span className="shrink-0 font-mono font-bold tabular-nums">
                {prom != null ? prom.toFixed(2) : "—"}
              </span>
            </>
          );
          return (
            <li key={e.noEmpleado}>
              {onSeleccionar ? (
                <button
                  type="button"
                  className={`${filaClass} cursor-pointer`}
                  onClick={() => onSeleccionar(e.noEmpleado)}
                  aria-current={esActual ? "true" : undefined}
                >
                  {inner}
                </button>
              ) : (
                <div className={filaClass}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-1 shrink-0 text-[8px] text-slate-500">
        {total} colaborador{total === 1 ? "" : "es"}
      </p>
    </div>
  );
}

function TablaNiveles({ activo }: { activo: CatNivelId | null }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[9px] font-bold uppercase text-slate-600">Nivel</p>
      <table className="w-full border-collapse text-[10px] sm:text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-[9px] font-bold uppercase">
            <th className="border border-slate-300 px-1.5 py-1 text-left">Nivel</th>
            <th className="border border-slate-300 px-1.5 py-1 text-left">Promedio</th>
          </tr>
        </thead>
        <tbody>
          {CAT_NIVEL_REGLAS.map((r) => (
            <tr key={r.id} className={activo === r.id ? "bg-amber-100 font-bold" : ""}>
              <td className="border border-slate-300 px-1.5 py-1 uppercase">{r.label}</td>
              <td className="border border-slate-300 px-1.5 py-1">{r.rango}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaPaquetes({ activo }: { activo: CatPaqueteId | null }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[9px] font-bold uppercase text-slate-600">Paquete de prestaciones</p>
      <table className="w-full table-fixed border-collapse text-[9px] sm:text-[10px]">
        <thead>
          <tr className="bg-slate-100 text-[9px] font-bold uppercase">
            <th className="w-[22%] border border-slate-300 px-1 py-1 text-left">Paquete</th>
            <th className="w-[24%] border border-slate-300 px-1 py-1 text-left">Promedio</th>
            <th className="border border-slate-300 px-1 py-1 text-left">Incluye</th>
          </tr>
        </thead>
        <tbody>
          {CAT_PAQUETE_REGLAS.map((r) => (
            <tr key={r.id} className={activo === r.id ? "bg-violet-100 font-bold" : ""}>
              <td className="border border-slate-300 px-1 py-1 uppercase">{r.label}</td>
              <td className="border border-slate-300 px-1 py-1 whitespace-nowrap">{r.rango}</td>
              <td className="border border-slate-300 px-1 py-1 leading-snug text-slate-700">{r.incluye}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
