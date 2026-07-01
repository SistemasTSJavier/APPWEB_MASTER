"use client";

import { useMemo, useState } from "react";
import type { BonosFila } from "@/lib/bonos-types";
import type { SemanaLunDom } from "@/lib/semana-lun-dom";
import { formatoDesdeYyyyMmDd } from "@/lib/fecha-formato-display";

type Props = {
  open: boolean;
  onClose: () => void;
  filas: BonosFila[];
  semana: SemanaLunDom;
  onEnviado: (msg: string) => void;
};

export function BonosEmailDialog({ open, onClose, filas, semana, onEnviado }: Props) {
  const [destinatarios, setDestinatarios] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rango = useMemo(
    () => `${formatoDesdeYyyyMmDd(semana.lunesYmd)} al ${formatoDesdeYyyyMmDd(semana.domingoYmd)}`,
    [semana],
  );

  if (!open) return null;

  async function handleEnviar() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/bonos/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatarios,
          weekStartIso: semana.lunesYmd,
          filas,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? `Error ${r.status}`);
      onEnviado(`Correo enviado a ${j.enviados ?? 0} destinatario(s).`);
      onClose();
      setDestinatarios("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar correo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bonos-email-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-700 to-violet-600 px-6 py-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200">Enviar por correo</p>
          <h2 id="bonos-email-title" className="mt-1 text-xl font-bold">
            Relación de bonos — semana {rango}
          </h2>
          <p className="mt-2 text-sm text-indigo-100">
            {filas.length} colaborador(es) seleccionado(s). El mensaje incluye la tabla con sus datos.
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5" style={{ maxHeight: "calc(90vh - 180px)" }}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
            <p className="font-semibold text-slate-900">Vista previa del mensaje</p>
            <p className="mt-2 whitespace-pre-line">
              {`Buen dia!\nComparto la relacion de bonos a pagar correspondiente a esta semana (${rango}).`}
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-700">Destinatarios</span>
            <textarea
              className="form-control min-h-[80px] resize-y normal-case"
              placeholder="correo1@empresa.com, correo2@empresa.com"
              value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)}
              disabled={busy}
            />
            <p className="text-[11px] text-slate-500">Separe varios correos con coma, punto y coma o espacio.</p>
          </label>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                <tr>
                  <th className="p-2">N°</th>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Servicio</th>
                  <th className="p-2">Bono</th>
                  <th className="p-2">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={`${f.noEmpleado}-${f.fechaCumplimiento}`} className="border-t border-slate-100">
                    <td className="p-2 font-mono font-semibold">{f.noEmpleado}</td>
                    <td className="p-2">{f.nombre}</td>
                    <td className="p-2 uppercase">{f.servicio}</td>
                    <td className="p-2 font-mono">{f.bonoDias} d</td>
                    <td className="p-2">{formatoDesdeYyyyMmDd(f.fechaCumplimiento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" className="btn-secondary text-xs uppercase" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary text-xs uppercase"
            disabled={busy || !destinatarios.trim() || filas.length === 0}
            onClick={() => void handleEnviar()}
          >
            {busy ? "Enviando…" : "Enviar correo"}
          </button>
        </div>
      </div>
    </div>
  );
}
