"use client";

import { useState, useMemo } from "react";
import { moperFirmaPublicUrl } from "@/lib/moper-public-paths";

export function EnlaceCodigoOficial({ codigo }: { codigo: string }) {
  const [copied, setCopied] = useState(false);
  const c = codigo.trim().toUpperCase();
  const url = useMemo(() => {
    if (typeof window === "undefined" || !c) return "";
    return `${window.location.origin}${moperFirmaPublicUrl(c)}`;
  }, [c]);

  if (!c) return null;

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie el enlace:", url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm uppercase">
      <span className="text-oxford-600 font-medium">Enlace para el oficial:</span>
      <code className="rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-800 border border-oxford-200 max-w-full truncate">
        {url || moperFirmaPublicUrl(c)}
      </code>
      <button type="button" onClick={() => void copiar()} className="btn-secondary text-[10px] px-2 py-1 uppercase">
        {copied ? "Copiado" : "Copiar enlace"}
      </button>
    </div>
  );
}
