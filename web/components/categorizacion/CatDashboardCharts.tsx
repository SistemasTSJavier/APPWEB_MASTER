"use client";

import { CAT_ESCALA_MAX, CAT_ESCALA_MIN } from "@/lib/categorizacion-calificaciones";

const BARRAS = [
  { key: "op", label: "Operativa", valorKey: "operaciones" as const },
  { key: "cap", label: "Capacitación", valorKey: "capacitacion" as const },
  { key: "enf", label: "Enfoque al cliente", valorKey: "enfoque" as const },
] as const;

/** Escala 1–5: rojo → naranja → amarillo → verde limón → verde. */
export const ESCALA_PUNTAJE_CAT = [
  { n: 1, label: "No cumple con el estandar", short: "No cumple", color: "#dc2626", text: "text-white" },
  { n: 2, label: "Regular", short: "Regular", color: "#f97316", text: "text-white" },
  { n: 3, label: "Bueno", short: "Bueno", color: "#facc15", text: "text-slate-900" },
  { n: 4, label: "Muy bueno", short: "Muy bueno", color: "#a3e635", text: "text-slate-900" },
  { n: 5, label: "Excelente", short: "Excelente", color: "#16a34a", text: "text-white" },
] as const;

export function colorPuntajeCategorizacion(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return "#cbd5e1";
  const clamped = Math.max(CAT_ESCALA_MIN, Math.min(CAT_ESCALA_MAX, valor));
  const bucket = Math.min(CAT_ESCALA_MAX, Math.max(CAT_ESCALA_MIN, Math.round(clamped)));
  return ESCALA_PUNTAJE_CAT.find((e) => e.n === bucket)?.color ?? "#94a3b8";
}

export function CatBarChartModulos({
  capacitacion,
  operaciones,
  enfoque,
  presentacion = false,
  capacitacionActiva = false,
  onClickCapacitacion,
}: {
  capacitacion: number | null;
  operaciones: number | null;
  enfoque: number | null;
  presentacion?: boolean;
  /** Resalta la barra de Capacitación cuando el kardex está abierto. */
  capacitacionActiva?: boolean;
  onClickCapacitacion?: () => void;
}) {
  const map = { capacitacion, operaciones, enfoque };
  const max = CAT_ESCALA_MAX;

  /** En presentación: ~mitad de altura para dejar espacio a faltas/bonos/etc. */
  const barAreaH = presentacion
    ? "h-[7.5rem] sm:h-[8.5rem]"
    : "h-28 sm:h-32 lg:h-36";

  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col">
      <div className="mb-1.5 grid shrink-0 grid-cols-5 gap-0.5">
        {ESCALA_PUNTAJE_CAT.map((e) => (
          <div
            key={e.n}
            className={`rounded-sm border border-slate-400/40 px-0.5 py-1 text-center text-[7px] font-bold uppercase leading-tight shadow-sm sm:text-[8px] ${e.text}`}
            style={{ backgroundColor: e.color }}
            title={`${e.n} = ${e.label}`}
          >
            <span className="block tabular-nums">{e.n}</span>
            <span className="mt-0.5 block truncate font-semibold normal-case tracking-tight opacity-95">
              <span className="hidden sm:inline">{e.short}</span>
              <span className="sm:hidden">{e.n}</span>
            </span>
          </div>
        ))}
      </div>

      <div
        className={`relative flex w-full min-w-0 items-end justify-around gap-1 overflow-hidden border-b border-l border-slate-300 px-1 pb-7 pt-1.5 sm:gap-2 sm:px-2 sm:pb-8 ${barAreaH}`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="pointer-events-none absolute left-5 right-0 border-t border-dashed border-slate-200 sm:left-6"
            style={{ bottom: `${((n - CAT_ESCALA_MIN) / (max - CAT_ESCALA_MIN)) * 58 + 20}%` }}
            aria-hidden
          />
        ))}
        <div className="absolute bottom-1 left-0 top-1 flex w-4 flex-col justify-between text-[8px] font-bold text-slate-500 sm:w-5 sm:text-[10px]">
          <span>{max}</span>
          <span>{CAT_ESCALA_MIN}</span>
        </div>

        {BARRAS.map((b) => {
          const valor = map[b.valorKey];
          const barColor = colorPuntajeCategorizacion(valor);
          const pct =
            valor != null
              ? Math.max(8, ((valor - CAT_ESCALA_MIN) / (max - CAT_ESCALA_MIN)) * 100)
              : 4;
          const esCap = b.key === "cap";
          const clickable = esCap && Boolean(onClickCapacitacion);
          const activa = esCap && capacitacionActiva;

          const inner = (
            <>
              <span className="mb-0.5 shrink-0 text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
                {valor != null ? valor.toFixed(1) : "—"}
              </span>
              <div
                className={`flex w-full max-w-[3rem] items-end justify-center sm:max-w-[3.25rem] ${
                  presentacion ? "h-[4.25rem] sm:h-[5rem]" : "h-16 sm:h-20 lg:h-24"
                }`}
              >
                <div
                  className={`w-[65%] max-w-[2.5rem] rounded-t-sm shadow-md ring-1 ring-black/10 ${
                    activa ? "ring-2 ring-violet-600" : ""
                  }`}
                  style={{
                    height: `${pct}%`,
                    backgroundColor: barColor,
                    minHeight: valor != null ? 8 : 3,
                  }}
                />
              </div>
              <span
                className={`mt-1 shrink-0 text-center text-[8px] font-bold uppercase leading-tight sm:text-[9px] ${
                  activa ? "text-violet-800" : "text-slate-800"
                }`}
              >
                {b.label}
                {clickable ? (
                  <span className="mt-0.5 block text-[7px] font-semibold normal-case text-violet-700">
                    {activa ? "ocultar" : "ver kardex"}
                  </span>
                ) : null}
              </span>
            </>
          );

          if (clickable) {
            return (
              <button
                key={b.key}
                type="button"
                className={`flex h-full min-w-0 max-w-[7rem] flex-1 flex-col items-center justify-end px-0.5 rounded-md transition hover:bg-violet-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  activa ? "bg-violet-50" : ""
                }`}
                onClick={onClickCapacitacion}
                title="Ver capacitaciones del mes"
                aria-pressed={activa}
              >
                {inner}
              </button>
            );
          }

          return (
            <div
              key={b.key}
              className="flex h-full min-w-0 max-w-[7rem] flex-1 flex-col items-center justify-end px-0.5"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
