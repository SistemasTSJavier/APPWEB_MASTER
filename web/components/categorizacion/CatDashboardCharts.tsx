"use client";

import { CAT_ESCALA_MAX, CAT_ESCALA_MIN } from "@/lib/categorizacion-calificaciones";

const BARRAS = [
  { key: "op", label: "Operativa", valorKey: "operaciones" as const },
  { key: "cap", label: "Capacitación", valorKey: "capacitacion" as const },
  { key: "enf", label: "Enfoque al cliente", valorKey: "enfoque" as const },
] as const;

/** Escala 1–5: rojo → naranja → amarillo → verde limón → verde. */
export const ESCALA_PUNTAJE_CAT = [
  { n: 1, label: "No cumple con el estandar", color: "#dc2626", text: "text-white" },
  { n: 2, label: "Regular", color: "#f97316", text: "text-white" },
  { n: 3, label: "Bueno", color: "#facc15", text: "text-slate-900" },
  { n: 4, label: "Muy bueno", color: "#a3e635", text: "text-slate-900" },
  { n: 5, label: "Excelente", color: "#16a34a", text: "text-white" },
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
}: {
  capacitacion: number | null;
  operaciones: number | null;
  enfoque: number | null;
  presentacion?: boolean;
}) {
  const map = { capacitacion, operaciones, enfoque };
  const max = CAT_ESCALA_MAX;
  const barAreaH = presentacion
    ? "h-[7.5rem] sm:h-36 md:h-40 [@media(max-height:800px)]:h-[6.5rem]"
    : "h-28 sm:h-32 lg:h-36";
  const barInnerH = presentacion
    ? "h-[5.5rem] sm:h-28 md:h-32 [@media(max-height:800px)]:h-24"
    : "h-20 sm:h-24 lg:h-28";

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 grid grid-cols-5 gap-0.5">
        {ESCALA_PUNTAJE_CAT.map((e) => (
          <div
            key={e.n}
            className={`rounded-sm border border-slate-400/40 px-0.5 py-1 text-center text-[7px] font-bold uppercase leading-tight shadow-sm sm:text-[8px] ${e.text}`}
            style={{ backgroundColor: e.color }}
            title={`${e.n} = ${e.label}`}
          >
            <span className="block tabular-nums">{e.n}</span>
            <span className="mt-0.5 block line-clamp-2 font-semibold normal-case tracking-tight opacity-95">
              {e.label}
            </span>
          </div>
        ))}
      </div>

      <div
        className={`relative flex items-end justify-center gap-2 border-b border-l border-slate-300 pb-8 pl-6 pr-2 pt-2 sm:gap-4 sm:pb-9 sm:pl-7 ${barAreaH}`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="pointer-events-none absolute left-6 right-0 border-t border-dashed border-slate-200 sm:left-7"
            style={{ bottom: `${(n / max) * 72 + 12}%` }}
            aria-hidden
          />
        ))}
        <div className="absolute bottom-1.5 left-0 top-1.5 flex w-5 flex-col justify-between text-[9px] font-bold text-slate-500 sm:w-6 sm:text-[10px]">
          <span>{max}</span>
          <span>{CAT_ESCALA_MIN}</span>
        </div>

        {BARRAS.map((b) => {
          const valor = map[b.valorKey];
          const barColor = colorPuntajeCategorizacion(valor);
          return (
            <div key={b.key} className="flex min-w-0 max-w-[6.5rem] flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
                {valor != null ? valor.toFixed(1) : "—"}
              </span>
              <div className={`flex w-full max-w-[3.5rem] items-end justify-center sm:max-w-[4rem] ${barInnerH}`}>
                <div
                  className="w-[70%] max-w-[2.75rem] rounded-t-sm shadow-md ring-1 ring-black/10"
                  style={{
                    height: valor != null ? `${(valor / max) * 100}%` : "4%",
                    backgroundColor: barColor,
                    minHeight: valor != null ? 8 : 4,
                  }}
                />
              </div>
              <span className="mt-1.5 text-center text-[8px] font-bold uppercase leading-tight text-slate-800 sm:text-[9px]">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
