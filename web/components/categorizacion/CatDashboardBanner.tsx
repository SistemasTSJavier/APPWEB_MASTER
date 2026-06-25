"use client";

import { type ChangeEvent, useRef, useState } from "react";
import {
  optimizarLogoServicioParaSubida,
} from "@/lib/cat-dashboard-logo-optimizar-client";
import { CAT_DASHBOARD_BANNER_SRC } from "@/lib/brand-logo";

export { CAT_DASHBOARD_BANNER_SRC };

/** Logo del cliente: 25% de separación tras el logo central del banner, sin marco. */
const CLIENT_LOGO_OVERLAY =
  "pointer-events-none absolute inset-0 flex items-center";
const CLIENT_LOGO_SLOT = "flex min-h-0 min-w-0 flex-1 items-center justify-start pr-[1.5%]";
const CLIENT_LOGO_IMG =
  "h-[min(28vw,11rem)] w-auto max-w-full object-contain object-left drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]";
const CLIENT_LOGO_IMG_PREVIEW =
  "h-[min(20vw,7rem)] w-auto max-w-full object-contain object-left drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]";

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
      <div className="relative w-full leading-[0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CAT_DASHBOARD_BANNER_SRC}
          alt=""
          className="block h-auto w-full max-w-full select-none"
          aria-hidden
          decoding="async"
          fetchPriority={presentacion ? "high" : "auto"}
        />

        <div className={CLIENT_LOGO_OVERLAY}>
          <div className="w-[58%] shrink-0" aria-hidden />
          <div className="w-[25%] shrink-0" aria-hidden />
          <div className={`${CLIENT_LOGO_SLOT} ${mostrarSubida ? "pointer-events-auto" : ""}`}>
            {logoClienteUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoClienteUrl}
                alt={servicio.trim() ? `Logo ${servicio}` : "Logo del cliente"}
                crossOrigin="anonymous"
                className={CLIENT_LOGO_IMG}
                decoding="async"
              />
            ) : (
              <span className="text-[9px] font-semibold uppercase leading-tight text-white/45 sm:text-[10px]">
                Logo del cliente
              </span>
            )}
          </div>
        </div>
        {mostrarSubida ? (
          <div className="absolute bottom-[6%] left-[calc(58%+25%)] flex flex-col items-start gap-0.5">
              <button
                type="button"
                className="rounded border border-white/50 bg-white/95 px-2 py-0.5 text-[8px] font-bold uppercase text-blue-950 shadow-sm hover:bg-white disabled:opacity-60 sm:text-[9px]"
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
                  className={`text-center text-[7px] font-semibold leading-tight sm:text-[8px] ${
                    msg.includes("ERROR") ? "text-red-200" : "text-emerald-100"
                  }`}
                >
                  {msg}
                </p>
              ) : null}
            </div>
          ) : null}
      </div>
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
      <div className="relative w-full leading-[0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CAT_DASHBOARD_BANNER_SRC}
          alt=""
          className="block h-auto w-full max-w-full"
          aria-hidden
        />
        <div className={CLIENT_LOGO_OVERLAY}>
          <div className="w-[58%] shrink-0" aria-hidden />
          <div className="w-[25%] shrink-0" aria-hidden />
          <div className={CLIENT_LOGO_SLOT}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className={CLIENT_LOGO_IMG_PREVIEW} />
            ) : (
              <span className="text-[8px] font-semibold uppercase text-white/45">Logo cliente</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
        <p className="w-full text-[10px] font-bold uppercase text-slate-700 sm:w-auto">Logo cliente · {servicio}</p>
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
