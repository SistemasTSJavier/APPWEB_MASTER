"use client";

import { useState } from "react";
import { useMoperWorkflow } from "./MoperWorkflowContext";
import { MOPER_FIRMA_PUBLIC_PATH, moperFirmaPublicUrl } from "@/lib/moper-public-paths";

/**
 * Entrada de codigo para el oficial: abre la vista de resumen y firma de conformidad.
 * Enlace directo publico: /moper/firma?codigo=XXXXXXXX (sin login).
 */
export function CodigoAccesoPanel({ variant = "staff" }: { variant?: "staff" | "public" }) {
  const { loginPorCodigo } = useMoperWorkflow();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const esPublico = variant === "public";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginPorCodigo(codigo);
    setLoading(false);
    if (!result.ok) setError(result.error || "CODIGO NO VALIDO");
  }

  const enlaceBase =
    typeof window !== "undefined" ? `${window.location.origin}${MOPER_FIRMA_PUBLIC_PATH}?codigo=` : `${MOPER_FIRMA_PUBLIC_PATH}?codigo=`;

  return (
    <section
      className={`card ${esPublico ? "border-2 border-sky-200 bg-sky-50/30" : "border-2 border-amber-200 bg-amber-50/40"}`}
    >
      <h2 className="text-sm font-bold uppercase text-slate-900">
        {esPublico ? "Codigo de acceso" : "Enlace para el oficial (sin login)"}
      </h2>
      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700 sm:text-sm">
        {esPublico ? (
          <>
            Ingrese el codigo que le compartieron para ver el movimiento y firmar <strong>conformidad</strong>.
          </>
        ) : (
          <>
            El oficial <strong>no debe iniciar sesion</strong> en la plataforma. Comparta el enlace{" "}
            <span className="font-mono text-sky-800">{MOPER_FIRMA_PUBLIC_PATH}</span> con el codigo; el puede firmar
            desde el celular o computadora sin cuenta.
          </>
        )}
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
      {!esPublico ? (
        <p className="mt-3 text-[11px] font-medium uppercase text-slate-500">
          Enlace para compartir:{" "}
          <span className="font-mono text-slate-700">
            {enlaceBase}
            <span className="text-amber-800">CODIGO</span>
          </span>
          {codigo.trim() ? (
            <>
              {" "}
              ·{" "}
              <a
                href={moperFirmaPublicUrl(codigo)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sky-700 underline"
              >
                Probar enlace
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
