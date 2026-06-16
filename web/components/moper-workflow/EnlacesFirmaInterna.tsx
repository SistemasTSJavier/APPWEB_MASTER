"use client";

import { useMemo, useState } from "react";
import { moperRegistroInternoUrl, type MoperFirmaInternaTipo } from "@/lib/moper-public-paths";

const FIRMAS_INTERNAS: { tipo: MoperFirmaInternaTipo; label: string }[] = [
  { tipo: "rh", label: "Gerente RH" },
  { tipo: "gerente", label: "Gerente de Operaciones" },
  { tipo: "control", label: "Centro de Control" },
];

export function EnlacesFirmaInterna({ registroId }: { registroId: number }) {
  const [copied, setCopied] = useState<MoperFirmaInternaTipo | null>(null);

  const urls = useMemo(() => {
    if (typeof window === "undefined" || !registroId) return null;
    const base = window.location.origin;
    return Object.fromEntries(
      FIRMAS_INTERNAS.map(({ tipo }) => [tipo, `${base}${moperRegistroInternoUrl(registroId, tipo)}`]),
    ) as Record<MoperFirmaInternaTipo, string>;
  }, [registroId]);

  if (!registroId) return null;

  async function copiar(tipo: MoperFirmaInternaTipo, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(tipo);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      window.prompt("Copie el enlace:", url);
    }
  }

  return (
    <div className="space-y-2 text-sm uppercase">
      <p className="text-oxford-600 font-medium">Enlaces para firmas internas (requieren iniciar sesion):</p>
      {FIRMAS_INTERNAS.map(({ tipo, label }) => {
        const url = urls?.[tipo] ?? moperRegistroInternoUrl(registroId, tipo);
        return (
          <div key={tipo} className="flex flex-wrap items-center gap-2">
            <span className="text-oxford-600 font-medium min-w-[10rem]">{label}:</span>
            <code className="rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-800 border border-oxford-200 max-w-full truncate">
              {url}
            </code>
            <button
              type="button"
              onClick={() => void copiar(tipo, url)}
              className="btn-secondary text-[10px] px-2 py-1 uppercase"
            >
              {copied === tipo ? "Copiado" : "Copiar"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
