"use client";

import { type ChangeEvent, useId, useRef, useState } from "react";
import { parseCurpDesdePdf, type CurpPdfParseResult } from "@/lib/curp-pdf-parse";

export function CurpPdfImportModal({
  open,
  onClose,
  onParsed,
}: {
  open: boolean;
  onClose: () => void;
  onParsed: (result: CurpPdfParseResult) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const titleId = `curp-pdf-title-${uid}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [archivo, setArchivo] = useState<string | null>(null);

  if (!open) return null;

  async function procesarPdf(file: File) {
    setBusy(true);
    setError(null);
    setArchivo(file.name);
    try {
      const parsed = await parseCurpDesdePdf(file);
      onParsed(parsed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el PDF.");
    } finally {
      setBusy(false);
    }
  }

  function onPickFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    void procesarPdf(file);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-bold uppercase text-slate-900">
              Leer constancia CURP (PDF)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Suba el PDF oficial de la constancia CURP (gob.mx). Se extraerán la <strong>CURP</strong> y el{" "}
              <strong>nombre completo</strong>.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold uppercase text-slate-700 hover:bg-slate-100"
            onClick={onClose}
            disabled={busy}
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Archivo PDF de constancia CURP</p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-bold uppercase text-white hover:bg-violet-800 disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? "Leyendo PDF…" : "Seleccionar PDF"}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickFile} />
          {archivo ? <p className="mt-3 text-xs font-medium uppercase text-slate-500">{archivo}</p> : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
