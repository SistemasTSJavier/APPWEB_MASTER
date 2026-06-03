"use client";

import { CAT_ESCALA_MAX, CAT_ESCALA_MIN } from "@/lib/categorizacion-calificaciones";

const BARRAS = [
  { key: "op", label: "Operativa", color: "#5b9bd5", valorKey: "operaciones" as const },
  { key: "cap", label: "Capacitación", color: "#2e5090", valorKey: "capacitacion" as const },
  { key: "enf", label: "Enfoque al cliente", color: "#ed7d31", valorKey: "enfoque" as const },
];

const ESCALA_LEYENDA = [
  { n: 1, label: "No cumple con el estandar", color: "#fff2cc" },
  { n: 2, label: "Regular", color: "#fce4d6" },
  { n: 3, label: "Bueno", color: "#f8cbad" },
  { n: 4, label: "Muy bueno", color: "#f4b183" },
  { n: 5, label: "Excelente", color: "#c65911", text: "text-white" },
];

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
  const chartH = presentacion ? "min-h-[220px] sm:min-h-[280px]" : "min-h-[200px]";
  const barAreaH = presentacion ? "h-36 sm:h-44 md:h-52" : "h-40 sm:h-44";

  return (
    <div className={`flex flex-col ${chartH}`}>
      <div className="-mx-1 overflow-x-auto pb-2">
        <table className="mb-3 w-full min-w-[480px] border-collapse text-[8px] font-bold uppercase sm:text-[9px]">
          <thead>
            <tr>
              {ESCALA_LEYENDA.map((e) => (
                <th
                  key={e.n}
                  className={`border border-slate-300 px-0.5 py-1 text-center leading-tight ${e.text ?? "text-slate-800"} ${e.n === 1 ? "text-[7px] sm:text-[8px]" : ""}`}
                  style={{ backgroundColor: e.color }}
                  title={e.label}
                >
                  {e.n} = {e.label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      <div
        className={`relative flex flex-1 items-end justify-center gap-4 border-b border-l border-slate-300 pb-10 pl-8 pr-3 pt-3 sm:gap-8 sm:pb-12 ${barAreaH}`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="pointer-events-none absolute left-8 right-0 border-t border-dashed border-slate-200"
            style={{ bottom: `${(n / max) * 72 + 12}%` }}
            aria-hidden
          />
        ))}
        <div className="absolute bottom-2 left-0 top-2 flex w-6 flex-col justify-between text-[10px] font-bold text-slate-500">
          <span>{max}</span>
          <span>{CAT_ESCALA_MIN}</span>
        </div>

        {BARRAS.map((b) => {
          const valor = map[b.valorKey];
          return (
            <div key={b.key} className="flex min-w-[56px] max-w-[120px] flex-1 flex-col items-center justify-end">
              <span className="mb-2 text-base font-extrabold tabular-nums text-slate-900 sm:text-lg">
                {valor != null ? valor.toFixed(1) : "—"}
              </span>
              <div className={`flex w-full max-w-[72px] items-end justify-center ${presentacion ? "h-32 sm:h-40" : "h-28 sm:h-36"}`}>
                <div
                  className="w-[70%] max-w-[56px] rounded-t-sm shadow-sm"
                  style={{
                    height: valor != null ? `${(valor / max) * 100}%` : "4%",
                    backgroundColor: valor != null ? b.color : "#cbd5e1",
                    minHeight: valor != null ? 8 : 4,
                  }}
                />
              </div>
              <span className="mt-3 text-center text-[9px] font-bold uppercase leading-tight text-slate-800 sm:text-[10px]">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3 pb-1 text-[10px] font-bold uppercase sm:gap-4">
        {BARRAS.map((b) => (
          <span key={b.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
