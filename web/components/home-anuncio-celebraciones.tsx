"use client";

import { useEffect, useMemo, useState } from "react";
import type { AniversarioEmpresaSemana } from "@/lib/aniversario-empresa-semana";
import type { CumpleaneroMes } from "@/lib/cumpleanos-mes";

type Props = {
  cumpleaneros: CumpleaneroMes[];
  aniversarios: AniversarioEmpresaSemana[];
  mesEtiqueta: string;
};

function textoDiasHasta(dias: number): string {
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

function storageKey(mesEtiqueta: string): string {
  return `ts-anuncio-celebraciones:${mesEtiqueta}`;
}

type TabId = "cumpleanos" | "aniversarios";

export function HomeAnuncioCelebraciones({ cumpleaneros, aniversarios, mesEtiqueta }: Props) {
  const key = useMemo(() => storageKey(mesEtiqueta), [mesEtiqueta]);
  const [abierto, setAbierto] = useState(false);
  const [tab, setTab] = useState<TabId>("cumpleanos");

  const hayCumple = cumpleaneros.length > 0;
  const hayAniv = aniversarios.length > 0;

  useEffect(() => {
    if (!hayCumple && !hayAniv) return;
    try {
      if (sessionStorage.getItem(key) === "1") return;
    } catch {
      /* ignore */
    }
    setAbierto(true);
    setTab(hayCumple ? "cumpleanos" : "aniversarios");
  }, [key, hayCumple, hayAniv]);

  useEffect(() => {
    if (!abierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") continuar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, key]);

  function continuar() {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setAbierto(false);
  }

  if (!abierto) return null;

  const listaActiva = tab === "cumpleanos" ? cumpleaneros : aniversarios;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anuncio-celebraciones-titulo"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        aria-label="Cerrar anuncio"
        onClick={continuar}
      />

      <div className="relative flex max-h-[min(92dvh,52rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-950/40 ring-1 ring-white/10">
        {/* Encabezado */}
        <header className="relative shrink-0 overflow-hidden border-b border-slate-800/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-5 py-6 text-center sm:px-8 sm:py-8">
          <div
            className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-[0.08]"
            style={{ backgroundImage: "url('/logo.webp')", backgroundSize: "min(70%, 280px)" }}
            aria-hidden
          />
          <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-amber-400/15 blur-3xl" aria-hidden />

          <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300 sm:text-xs">
            Antes de continuar
          </p>
          <h2
            id="anuncio-celebraciones-titulo"
            className="relative mt-2 text-xl font-extrabold tracking-wide text-white sm:text-2xl"
          >
            TACTICAL SUPPORT
          </h2>
          <p className="relative mt-1 text-sm font-medium text-slate-300 sm:text-base">
            Celebraciones del equipo · {mesEtiqueta}
          </p>
          <p className="relative mx-auto mt-3 max-w-md text-xs leading-relaxed text-sky-100/90 sm:text-sm">
            {hayCumple && hayAniv
              ? `Hay ${cumpleaneros.length} cumpleaños de hoy al fin de ${mesEtiqueta} y ${aniversarios.length} aniversarios laborales en los próximos 7 días.`
              : hayCumple
                ? `${cumpleaneros.length === 1 ? "Hay 1 cumpleaños" : `Hay ${cumpleaneros.length} cumpleaños`} de colaboradores activos de hoy al fin del mes.`
                : `${aniversarios.length === 1 ? "Hay 1 colaborador" : `Hay ${aniversarios.length} colaboradores`} por cumplir año en la empresa en los próximos 7 días.`}
          </p>
        </header>

        {/* Pestañas */}
        {hayCumple && hayAniv ? (
          <div className="flex shrink-0 border-b border-slate-200 bg-slate-50">
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
              Próximos cumpleaños ({cumpleaneros.length})
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
        ) : null}

        {/* Lista */}
        <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-slate-50/80 to-white">
          {!hayCumple || !hayAniv ? (
            <p className="border-b border-slate-100 bg-white px-5 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600">
              {hayCumple ? "Cumpleaños de hoy al fin del mes" : "Próximos aniversarios en Tactical Support"}
            </p>
          ) : null}
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
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">{r.servicio}</p>
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
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">{r.servicio}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Ingreso: {r.fechaIngreso}</p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-sm font-semibold text-emerald-900">{r.fechaAniversario}</p>
                    <p className="text-xs font-medium text-slate-600">
                      {textoDiasHasta(r.diasHasta)} · {r.anosEnEmpresa === 1 ? "1 año en Tactical" : `${r.anosEnEmpresa} años en Tactical`}
                    </p>
                    <p className="text-xs text-slate-500">{r.puesto}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {listaActiva.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">Sin registros en esta sección.</p>
          ) : null}
        </div>

        {/* Pie */}
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={continuar}
            className="w-full rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-slate-900/25 transition hover:brightness-110 active:scale-[0.99] sm:text-base"
          >
            Continuar a la plataforma
          </button>
          <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Este aviso no volverá a mostrarse en esta sesión
          </p>
        </footer>
      </div>
    </div>
  );
}
