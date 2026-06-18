"use client";

import { useCallback, useState } from "react";
import { moperFetch } from "@/lib/moper-fetch";
import type { MoperFolioAuditoria } from "@/lib/moper-registros-server";

export function MoperFolioAuditoriaPanel({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [audit, setAudit] = useState<MoperFolioAuditoria | null>(null);

  const cargar = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await moperFetch("/api/moper/folios/auditoria", { headers: authHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error");
      setAudit(j.auditoria as MoperFolioAuditoria);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setBusy(false);
    }
  }, [authHeaders]);

  const asignarPendientes = useCallback(async () => {
    if (!audit?.sinFolio) return;
    if (
      !window.confirm(
        `Se asignaran folios consecutivos a ${audit.sinFolio} MOPER sin folio (orden por fecha de creacion). ¿Continuar?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await moperFetch("/api/moper/folios/auditoria", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error");
      setMsg(
        j.asignados > 0
          ? `Listo: ${j.asignados} folio(s) asignado(s) (${j.detalle?.map((d: { folio: string }) => d.folio).join(", ") ?? ""}). Proximo: ${j.proximoFolio}`
          : "No habia MOPER pendientes de folio.",
      );
      await cargar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setBusy(false);
    }
  }, [audit?.sinFolio, authHeaders, cargar]);

  return (
    <div className="mt-2 border-t border-oxford-200 pt-2">
      <button
        type="button"
        className="text-[10px] font-bold uppercase text-violet-800 hover:underline"
        onClick={() => {
          setAbierto((v) => !v);
          if (!abierto && !audit) void cargar();
        }}
      >
        {abierto ? "Ocultar" : "Ver"} estado de folios (registros anteriores)
      </button>
      {abierto ? (
        <div className="mt-2 space-y-2 rounded-lg border border-oxford-200 bg-white p-3 text-xs">
          {busy && !audit ? <p className="text-slate-500">Cargando…</p> : null}
          {audit ? (
            <>
              <p className="text-slate-700">
                <strong>Proximo folio en sistema:</strong> {audit.proximoFolio}
                {audit.maxFolioNum != null ? ` · Mayor folio usado: ${audit.maxFolioNum}` : ""}
              </p>
              <p className="text-slate-700">
                <strong>{audit.conFolio}</strong> MOPER con folio · <strong>{audit.sinFolio}</strong> sin folio
              </p>
              {audit.sinFolioLista.length > 0 ? (
                <div>
                  <p className="font-semibold text-amber-900">Sin folio guardado (creados con el flujo anterior):</p>
                  <ul className="mt-1 max-h-32 overflow-auto space-y-0.5 font-mono text-[10px]">
                    {audit.sinFolioLista.map((r) => (
                      <li key={r.id}>
                        #{r.id} · {r.oficial_nombre || "—"} ·{" "}
                        {r.firma_conformidad_at ? "conformidad firmada" : "sin conformidad"}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn-secondary mt-2 text-[10px] uppercase"
                    disabled={busy}
                    onClick={() => void asignarPendientes()}
                  >
                    Asignar folios faltantes
                  </button>
                </div>
              ) : null}
              {audit.registros.filter((r) => r.folio).length > 0 ? (
                <details className="text-[10px]">
                  <summary className="cursor-pointer font-semibold text-slate-600">Ver todos con folio</summary>
                  <ul className="mt-1 max-h-40 overflow-auto space-y-0.5 font-mono">
                    {audit.registros
                      .filter((r) => r.folio)
                      .map((r) => (
                        <li key={r.id}>
                          {r.folio} · #{r.id} · {r.oficial_nombre}
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : null}
          {msg ? <p className="font-medium text-violet-950">{msg}</p> : null}
          <button type="button" className="text-[10px] font-bold uppercase text-slate-600" disabled={busy} onClick={() => void cargar()}>
            Actualizar
          </button>
        </div>
      ) : null}
    </div>
  );
}
