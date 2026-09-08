"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AppRole } from "@/lib/app-role";
import { MoperWorkflowProvider, useMoperWorkflow } from "@/components/moper-workflow/MoperWorkflowContext";
import { MoperWorkflowApp } from "@/components/moper-workflow/MoperWorkflowApp";
import { VistaPorCodigo } from "@/components/moper-workflow/VistaPorCodigo";
import { CodigoAccesoPanel } from "@/components/moper-workflow/CodigoAccesoPanel";
import { MoperContabilidadPanel } from "@/components/moper-workflow/MoperContabilidadPanel";

function MoperPageContent() {
  const {
    accesoPorCodigo,
    loginPorCodigo,
    authHeaders,
    puedeMarcarRecibidoContabilidad,
    puedeReenviarEmailContabilidad,
    puedeExportarCsv,
    esSoloContabilidad,
    esNominasRecepcion,
  } = useMoperWorkflow();
  const [descargandoCsv, setDescargandoCsv] = useState(false);
  const [errorCsv, setErrorCsv] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const codigoUrl = searchParams.get("codigo")?.trim().toUpperCase() ?? "";
  const registroParam = searchParams.get("registro")?.trim() ?? "";
  const firmaParam = searchParams.get("firma")?.trim().toLowerCase() ?? "";
  const [refreshWorkflow, setRefreshWorkflow] = useState(0);
  const initialRegistroId = (() => {
    const id = parseInt(registroParam, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  })();
  const firmaDestacada =
    firmaParam === "rh" || firmaParam === "gerente" || firmaParam === "control" ? firmaParam : null;

  const vistaDocumentoRecepcion =
    (esNominasRecepcion || esSoloContabilidad) && initialRegistroId != null;
  const mostrarListaRecepcion = !vistaDocumentoRecepcion;
  const mostrarWorkflowCaptura = !esNominasRecepcion || vistaDocumentoRecepcion;

  const onHistorialRefresh = useCallback(() => {
    setRefreshWorkflow((k) => k + 1);
  }, []);

  const descargarCsvVerificados = useCallback(async () => {
    setErrorCsv(null);
    setDescargandoCsv(true);
    try {
      const res = await fetch("/api/moper/export-csv", { credentials: "same-origin" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No se pudo descargar el CSV");
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `moper-verificados-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrorCsv(e instanceof Error ? e.message : "No se pudo descargar el CSV");
    } finally {
      setDescargandoCsv(false);
    }
  }, []);

  useEffect(() => {
    if (!codigoUrl || accesoPorCodigo) return;
    void loginPorCodigo(codigoUrl);
  }, [codigoUrl, accesoPorCodigo, loginPorCodigo]);

  if (accesoPorCodigo) {
    return (
      <div className="w-full space-y-4">
        <VistaPorCodigo />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">MOPER</h1>
        {esNominasRecepcion && !vistaDocumentoRecepcion ? (
          <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
            MOPER completados pendientes de recepción. Pulse <strong>Ver</strong> para abrir el documento con todas las
            firmas y confirmar recepción.
          </p>
        ) : esSoloContabilidad || vistaDocumentoRecepcion ? (
          <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
            Revise el movimiento de personal, las firmas y confirme recepción para registrar el cambio oficial.
          </p>
        ) : (
          <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
            Captura y firmas internas abajo. El oficial firma en{" "}
            <strong className="text-sky-900">/moper/firma</strong> con su codigo — sin iniciar sesion en la plataforma.
            Gerente RH, Gerente de Operaciones y Centro de Control pueden firmar desde el enlace del correo con su cuenta.
            Al completarse todas las firmas se notifica por correo.
          </p>
        )}
        </div>
        {puedeExportarCsv ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => void descargarCsvVerificados()}
              disabled={descargandoCsv}
              className="px-4 py-2 bg-black text-white rounded text-sm font-medium hover:bg-oxford-800 disabled:opacity-50"
            >
              {descargandoCsv ? "Generando CSV…" : "Descargar CSV verificados"}
            </button>
            {errorCsv ? <p className="text-xs text-red-700">{errorCsv}</p> : null}
          </div>
        ) : null}
      </div>

      {mostrarListaRecepcion ? (
        <MoperContabilidadPanel
          authHeaders={authHeaders}
          puedeMarcarRecibido={puedeMarcarRecibidoContabilidad}
          puedeReenviarEmail={puedeReenviarEmailContabilidad}
          registroSeleccionadoId={initialRegistroId}
          onRefreshRegistro={onHistorialRefresh}
          soloPendientes={esNominasRecepcion}
          abrirEnNuevaVentana={esNominasRecepcion}
          etiquetaRecepcion={esNominasRecepcion ? "Nóminas" : "Contabilidad"}
        />
      ) : null}

      {mostrarWorkflowCaptura ? (
        <>
          {!esNominasRecepcion && !esSoloContabilidad ? <CodigoAccesoPanel /> : null}

          <MoperWorkflowApp
            initialRegistroId={initialRegistroId}
            firmaDestacada={firmaDestacada}
            refreshTrigger={refreshWorkflow}
            ocultarPanelLateral={esNominasRecepcion || esSoloContabilidad}
            modoRecepcionDocumento={vistaDocumentoRecepcion}
          />
        </>
      ) : null}
    </div>
  );
}

export function MoperPageClient({
  appRole,
  userEmail,
  userName,
}: {
  appRole: AppRole;
  userEmail: string;
  userName: string;
}) {
  return (
    <MoperWorkflowProvider appRole={appRole} userEmail={userEmail} userName={userName}>
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando MOPER…</p>}>
        <MoperPageContent />
      </Suspense>
    </MoperWorkflowProvider>
  );
}
