"use client";

import { type ChangeEvent, useRef, useState } from "react";

const MAX_MB = 2;

export function CatOficialFoto({
  noEmpleado,
  nombre,
  fotoUrl,
  puedeSubir,
  presentacion = false,
  onActualizada,
}: {
  noEmpleado: string;
  nombre: string;
  fotoUrl: string | null;
  puedeSubir: boolean;
  presentacion?: boolean;
  onActualizada?: (url: string) => void;
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
      const fd = new FormData();
      fd.set("no_empleado", noEmpleado.trim().toUpperCase());
      fd.set("file", file);
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
      setMsg("Foto guardada.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL SUBIR.");
    } finally {
      setSubiendo(false);
    }
  }

  const sizeClass = presentacion
    ? "h-[7.5rem] w-[5.6rem] sm:h-[8.5rem] sm:w-[6.4rem]"
    : "h-[6.5rem] w-[4.9rem] sm:h-[7.5rem] sm:w-[5.6rem]";

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        className={`relative flex ${sizeClass} items-center justify-center overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-100 shadow-sm`}
      >
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt={nombre} className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center px-1 text-center text-[9px] font-semibold uppercase leading-tight text-slate-400">
            <span className="text-lg text-slate-300" aria-hidden>
              ◎
            </span>
            Sin foto
          </div>
        )}
        {puedeSubir ? (
          <button
            type="button"
            className="absolute inset-x-0 bottom-0 border-t border-slate-300/80 bg-white/95 px-1 py-1 text-[8px] font-bold uppercase text-violet-900 backdrop-blur-sm hover:bg-violet-50 disabled:opacity-60 sm:text-[9px]"
            disabled={subiendo}
            onClick={() => inputRef.current?.click()}
          >
            {subiendo ? "Subiendo…" : fotoUrl ? "Cambiar" : "Subir"}
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
          <p className="max-w-[6rem] text-center text-[8px] leading-tight text-slate-500">
            JPEG, PNG o WebP · máx. {MAX_MB} MB
          </p>
        </>
      ) : null}
      {msg ? (
        <p
          className={`max-w-[7rem] text-center text-[8px] font-semibold leading-tight ${
            msg.includes("ERROR") || msg.includes("NO ") ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
