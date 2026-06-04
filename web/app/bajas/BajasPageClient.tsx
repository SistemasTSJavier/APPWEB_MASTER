"use client";

import { useCallback, useEffect, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { listColaboradoresCompletos } from "@/lib/colaboradores-store";
import type { AppRole } from "@/lib/app-role";
import { BajasRegistroForm } from "@/app/bajas/BajasRegistroForm";
import { BajasConsultaHistorial } from "@/app/bajas/BajasConsultaHistorial";

export function BajasPageClient({
  readOnly,
  appRole,
}: {
  readOnly: boolean;
  appRole: AppRole;
}) {
  const [rows, setRows] = useState<ColaboradorCompleto[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  /** Solo cambia al seleccionar/limpiar colaborador (no en cada tecla del formulario). */
  const [colaboradorActivoNo, setColaboradorActivoNo] = useState("");

  useEffect(() => {
    let cancel = false;
    void (async () => {
      setLoadErr(null);
      try {
        const list = await listColaboradoresCompletos();
        if (!cancel) setRows(list);
      } catch (e) {
        if (!cancel) {
          setRows([]);
          setLoadErr(e instanceof Error ? e.message : "ERROR AL CARGAR COLABORADORES.");
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const onColaboradorActivoChange = useCallback((no: string) => {
    setColaboradorActivoNo(no.trim().toUpperCase());
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
          <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">BAJAS</h1>
        </div>
      </div>

      {loadErr ? (
        <div className="card mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold uppercase text-red-900">
          {loadErr}
        </div>
      ) : null}

      {readOnly ? (
        <div className="card mb-4 border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold uppercase leading-relaxed text-slate-800">
          Modo solo consulta: puedes usar la consulta de bajas registradas. El registro y edicion de bajas no esta
          permitido para tu rol.
        </div>
      ) : (
        <BajasRegistroForm
          rows={rows}
          onRowsChange={setRows}
          onColaboradorActivoChange={onColaboradorActivoChange}
        />
      )}

      <BajasConsultaHistorial rows={rows} appRole={appRole} highlightNoEmpleado={colaboradorActivoNo} />
    </div>
  );
}
