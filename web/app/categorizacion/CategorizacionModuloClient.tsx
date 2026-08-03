"use client";

import { AppModuleShell } from "@/components/app-module-shell";
import { CatCapacitacionPanel } from "@/components/categorizacion/CatCapacitacionPanel";
import { CatCatalogoCapacitacionesPanel } from "@/components/categorizacion/CatCatalogoCapacitacionesPanel";
import { CatEvaluacionPanel } from "@/components/categorizacion/CatEvaluacionPanel";
import { CatPersonalPanel } from "@/components/categorizacion/CatPersonalPanel";
import { CatRecompensasPanel } from "@/components/categorizacion/CatRecompensasPanel";
import { CatResumenPanel } from "@/components/categorizacion/CatResumenPanel";
import { CategorizacionHero, CategorizacionModuloGrid } from "@/components/categorizacion/categorizacion-ui";
import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import type { AppRole } from "@/lib/app-role";
import { roleEsClienteEnfoque } from "@/lib/app-role";
import { categorizacionModuloMeta, type CategorizacionModuloId } from "@/lib/categorizacion-modulos";

function evalModuloFromUrl(id: CategorizacionModuloId): CatEvalModuloId | null {
  if (id === "recursos-humanos") return "recursos_humanos";
  if (id === "operaciones") return "operaciones";
  if (id === "enfoque-al-cliente") return "enfoque_cliente";
  return null;
}

function ModuloPanel({ moduloId, appRole }: { moduloId: CategorizacionModuloId; appRole: AppRole }) {
  if (moduloId === "dashboard") return null;
  if (moduloId === "personal") return <CatPersonalPanel />;
  if (moduloId === "catalogo-capacitaciones") return <CatCatalogoCapacitacionesPanel />;
  if (moduloId === "capacitacion") return <CatCapacitacionPanel />;
  if (moduloId === "recompensas") return <CatRecompensasPanel />;
  if (moduloId === "nivel") return <CatResumenPanel tipo="nivel" />;
  if (moduloId === "paquete-prestaciones") return <CatResumenPanel tipo="paquete-prestaciones" />;
  const evalMod = evalModuloFromUrl(moduloId);
  if (evalMod) return <CatEvaluacionPanel modulo={evalMod} appRole={appRole} />;
  return null;
}

export function CategorizacionModuloClient({
  appRole,
  email,
  moduloId,
  modulosHabilitados,
}: {
  appRole: AppRole;
  email: string;
  moduloId: CategorizacionModuloId;
  modulosHabilitados?: readonly string[] | null;
}) {
  const meta = categorizacionModuloMeta(moduloId);
  const esClienteEnfoque = roleEsClienteEnfoque(appRole);

  return (
    <AppModuleShell role={appRole} email={email} currentPath="/categorizacion" modulosHabilitados={modulosHabilitados}>
      <div className="min-w-0 space-y-5">
        <CategorizacionHero
          title={meta.label}
          description={meta.description}
          backHref={esClienteEnfoque ? undefined : "/categorizacion"}
          backLabel={esClienteEnfoque ? undefined : "Categorización"}
        />

        <ModuloPanel moduloId={moduloId} appRole={appRole} />

        {!esClienteEnfoque ? (
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">Otros módulos</p>
            <CategorizacionModuloGrid activeId={moduloId} />
          </div>
        ) : null}
      </div>
    </AppModuleShell>
  );
}
