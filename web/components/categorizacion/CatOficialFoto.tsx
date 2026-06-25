"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { FICHA_FOTO_MAX_BYTES, optimizarFichaFotoParaSubida } from "@/lib/ficha-foto-optimizar-client";

const MAX_MB_API = 2;

export function CatOficialFoto({
  noEmpleado,
  nombre,
  fotoUrl,
  puedeSubir,
  presentacion = false,
  onActualizada,
  className = "",
}: {
  noEmpleado: string;
  nombre: string;
  fotoUrl: string | null;
  puedeSubir: boolean;
  presentacion?: boolean;
  onActualizada?: (url: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !puedeSubir) return;
    setMsg(null);
    setSubiendo(true);
    try {
      const optimizada = await optimizarFichaFotoParaSubida(file);
      const fd = new FormData();
      fd.set("no_empleado", noEmpleado.trim().toUpperCase());
      fd.set("file", optimizada);
      const r = await fetch("/api/colaboradores/foto", { method: "POST", body: fd });
      const t = await r.text();
      if (!r.ok) {
        let err = t;
        try {
          err = JSON.parse(t).error ?? t;
        } catch {
          /* */
        }
        setMsg(typeof err === "string" ? err.toUpperCase() : "ERROR AL SUBIR.");
        return;
      }
      let url = "";
      try {
        const j = JSON.parse(t) as { url?: string };
        url = String(j.url ?? "").trim();
      } catch {
        /* */
      }
      if (!url) {
        setMsg("ERROR: RESPUESTA SIN URL.");
        return;
      }
      onActualizada?.(url);
      const kb = Math.round(optimizada.size / 1024);
      setMsg(`Foto guardada (${kb} KB).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL SUBIR.");
    } finally {
      setSubiendo(false);
    }
  }

  const frameClass = presentacion
    ? `aspect-[3/4] h-[7.75rem] w-[5.8rem] shrink-0 sm:h-[8.25rem] sm:w-[6.2rem] xl:h-[8.75rem] xl:w-[6.55rem] ${className}`
    : `aspect-[3/4] w-[10.45rem] sm:w-[11.55rem] ${className}`;

  return (
    <div
      data-cat-oficial-foto
      className={`flex shrink-0 flex-col items-stretch gap-1.5 ${presentacion ? "self-start" : ""}`}
    >
      <div
        className={`relative flex ${frameClass} items-center justify-center overflow-hidden rounded-xl border-2 border-slate-300 bg-slate-100 shadow-md`}
      >
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoUrl}
            alt={nombre}
            crossOrigin="anonymous"
            className="h-full w-full object-cover object-[center_12%]"
            decoding="async"
            fetchPriority={presentacion ? "high" : "auto"}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center px-2 text-center text-[10px] font-semibold uppercase leading-tight text-slate-400 sm:text-[11px]">
            <span className="text-2xl text-slate-300 sm:text-3xl" aria-hidden>
              ◎
            </span>
            Sin foto
          </div>
        )}
        {puedeSubir ? (
          <button
            type="button"
            className="absolute inset-x-0 bottom-0 border-t border-slate-300/80 bg-white/95 px-1.5 py-1.5 text-[9px] font-bold uppercase text-violet-900 backdrop-blur-sm hover:bg-violet-50 disabled:opacity-60 sm:text-[10px]"
            disabled={subiendo}
            onClick={() => inputRef.current?.click()}
          >
            {subiendo ? "Optimizando…" : fotoUrl ? "Cambiar" : "Subir"}
          </button>
        ) : null}
      </div>
      {puedeSubir ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void onFile(e)}
          />
          <p className="text-center text-[8px] leading-tight text-slate-500 sm:text-[9px]">
            Se optimiza al subir (hasta {Math.round(FICHA_FOTO_MAX_BYTES / 1024)} KB · máx. {MAX_MB_API} MB)
          </p>
        </>
      ) : null}
      {msg ? (
        <p
          className={`text-center text-[8px] font-semibold leading-tight sm:text-[9px] ${
            msg.includes("ERROR") || msg.includes("NO ") ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
