"use client";

import { useState } from "react";
import { useMoperWorkflow } from "./MoperWorkflowContext";

/**
 * Entrada de codigo para el oficial: abre la vista de resumen y firma de conformidad.
 * Tambien funciona el enlace directo /moper?codigo=XXXXXXXX.
 */
export function CodigoAccesoPanel() {
  const { loginPorCodigo } = useMoperWorkflow();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginPorCodigo(codigo);
    setLoading(false);
    if (!result.ok) setError(result.error || "CODIGO NO VALIDO");
  }

  return (
    <section className="card border-2 border-amber-200 bg-amber-50/40">
      <h2 className="text-sm font-bold uppercase text-slate-900">Codigo de acceso — firma del oficial</h2>
      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700 sm:text-sm">
        Si le compartieron un codigo de acceso, ingreselo aqui para ver el movimiento y firmar{" "}
        <strong>conformidad</strong>. No requiere cuenta de la plataforma.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1">
          <span className="form-label uppercase">Codigo de acceso</span>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            className="form-control font-mono tracking-wider"
            placeholder="EJ. ABC12XYZ"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn-primary shrink-0 uppercase sm:min-w-[160px]" disabled={loading}>
          {loading ? "Verificando…" : "Ver y firmar"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold uppercase text-red-900">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] font-medium uppercase text-slate-500">
        Enlace directo (compartir al oficial):{" "}
        <span className="font-mono text-slate-700">
          {typeof window !== "undefined" ? `${window.location.origin}/moper?codigo=` : "/moper?codigo="}
          <span className="text-amber-800">CODIGO</span>
        </span>
      </p>
    </section>
  );
}
