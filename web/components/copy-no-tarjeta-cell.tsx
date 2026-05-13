"use client";

import { useCallback, useState } from "react";

/** Celda nómina: número de tarjeta + copiar al portapapeles (vista solo lectura en Colaboradores). */
export function CopyNoTarjetaCell({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  const raw = typeof value === "string" ? value.trim() : "";

  const onCopy = useCallback(async () => {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = raw;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        /* noop */
      }
    }
  }, [raw]);

  if (!raw) {
    return <span className="text-slate-500">—</span>;
  }

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-start gap-2">
      <span className="min-w-0 break-all font-mono text-xs leading-snug text-slate-800 tabular-nums">{raw}</span>
      <button
        type="button"
        onClick={onCopy}
        className="btn-outline-light shrink-0 px-2 py-1 text-[11px] font-medium"
        title="Copiar al portapapeles"
        aria-label={copied ? "Número copiado" : "Copiar número de tarjeta"}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
