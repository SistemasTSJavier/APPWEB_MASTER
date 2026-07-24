"use client";

import { AppModuleShell } from "@/components/app-module-shell";
import Link from "next/link";
import { CategorizacionHero, CategorizacionModuloGrid } from "@/components/categorizacion/categorizacion-ui";
import type { AppRole } from "@/lib/app-role";

export function CategorizacionHomeClient({
  appRole,
  email,
  modulosHabilitados,
}: {
  appRole: AppRole;
  email: string;
  modulosHabilitados?: readonly string[] | null;
}) {
  return (
    <AppModuleShell
      role={appRole}
      email={email}
      currentPath="/categorizacion"
      modulosHabilitados={modulosHabilitados}
    >
      <div className="min-w-0 space-y-5">
        <CategorizacionHero
          title="Categorización"
          description="Acceso a los módulos de clasificación: personal, recursos humanos, capacitación, operaciones, enfoque al cliente, nivel y paquete de prestaciones."
        />
        <div className="flex flex-wrap gap-3">
          <Link href="/categorizacion/dashboard" className="btn-primary uppercase">
            Mostrar dashboard
          </Link>
          <Link href="/categorizacion/dashboard" className="btn-secondary uppercase">
            Exportar dashboard (PDF / imagen)
          </Link>
        </div>
        <CategorizacionModuloGrid />
      </div>
    </AppModuleShell>
  );
}
