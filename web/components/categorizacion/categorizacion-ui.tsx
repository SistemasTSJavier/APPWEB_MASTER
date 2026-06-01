"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CATEGORIZACION_MODULOS,
  hrefCategorizacionModulo,
  type CategorizacionModuloId,
} from "@/lib/categorizacion-modulos";

export function CategorizacionHero({
  title,
  description,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-violet-900/40 bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 px-5 py-7 shadow-xl sm:px-8 sm:py-9">
      <div
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-[0.06]"
        style={{ backgroundImage: "url('/logo.webp')", backgroundSize: "min(70%, 240px)" }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-8 top-0 h-36 w-36 rounded-full bg-violet-500/25 blur-3xl" aria-hidden />
      {backHref ? (
        <Link
          href={backHref}
          className="relative inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-violet-300 transition hover:text-white"
        >
          <span aria-hidden>←</span> {backLabel ?? "Volver"}
        </Link>
      ) : (
        <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300 sm:text-xs">
          Categorización
        </p>
      )}
      <h1 className="relative mt-3 text-xl font-extrabold uppercase tracking-wide text-white sm:text-2xl md:text-3xl">
        {title}
      </h1>
      <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{description}</p>
    </header>
  );
}

export function CategorizacionModuloGrid({ activeId }: { activeId?: CategorizacionModuloId }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return CATEGORIZACION_MODULOS;
    return CATEGORIZACION_MODULOS.filter(
      (m) => m.label.toLowerCase().includes(n) || m.description.toLowerCase().includes(n),
    );
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <label className="sr-only" htmlFor="cat-buscar-modulo">
          Buscar módulo
        </label>
        <input
          id="cat-buscar-modulo"
          type="search"
          placeholder="Buscar módulo (personal, catálogo, capacitación…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="form-control w-full"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Ningún módulo coincide con la búsqueda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((mod) => {
            const active = activeId === mod.id;
            return (
              <Link
                key={mod.id}
                href={hrefCategorizacionModulo(mod.id)}
                className={`group flex min-h-[120px] flex-col rounded-xl border p-4 shadow-sm transition ${
                  active
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-300"
                    : "border-slate-200 bg-white hover:border-violet-300 hover:shadow-md"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {mod.icon}
                </span>
                <span className="mt-2 text-sm font-bold uppercase tracking-wide text-slate-900 group-hover:text-violet-900">
                  {mod.label}
                </span>
                <span className="mt-1 flex-1 text-xs font-medium leading-snug text-slate-600">{mod.description}</span>
                <span className="mt-3 text-[10px] font-bold uppercase text-violet-700">Abrir módulo →</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
