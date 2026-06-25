"use client";

import { useState, useEffect, useCallback } from "react";
import { MoperWorkflowHeader } from "./MoperWorkflowHeader";
import { PanelLateral } from "./PanelLateral";
import { FormularioMoper } from "./FormularioMoper";
import { FirmasWorkflow } from "./FirmasWorkflow";
import { FooterLegal } from "./FooterLegal";
import { useMoperWorkflow } from "./MoperWorkflowContext";
import { moperFetch } from "@/lib/moper-fetch";
import { generarPDF, loadLogoAsDataUrl, loadPlantillaAsDataUrl } from "@/lib/moper-pdf";
import type { RegistroMoper } from "./types";
import { buildMailtoBody } from "./build-mailto";
import { moperWorkflowPuedeAjustarFolio } from "@/lib/moper-workflow-role";
import { EnlaceCodigoOficial } from "./EnlaceCodigoOficial";
import { EnlacesFirmaInterna } from "./EnlacesFirmaInterna";
import { MoperFolioAuditoriaPanel } from "./MoperFolioAuditoriaPanel";
import { MoperRegistroAbiertoBanner } from "./MoperRegistroAbiertoBanner";

type MoperWorkflowAppProps = {
  initialRegistroId?: number | null;
  firmaDestacada?: string | null;
  refreshTrigger?: number;
  ocultarPanelLateral?: boolean;
  modoRecepcionDocumento?: boolean;
};

export function MoperWorkflowApp({
  initialRegistroId = null,
  firmaDestacada = null,
  refreshTrigger = 0,
  ocultarPanelLateral = false,
  modoRecepcionDocumento = false,
}: MoperWorkflowAppProps) {
  const {
    user,
    authHeaders,
    puedeEditar,
    appRole,
    puedeMarcarRecibidoContabilidad,
    puedeReenviarEmailContabilidad,
    esSoloContabilidad,
    esNominasRecepcion,
  } = useMoperWorkflow();
  const esModoRecepcion = esNominasRecepcion || esSoloContabilidad;
  const etiquetaRecepcion = esNominasRecepcion ? "Nóminas" : "Contabilidad";
  const [folioPreview, setFolioPreview] = useState("SPT/No. 0280/MOP");
  const [registroId, setRegistroId] = useState<number | null>(null);
  const [registroCompleto, setRegistroCompleto] = useState<RegistroMoper | null>(null);
  const [cargandoRegistro, setCargandoRegistro] = useState(false);
  const [refreshPanel, setRefreshPanel] = useState(0);
  const [marcandoRecibido, setMarcandoRecibido] = useState(false);

  useEffect(() => {
    moperFetch("/api/folios/preview", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: { folio?: string }) => d.folio && setFolioPreview(d.folio))
      .catch(() => {});
  }, [authHeaders]);

  const cargarRegistro = useCallback(
    (id: number) => {
      setCargandoRegistro(true);
      setRegistroCompleto(null);
      moperFetch(`/api/moper/${id}`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((r: RegistroMoper) => {
          setRegistroCompleto(r);
          if (r.folio) setFolioPreview(r.folio);
        })
        .catch(() => setRegistroCompleto(null))
        .finally(() => setCargandoRegistro(false));
    },
    [authHeaders],
  );

  const onGuardar = useCallback(
    (id: number, folio: string | null) => {
      setRegistroId(id);
      if (folio) setFolioPreview(folio);
      cargarRegistro(id);
      setRefreshPanel((k) => k + 1);
    },
    [cargarRegistro],
  );

  const onFirmaRegistrada = useCallback(() => {
    setRefreshPanel((k) => k + 1);
    if (registroId != null) cargarRegistro(registroId);
  }, [registroId, cargarRegistro]);

  const onSeleccionarRegistro = useCallback(
    (id: number) => {
      setRegistroId(id);
      cargarRegistro(id);
    },
    [cargarRegistro],
  );

  useEffect(() => {
    if (initialRegistroId != null && initialRegistroId > 0 && initialRegistroId !== registroId) {
      onSeleccionarRegistro(initialRegistroId);
    }
  }, [initialRegistroId, onSeleccionarRegistro, registroId]);

  useEffect(() => {
    if (refreshTrigger > 0 && registroId != null) {
      cargarRegistro(registroId);
      setRefreshPanel((k) => k + 1);
    }
  }, [refreshTrigger, registroId, cargarRegistro]);

  const onGenerarPDF = useCallback(() => {
    if (!registroCompleto) return;
    Promise.all([loadLogoAsDataUrl(), loadPlantillaAsDataUrl()]).then(([logo, plantilla]) => {
      generarPDF(registroCompleto, logo, plantilla);
    });
  }, [registroCompleto]);

  const actualizarFolioPreview = useCallback(() => {
    moperFetch("/api/folios/preview", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: { folio?: string }) => d.folio && setFolioPreview(d.folio))
      .catch(() => {});
  }, [authHeaders]);

  const ajustarFolio = useCallback(
    (delta: number) => {
      moperFetch("/api/folios/sequence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ delta }),
      })
        .then((res) => res.json().then((d) => ({ ok: res.ok, data: d })))
        .then(({ ok, data }) => {
          const d = data as { folio?: string; error?: string };
          if (d.folio) setFolioPreview(d.folio);
          if (!ok) throw new Error(d.error || "Error");
        })
        .catch((e) => alert(e instanceof Error ? e.message : "Error al ajustar folio"));
    },
    [authHeaders],
  );

  const onNuevoRegistro = useCallback(() => {
    setRegistroId(null);
    setRegistroCompleto(null);
    setCargandoRegistro(false);
    actualizarFolioPreview();
  }, [actualizarFolioPreview]);

  const mailtoHref = useCallback((registro: RegistroMoper) => {
    const subject = `MOPER - ${registro.folio || "Movimiento de Personal"}`;
    const body = buildMailtoBody(registro);
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, []);

  const marcarRecibidoContabilidad = useCallback(async () => {
    if (!registroId || !registroCompleto?.completado) return;
    if (!window.confirm(`¿Confirma recepción oficial de este MOPER en ${etiquetaRecepcion}?`)) return;
    setMarcandoRecibido(true);
    try {
      const r = await moperFetch(`/api/moper/${registroId}/recibido`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error");
      cargarRegistro(registroId);
      setRefreshPanel((k) => k + 1);
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.location.reload();
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al marcar recibido");
    } finally {
      setMarcandoRecibido(false);
    }
  }, [authHeaders, cargarRegistro, etiquetaRecepcion, registroCompleto?.completado, registroId]);

  const reenviarEmailContabilidad = useCallback(async () => {
    if (!registroId || !registroCompleto?.completado) return;
    if (!window.confirm("¿Reenviar notificación a contabilidad?")) return;
    try {
      const pendiente = !registroCompleto.recibido_contabilidad_at;
      const r = await moperFetch(`/api/moper/${registroId}/notificar-contabilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ pendiente }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error al enviar");
      alert("Correo enviado a contabilidad.");
      cargarRegistro(registroId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al enviar correo");
    }
  }, [authHeaders, cargarRegistro, registroCompleto, registroId]);

  const puedeAjustarFolio = moperWorkflowPuedeAjustarFolio(appRole);

  return (
    <div className="flex flex-col rounded-xl border-2 border-oxford-200 bg-white overflow-hidden min-h-[480px]">
      <MoperWorkflowHeader />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {!ocultarPanelLateral ? (
          <PanelLateral
            registroIdActual={registroId}
            onSeleccionarRegistro={onSeleccionarRegistro}
            onNuevoRegistro={onNuevoRegistro}
            refreshTrigger={refreshPanel}
          />
        ) : null}
        <main className="flex-1 min-w-0 w-full px-3 sm:px-4 py-4 sm:py-6 overflow-auto">
          {esModoRecepcion && !registroId && !modoRecepcionDocumento ? (
            <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Seleccione un MOPER en el listado y pulse <strong>Ver</strong> para consultar el documento.
            </p>
          ) : null}
          <p className="text-center font-bold text-oxford-800 text-base sm:text-lg mb-4 sm:mb-6 uppercase">
            Movimiento de Personal (MOPER)
          </p>
          {registroId && cargandoRegistro ? (
            <p className="mb-4 text-center text-sm text-oxford-600">Cargando registro seleccionado…</p>
          ) : null}
          {registroCompleto && registroId ? <MoperRegistroAbiertoBanner registro={registroCompleto} /> : null}
          {registroCompleto?.completado && registroCompleto.recibido_contabilidad_at ? (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Recibido el{" "}
              {new Date(registroCompleto.recibido_contabilidad_at).toLocaleString("es-MX")}
              {registroCompleto.recibido_contabilidad_por
                ? ` — ${registroCompleto.recibido_contabilidad_por}`
                : ""}
            </p>
          ) : null}
          {registroCompleto?.completado &&
          !registroCompleto.recibido_contabilidad_at &&
          puedeMarcarRecibidoContabilidad ? (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-950 flex-1 min-w-[12rem]">
                Este MOPER está listo. Confirme recepción para registrar el cambio oficial.
              </p>
              <button
                type="button"
                disabled={marcandoRecibido}
                onClick={() => void marcarRecibidoContabilidad()}
                className="btn-primary min-h-[44px] uppercase"
              >
                Marcar como recibido
              </button>
            </div>
          ) : null}
          {registroId && !cargandoRegistro && !registroCompleto ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              No se pudo cargar el registro. Seleccione otro en la lista o intente de nuevo.
            </p>
          ) : null}
          <div className="border-2 border-oxford-300 rounded-lg p-3 sm:p-4 mb-4 bg-oxford-50/30 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-oxford-600 text-sm font-medium uppercase">Folio: </span>
              <span className="font-mono font-semibold text-black">
                {registroCompleto?.folio ?? folioPreview}
                {!registroId ? (
                  <span className="text-oxford-500 font-normal"> (se asigna al guardar)</span>
                ) : null}
              </span>
              {puedeAjustarFolio && !registroId ? (
                <span className="inline-flex items-center gap-0.5 ml-2">
                  <button
                    type="button"
                    onClick={() => ajustarFolio(1)}
                    className="p-1.5 border-2 border-oxford-300 rounded text-oxford-800 hover:bg-oxford-100 font-bold leading-none"
                    title="Subir numero del proximo folio"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => ajustarFolio(-1)}
                    className="p-1.5 border-2 border-oxford-300 rounded text-oxford-800 hover:bg-oxford-100 font-bold leading-none"
                    title="Bajar numero del proximo folio"
                  >
                    ▼
                  </button>
                </span>
              ) : null}
            </div>
            {puedeAjustarFolio ? <MoperFolioAuditoriaPanel authHeaders={authHeaders} /> : null}
            {registroCompleto?.codigo_acceso && !esModoRecepcion ? (
              <div className="space-y-2 text-sm uppercase">
                <p>
                  <span className="text-oxford-600 font-medium">Codigo de acceso para el oficial: </span>
                  <span className="font-mono font-semibold text-black">{registroCompleto.codigo_acceso}</span>
                </p>
                <EnlaceCodigoOficial codigo={registroCompleto.codigo_acceso} />
                <EnlacesFirmaInterna registroId={registroCompleto.id} />
              </div>
            ) : null}
          </div>
          {!esModoRecepcion || registroId ? (
            <FormularioMoper
              key={registroId ?? "nuevo"}
              onGuardar={onGuardar}
              registroId={registroId}
              registro={registroCompleto}
              folioPreview={folioPreview}
              puedeEditar={puedeEditar && !esModoRecepcion}
            />
          ) : null}
          {registroId ? (
            <>
              <FirmasWorkflow
                registroId={registroId}
                registro={registroCompleto}
                onFirmaRegistrada={onFirmaRegistrada}
                firmaDestacada={firmaDestacada}
              />
              {registroCompleto ? (
                <div className="mt-6 flex flex-wrap gap-3 justify-end">
                  {!esModoRecepcion ? (
                    <a
                      href={mailtoHref(registroCompleto)}
                      className="btn-secondary min-h-[44px] inline-flex items-center justify-center uppercase"
                    >
                      Enviar por correo
                    </a>
                  ) : null}
                  {puedeReenviarEmailContabilidad && registroCompleto.completado ? (
                    <button
                      type="button"
                      onClick={() => void reenviarEmailContabilidad()}
                      className="btn-secondary min-h-[44px] uppercase"
                    >
                      Notificar contabilidad
                    </button>
                  ) : null}
                  {registroCompleto.completado ? (
                    <>
                      <button type="button" onClick={onGenerarPDF} className="btn-primary min-h-[44px] uppercase">
                        Descargar PDF
                      </button>
                      {!esModoRecepcion ? (
                        <button type="button" onClick={onNuevoRegistro} className="btn-secondary min-h-[44px] uppercase">
                          Nuevo registro
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </main>
      </div>
      <FooterLegal />
    </div>
  );
}
