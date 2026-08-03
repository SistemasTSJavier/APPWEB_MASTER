"use client";

import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
import { optimizarLogoServicioParaSubida } from "@/lib/cat-dashboard-logo-optimizar-client";
import { CAT_DASHBOARD_BANNER_SRC } from "@/lib/brand-logo";

export { CAT_DASHBOARD_BANNER_SRC };

/** Zona del logo cliente bajo «CATEGORIZACIÓN» (relativo al arte). */
const LOGO_CLIENTE_ZONA =
  "absolute left-[80%] top-[50%] flex h-[42%] w-[22%] max-w-[10rem] -translate-x-1/2 flex-col items-center justify-center sm:left-[79.5%] sm:w-[20%]";

const LOGO_CLIENTE_IMG =
  "max-h-[96%] max-w-full object-contain object-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]";

const LOGO_CLIENTE_IMG_PREVIEW =
  "max-h-[3.25rem] w-auto max-w-full object-contain object-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)] sm:max-h-[3.75rem]";

function BannerBase({
  presentacion = false,
  logoSlot,
}: {
  presentacion?: boolean;
  logoSlot: ReactNode;
}) {
  /**
   * Banner real a 100% del ancho, proporción original:
   * se ve completo, sin estirar y sin fondo inventado a los lados.
   */
  return (
    <div className="relative w-full shrink-0 overflow-hidden bg-[#0c1f4a] leading-[0]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={CAT_DASHBOARD_BANNER_SRC}
        alt=""
        className="block h-auto w-full max-w-full select-none"
        aria-hidden
        decoding="async"
        fetchPriority={presentacion ? "high" : "auto"}
      />
      <div className={`${LOGO_CLIENTE_ZONA} pointer-events-none`}>{logoSlot}</div>
    </div>
  );
}

export function CatDashboardBanner({
  servicio,
  logoClienteUrl,
  puedeSubirLogo,
  onLogoActualizado,
  presentacion = false,
}: {
  servicio: string;
  logoClienteUrl: string | null;
  puedeSubirLogo?: boolean;
  onLogoActualizado?: (url: string | null) => void;
  presentacion?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !puedeSubirLogo || !servicio.trim()) return;
    setMsg(null);
    setSubiendo(true);
    try {
      const optimizada = await optimizarLogoServicioParaSubida(file);
      const fd = new FormData();
      fd.set("servicio", servicio.trim());
      fd.set("file", optimizada);
      const r = await fetch("/api/categorizacion/dashboard/logo-servicio", { method: "POST", body: fd });
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
      onLogoActualizado?.(url);
      setMsg(`Logo guardado (${Math.round(optimizada.size / 1024)} KB).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL SUBIR.");
    } finally {
      setSubiendo(false);
    }
  }

  const mostrarSubida = Boolean(puedeSubirLogo && !presentacion);

  return (
    <header className="relative w-full shrink-0 overflow-hidden border-b border-slate-200 bg-[#0c1f4a]">
      <BannerBase
        presentacion={presentacion}
        logoSlot={
          <div
            className={`flex h-full w-full flex-col items-center justify-center gap-1 ${
              mostrarSubida ? "pointer-events-auto" : ""
            }`}
          >
            {logoClienteUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoClienteUrl}
                alt={servicio.trim() ? `Logo ${servicio}` : "Logo del cliente"}
                crossOrigin="anonymous"
                className={LOGO_CLIENTE_IMG}
                decoding="async"
              />
            ) : (
              <span className="px-1 text-center text-[7px] font-semibold uppercase leading-tight text-white/50 sm:text-[8px]">
                Logo del cliente
              </span>
            )}
            {mostrarSubida ? (
              <>
                <button
                  type="button"
                  className="rounded border border-white/50 bg-white/95 px-2 py-0.5 text-[7px] font-bold uppercase text-blue-950 shadow-sm hover:bg-white disabled:opacity-60 sm:text-[8px]"
                  disabled={subiendo || !servicio.trim()}
                  onClick={() => inputRef.current?.click()}
                >
                  {subiendo ? "Subiendo…" : logoClienteUrl ? "Cambiar logo" : "Subir logo"}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => void onFile(e)}
                />
                {msg ? (
                  <p
                    className={`max-w-full text-center text-[7px] font-semibold leading-tight ${
                      msg.includes("ERROR") ? "text-red-200" : "text-emerald-100"
                    }`}
                  >
                    {msg}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        }
      />
    </header>
  );
}

/** Vista previa + subida en la sección de filtros (por servicio). */
export function CatLogoServicioFiltro({
  servicio,
  logoUrl,
  onActualizado,
}: {
  servicio: string;
  logoUrl: string | null;
  onActualizado: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !servicio.trim()) return;
    setMsg(null);
    setSubiendo(true);
    try {
      const optimizada = await optimizarLogoServicioParaSubida(file);
      const fd = new FormData();
      fd.set("servicio", servicio.trim());
      fd.set("file", optimizada);
      const r = await fetch("/api/categorizacion/dashboard/logo-servicio", { method: "POST", body: fd });
      const t = await r.text();
      if (!r.ok) {
        let err = t;
        try {
          err = JSON.parse(t).error ?? t;
        } catch {
          /* */
        }
        setMsg(typeof err === "string" ? err.toUpperCase() : "ERROR.");
        return;
      }
      const j = JSON.parse(t) as { url?: string };
      const url = String(j.url ?? "").trim();
      if (!url) {
        setMsg("ERROR SIN URL.");
        return;
      }
      onActualizado(url);
      setMsg(`Logo guardado (${Math.round(optimizada.size / 1024)} KB).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#0c1f4a]">
      <BannerBase
        logoSlot={
          logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className={LOGO_CLIENTE_IMG_PREVIEW} crossOrigin="anonymous" />
          ) : (
            <span className="text-[8px] font-semibold uppercase text-white/50">Logo cliente</span>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
        <p className="w-full text-[10px] font-bold uppercase text-slate-700 sm:w-auto">
          Logo bajo «Categorización» · {servicio}
        </p>
        <button
          type="button"
          className="btn-secondary text-[10px] uppercase"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
        >
          {subiendo ? "Subiendo…" : logoUrl ? "Cambiar logo del cliente" : "Subir logo del cliente"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => void onFile(e)}
        />
        <span className="text-[10px] text-slate-500">Un logo por servicio · se optimiza al subir</span>
        {msg ? <span className="text-[10px] font-semibold text-emerald-700">{msg}</span> : null}
      </div>
    </div>
  );
}
