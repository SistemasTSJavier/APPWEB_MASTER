"use client";

import { useEffect, useState } from "react";
import type { AppRole } from "@/lib/app-role";
import { roleMayUploadSgc, sgcDepartamentoDesdeUsuario, userMayModulo } from "@/lib/app-role";
import { SGC_DEPARTAMENTOS, sgcDepartamentoLabel } from "@/lib/sgc-calidad";
import { SgcCategoryGrid, SgcHero, SgcUploadWizard } from "@/components/sgc/sgc-ui";

export function SgcHomeClient({
  appRole,
  userMetadata,
}: {
  appRole: AppRole;
  userMetadata?: Record<string, unknown> | null;
}) {
  const puedeGestionar =
    roleMayUploadSgc(appRole) && userMayModulo(appRole, userMetadata ?? null, "/sgc", "editar");
  const deptoFijo = sgcDepartamentoDesdeUsuario(appRole, userMetadata);
  const [departamentos, setDepartamentos] = useState(
    SGC_DEPARTAMENTOS.map((d) => ({ id: d.id, label: d.label })),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/catalogos/departamentos", { cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as {
          departamentos?: { id: string; label: string }[];
        };
        if (!cancelled && r.ok && j.departamentos?.length) setDepartamentos(j.departamentos);
      } catch {
        /* builtins */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-w-0 space-y-5">
      <SgcHero
        eyebrow="Calidad"
        title="Sistemas de gestión de calidad"
        description={
          puedeGestionar
            ? "Suba formatos eligiendo archivo, departamento con acceso y módulo. Los demás usuarios solo consultan los de su área."
            : deptoFijo
              ? `Consulta de formatos de ${sgcDepartamentoLabel(deptoFijo)}. Solo lectura; la carga la realiza Mejora continua o Administración.`
              : "Documentación organizada por tipo y por departamento."
        }
      />

      {puedeGestionar ? <SgcUploadWizard /> : null}

      {!puedeGestionar && deptoFijo ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 shadow-sm sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Su departamento</p>
          <p className="mt-1 text-sm font-extrabold text-emerald-950">{sgcDepartamentoLabel(deptoFijo)}</p>
          <p className="mt-1 text-xs text-emerald-900/80">
            Abra una carpeta para ver únicamente los formatos asignados a su área.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Departamentos</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {departamentos.map((d) => (
              <span
                key={d.id}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-700"
              >
                {d.label}
              </span>
            ))}
          </p>
        </div>
      )}

      <SgcCategoryGrid />
    </div>
  );
}
