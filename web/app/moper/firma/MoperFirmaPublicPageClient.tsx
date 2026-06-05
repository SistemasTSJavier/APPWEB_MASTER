"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MoperWorkflowProvider } from "@/components/moper-workflow/MoperWorkflowContext";
import { CodigoAccesoPanel } from "@/components/moper-workflow/CodigoAccesoPanel";
import { VistaPorCodigo } from "@/components/moper-workflow/VistaPorCodigo";
import { useMoperWorkflow } from "@/components/moper-workflow/MoperWorkflowContext";

function MoperFirmaPublicContent() {
  const { accesoPorCodigo, loginPorCodigo } = useMoperWorkflow();
  const searchParams = useSearchParams();
  const codigoUrl = searchParams.get("codigo")?.trim().toUpperCase() ?? "";

  useEffect(() => {
    if (!codigoUrl || accesoPorCodigo) return;
    void loginPorCodigo(codigoUrl);
  }, [codigoUrl, accesoPorCodigo, loginPorCodigo]);

  if (accesoPorCodigo) {
    return <VistaPorCodigo />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <h1 className="text-lg font-bold uppercase text-slate-900">Firma de conformidad</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Ingrese el <strong>código de acceso</strong> que le compartieron por correo o mensaje. Podrá revisar el
          movimiento y firmar <strong>sin crear cuenta</strong> ni iniciar sesión en la plataforma.
        </p>
      </div>
      <CodigoAccesoPanel variant="public" />
    </div>
  );
}

export function MoperFirmaPublicPageClient() {
  return (
    <MoperWorkflowProvider appRole="nominas" userEmail="" userName="Oficial">
      <Suspense fallback={<p className="text-sm text-slate-600">Cargando…</p>}>
        <MoperFirmaPublicContent />
      </Suspense>
    </MoperWorkflowProvider>
  );
}
