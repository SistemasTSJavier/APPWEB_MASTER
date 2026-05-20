"use client";

import { useState } from "react";
import type { AniversarioEmpresaSemana } from "@/lib/aniversario-empresa-semana";
import type { CumpleaneroMes } from "@/lib/cumpleanos-mes";

type Props = {
  cumpleaneros: CumpleaneroMes[];
  aniversarios: AniversarioEmpresaSemana[];
  mesEtiqueta: string;
};

type TabId = "cumpleanos" | "aniversarios";

function textoDiasHasta(dias: number): string {
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

export function HomeCelebracionesSection({ cumpleaneros, aniversarios, mesEtiqueta }: Props) {
  const hayCumple = cumpleaneros.length > 0;
  const hayAniv = aniversarios.length > 0;
  const [tab, setTab] = useState<TabId>(hayCumple ? "cumpleanos" : "aniversarios");

  return (
    <details
      open
      className="group relative mt-4 overflow-hidden rounded-xl border border-slate-300/90 bg-white shadow-md shadow-slate-900/[0.06]"
    >
      <summary className="cursor-pointer list-none px-4 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-800">Apartado</p>
            <h2 className="mt-1 text-base font-extrabold uppercase tracking-wide text-slate-900 sm:text-lg">
              Cumpleaños y aniversarios
            </h2>
            <p className="mt-1 text-xs font-semibold uppercase leading-snug text-slate-600 sm:text-[13px]">
              {mesEtiqueta} · cumpleaños de hoy al fin del mes · aniversarios laborales próximos 7 días
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hayCumple ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-900">
                {cumpleaneros.length} cumpleaños
              </span>
            ) : null}
            {hayAniv ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-900">
                {aniversarios.length} aniversarios
              </span>
            ) : null}
            <span
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-500 transition group-open:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </div>
        </div>
      </summary>

      <div className="border-t border-slate-200">
        {!hayCumple && !hayAniv ? (
          <p className="px-4 py-8 text-center text-sm font-medium text-slate-500 sm:px-6">
            No hay cumpleaños ni aniversarios laborales próximos en este periodo.
          </p>
        ) : (
          <>
            {hayCumple && hayAniv ? (
              <div className="flex border-b border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setTab("cumpleanos")}
                  className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide transition sm:text-sm ${
                    tab === "cumpleanos"
                      ? "border-b-2 border-amber-500 bg-white text-amber-900"
                      : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <span aria-hidden>🎂</span>
                  Cumpleaños ({cumpleaneros.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("aniversarios")}
                  className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide transition sm:text-sm ${
                    tab === "aniversarios"
                      ? "border-b-2 border-emerald-500 bg-white text-emerald-900"
                      : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <span aria-hidden>🏢</span>
                  Aniversario empresa ({aniversarios.length})
                </button>
              </div>
            ) : (
              <p className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                {hayCumple ? "Cumpleaños de hoy al fin del mes" : "Próximos aniversarios en Tactical Support"}
              </p>
            )}

            <div className="max-h-[min(28rem,50vh)] overflow-auto bg-gradient-to-b from-slate-50/80 to-white">
              {tab === "cumpleanos" && hayCumple ? (
                <ul className="divide-y divide-amber-100/80">
                  {cumpleaneros.map((r) => (
                    <li
                      key={`${r.nombre}-${r.fechaCumpleanos}`}
                      className="flex flex-col gap-2 px-4 py-3.5 transition hover:bg-amber-50/50 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-lg shadow-sm">
                        🎂
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900">{r.nombre}</p>
                        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                          {r.servicio}
                        </p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-sm font-semibold capitalize text-slate-800">{r.fechaCumpleanos}</p>
                        <p className="text-xs text-slate-500">{r.puesto}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {tab === "aniversarios" && hayAniv ? (
                <ul className="divide-y divide-emerald-100/80">
                  {aniversarios.map((r) => (
                    <li
                      key={`${r.nombre}-${r.fechaAniversario}`}
                      className="flex flex-col gap-2 px-4 py-3.5 transition hover:bg-emerald-50/50 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-200 to-teal-400 text-lg shadow-sm">
                        🏢
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900">{r.nombre}</p>
                        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                          {r.servicio}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">Ingreso: {r.fechaIngreso}</p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-sm font-semibold text-emerald-900">{r.fechaAniversario}</p>
                        <p className="text-xs font-medium text-slate-600">
                          {textoDiasHasta(r.diasHasta)} ·{" "}
                          {r.anosEnEmpresa === 1 ? "1 año en Tactical" : `${r.anosEnEmpresa} años en Tactical`}
                        </p>
                        <p className="text-xs text-slate-500">{r.puesto}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
