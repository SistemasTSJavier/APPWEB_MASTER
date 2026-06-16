"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { AppRole } from "@/lib/app-role";
import { MoperWorkflowProvider, useMoperWorkflow } from "@/components/moper-workflow/MoperWorkflowContext";
import { MoperWorkflowApp } from "@/components/moper-workflow/MoperWorkflowApp";
import { VistaPorCodigo } from "@/components/moper-workflow/VistaPorCodigo";
import { CodigoAccesoPanel } from "@/components/moper-workflow/CodigoAccesoPanel";

function MoperPageContent() {
  const { accesoPorCodigo, loginPorCodigo } = useMoperWorkflow();
  const searchParams = useSearchParams();
  const codigoUrl = searchParams.get("codigo")?.trim().toUpperCase() ?? "";
  const registroParam = searchParams.get("registro")?.trim() ?? "";
  const firmaParam = searchParams.get("firma")?.trim().toLowerCase() ?? "";
  const initialRegistroId = (() => {
    const id = parseInt(registroParam, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  })();
  const firmaDestacada =
    firmaParam === "rh" || firmaParam === "gerente" || firmaParam === "control" ? firmaParam : null;

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
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">MOPER</h1>
        <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
          Captura y firmas internas abajo. El oficial firma en{" "}
          <strong className="text-sky-900">/moper/firma</strong> con su codigo — sin iniciar sesion en la plataforma.
          Gerente RH, Gerente de Operaciones y Centro de Control pueden firmar desde el enlace del correo con su cuenta.
        </p>
      </div>
      <CodigoAccesoPanel />
      <MoperWorkflowApp initialRegistroId={initialRegistroId} firmaDestacada={firmaDestacada} />
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
