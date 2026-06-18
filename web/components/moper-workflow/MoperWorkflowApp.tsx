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

type MoperWorkflowAppProps = {
  initialRegistroId?: number | null;
  firmaDestacada?: string | null;
};

export function MoperWorkflowApp({ initialRegistroId = null, firmaDestacada = null }: MoperWorkflowAppProps) {
  const { user, authHeaders, puedeEditar, appRole } = useMoperWorkflow();
  const [folioPreview, setFolioPreview] = useState("SPT/No. 0280/MOP");
  const [registroId, setRegistroId] = useState<number | null>(null);
  const [registroCompleto, setRegistroCompleto] = useState<RegistroMoper | null>(null);
  const [refreshPanel, setRefreshPanel] = useState(0);

  useEffect(() => {
    moperFetch("/api/folios/preview", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: { folio?: string }) => d.folio && setFolioPreview(d.folio))
      .catch(() => {});
  }, [authHeaders]);

  const cargarRegistro = useCallback(
    (id: number) => {
      moperFetch(`/api/moper/${id}`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((r: RegistroMoper) => {
          setRegistroCompleto(r);
          if (r.folio) setFolioPreview(r.folio);
        })
        .catch(() => setRegistroCompleto(null));
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
    actualizarFolioPreview();
  }, [actualizarFolioPreview]);

  const mailtoHref = useCallback((registro: RegistroMoper) => {
    const subject = `MOPER - ${registro.folio || "Movimiento de Personal"}`;
    const body = buildMailtoBody(registro);
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, []);

  const puedeAjustarFolio = moperWorkflowPuedeAjustarFolio(appRole);

  return (
    <div className="flex flex-col rounded-xl border-2 border-oxford-200 bg-white overflow-hidden min-h-[480px]">
      <MoperWorkflowHeader />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <PanelLateral
          registroIdActual={registroId}
          onSeleccionarRegistro={onSeleccionarRegistro}
          onNuevoRegistro={onNuevoRegistro}
          refreshTrigger={refreshPanel}
        />
        <main className="flex-1 min-w-0 w-full px-3 sm:px-4 py-4 sm:py-6 overflow-auto">
          <p className="text-center font-bold text-oxford-800 text-base sm:text-lg mb-4 sm:mb-6 uppercase">
            Movimiento de Personal (MOPER)
          </p>
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
            {registroCompleto?.codigo_acceso ? (
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
          <FormularioMoper
            onGuardar={onGuardar}
            registroId={registroId}
            registro={registroCompleto}
            folioPreview={folioPreview}
            puedeEditar={puedeEditar}
          />
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
                  <a
                    href={mailtoHref(registroCompleto)}
                    className="btn-secondary min-h-[44px] inline-flex items-center justify-center uppercase"
                  >
                    Enviar por correo
                  </a>
                  {registroCompleto.completado ? (
                    <>
                      <button type="button" onClick={onGenerarPDF} className="btn-primary min-h-[44px] uppercase">
                        Descargar PDF
                      </button>
                      <button type="button" onClick={onNuevoRegistro} className="btn-secondary min-h-[44px] uppercase">
                        Nuevo registro
                      </button>
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
