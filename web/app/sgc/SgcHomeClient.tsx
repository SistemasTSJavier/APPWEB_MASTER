"use client";

import { SGC_DEPARTAMENTOS } from "@/lib/sgc-calidad";
import { SgcCategoryGrid, SgcHero } from "@/components/sgc/sgc-ui";

export function SgcHomeClient() {
  return (
    <div className="min-w-0 space-y-5">
      <SgcHero
        eyebrow="Calidad"
        title="Sistemas de gestión de calidad"
        description="Documentación organizada por tipo y por departamento. Elija una carpeta para consultar o cargar archivos de su área."
      />

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Departamentos</p>
        <p className="mt-2 flex flex-wrap gap-1.5">
          {SGC_DEPARTAMENTOS.map((d) => (
            <span
              key={d.id}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-700"
            >
              {d.label}
            </span>
          ))}
        </p>
      </div>

      <SgcCategoryGrid />
    </div>
  );
}
