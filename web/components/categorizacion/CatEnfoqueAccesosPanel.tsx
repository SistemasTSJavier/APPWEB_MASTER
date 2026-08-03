"use client";

import { ClientesTemporalesPanel } from "@/components/admin/ClientesTemporalesPanel";
import { conteoActivosPorServicio } from "@/components/categorizacion/CatEmpleadoBuscador";
import type { CatColaboradorActivoOpcion } from "@/lib/categorizacion-types";

/** Panel legado en Categorización: misma lógica que Usuarios → Clientes. */
export function CatEnfoqueAccesosPanel({
  serviciosDisponibles,
}: {
  serviciosDisponibles: string[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        También puede gestionar estos accesos en{" "}
        <a href="/usuarios" className="font-bold uppercase text-sky-800 underline">
          Usuarios → Clientes temporales
        </a>
        .
      </p>
      <ClientesTemporalesPanel serviciosDisponibles={serviciosDisponibles} compact />
    </div>
  );
}

export function serviciosDesdeActivos(activos: CatColaboradorActivoOpcion[]): string[] {
  return conteoActivosPorServicio(activos).map((c) => c.servicio);
}
