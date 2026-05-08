"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listColaboradoresCompletos, type ColaboradorCompleto } from "@/lib/colaboradores-store";

function servicioVisible(c: ColaboradorCompleto): string {
  return (c.servicioAsignado || c.form?.servicio || "").trim();
}

function datosNominaParte4(c: ColaboradorCompleto) {
  const f = c.form ?? {};
  return {
    banco: (f.banco ?? "").trim(),
    noTarjeta: (f.noTarjeta ?? "").trim(),
    clabeInterbancaria: (f.clabeInterbancaria ?? "").trim(),
    numeroCuenta: (f.numeroCuenta ?? "").trim(),
  };
}

function CopyFieldButton({ value, shortLabel }: { value: string; shortLabel: string }) {
  const [ok, setOk] = useState(false);
  const v = value.trim();
  const copy = useCallback(async () => {
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setOk(true);
      window.setTimeout(() => setOk(false), 1400);
    } catch {
      window.prompt("Copiar manualmente:", v);
    }
  }, [v]);

  return (
    <div className="flex items-center gap-1.5">
      <span className="min-w-0 flex-1 break-all font-mono text-xs uppercase text-slate-900">{v || "—"}</span>
      <button
        type="button"
        disabled={!v}
        onClick={copy}
        className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
        title={v ? `Copiar ${shortLabel}` : ""}
      >
        {ok ? "LISTO" : "COPIAR"}
      </button>
    </div>
  );
}

export default function ContabilidadPage() {
  const [rows, setRows] = useState<ColaboradorCompleto[]>([]);
  const [servicio, setServicio] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setRows(listColaboradoresCompletos());
  }, []);

  const serviciosUnicos = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const v = servicioVisible(r);
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter((c) => {
      if (servicio && servicioVisible(c) !== servicio) return false;
      if (!q) return true;
      const nom = (c.nombreCompleto || "").toLowerCase();
      const no = (c.noEmpleado || "").toLowerCase();
      const n = datosNominaParte4(c);
      const blob = [no, nom, n.banco, n.noTarjeta, n.clabeInterbancaria, n.numeroCuenta].join(" ").toLowerCase();
      return nom.includes(q) || no.includes(q) || blob.includes(q);
    });
  }, [rows, servicio, busqueda]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 md:px-6 md:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">CONTABILIDAD</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Datos de <strong className="text-slate-800">PARTE 4 — Nómina y reclutamiento</strong> del expediente (ALTAS): banco,
              tarjeta, CLABE y cuenta. Copia al portapapeles con un clic.
            </p>
          </div>
          <Link href="/" className="btn-secondary uppercase">
            Regresar al inicio
          </Link>
        </div>

        <div className="card mb-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-slate-800">Filtros</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1">
              <span className="form-label uppercase">Servicio</span>
              <select className="form-control uppercase" value={servicio} onChange={(e) => setServicio(e.target.value)}>
                <option value="">TODOS</option>
                {serviciosUnicos.map((sv) => (
                  <option key={sv} value={sv}>
                    {sv.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2 lg:col-span-2">
              <span className="form-label uppercase">Busqueda (nombre, N°, tarjeta, CLABE, cuenta…)</span>
              <input
                className="form-control uppercase"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="FILTRA RESULTADOS"
              />
            </label>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {filtrados.length} / {rows.length} REGISTRO(S)
          </p>
        </div>

        <div className="table-wrap overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="whitespace-nowrap px-3 py-3">N° EMP.</th>
                <th className="px-3 py-3">NOMBRE</th>
                <th className="px-3 py-3">SERVICIO</th>
                <th className="px-3 py-3">BANCO</th>
                <th className="min-w-[200px] px-3 py-3">NO. TARJETA</th>
                <th className="min-w-[200px] px-3 py-3">CLABE INTERBANCARIA</th>
                <th className="min-w-[180px] px-3 py-3">NO. CUENTA</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const n = datosNominaParte4(c);
                return (
                  <tr key={c.noEmpleado} className="table-row-hover align-top">
                    <td className="table-cell font-mono font-medium whitespace-nowrap">{c.noEmpleado}</td>
                    <td className="table-cell font-medium text-slate-900 uppercase">{c.nombreCompleto || "—"}</td>
                    <td className="table-cell text-slate-700 uppercase">{servicioVisible(c) || "—"}</td>
                    <td className="table-cell uppercase text-slate-700">{n.banco || "—"}</td>
                    <td className="table-cell py-2">
                      <CopyFieldButton value={n.noTarjeta} shortLabel="tarjeta" />
                    </td>
                    <td className="table-cell py-2">
                      <CopyFieldButton value={n.clabeInterbancaria} shortLabel="CLABE" />
                    </td>
                    <td className="table-cell py-2">
                      <CopyFieldButton value={n.numeroCuenta} shortLabel="cuenta" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtrados.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600">
              {rows.length === 0
                ? "NO HAY COLABORADORES. CARGA EXPEDIENTES EN ALTAS O POR IMPORT CSV."
                : "NINGUN REGISTRO COINCIDE CON EL FILTRO."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
