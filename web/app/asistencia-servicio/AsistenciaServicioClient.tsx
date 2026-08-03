"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import { AppModuleShell } from "@/components/app-module-shell";
import type { AppRole } from "@/lib/app-role";
import type {
  AsistenciaServicioColaborador,
  AsistenciaServicioFechas,
  AsistenciaServicioPayload,
} from "@/lib/asistencia-servicio";

function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function etiquetaMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

const DETALLE_FILAS: Array<{ key: keyof AsistenciaServicioFechas; label: string }> = [
  { key: "falta", label: "Faltas" },
  { key: "extra", label: "Tiempo extra" },
  { key: "desc", label: "Descanso" },
  { key: "vac", label: "Vacaciones" },
  { key: "inc", label: "Incidencias" },
  { key: "pcgs", label: "Permiso con goce" },
  { key: "psgs", label: "Permiso sin goce" },
  { key: "cap", label: "Capacitación" },
];

function DetalleFechas({ c }: { c: AsistenciaServicioColaborador }) {
  const filas = DETALLE_FILAS.filter((f) => c.fechas[f.key].length > 0);
  if (filas.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-slate-500">
        Sin faltas, tiempo extra, descanso, vacaciones ni incidencias en el periodo seleccionado.
      </p>
    );
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-600">
          <th className="px-4 py-2 w-44">Concepto</th>
          <th className="px-4 py-2">Fechas registradas</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.key} className="border-b border-slate-100 last:border-0">
            <td className="px-4 py-2.5 align-top text-xs font-semibold uppercase text-slate-700">{f.label}</td>
            <td className="px-4 py-2.5 text-slate-800 tabular-nums">{c.fechas[f.key].join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AsistenciaServicioClient({
  appRole,
  email,
  modulosHabilitados,
  initialServicio,
  initialMes,
  esCliente,
}: {
  appRole: AppRole;
  email: string;
  modulosHabilitados?: readonly string[] | null;
  initialServicio?: string;
  initialMes?: string;
  esCliente: boolean;
}) {
  const [mes, setMes] = useState(initialMes?.trim() || mesActual());
  const [semana, setSemana] = useState("");
  const [servicio, setServicio] = useState(initialServicio?.trim() ?? "");
  const [data, setData] = useState<AsistenciaServicioPayload | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("mes", mes);
      if (semana) qs.set("semana", semana);
      if (!esCliente && servicio.trim()) qs.set("servicio", servicio.trim());
      const r = await fetch(`/api/asistencia-servicio?${qs.toString()}`, { cache: "no-store" });
      const j = (await r.json()) as AsistenciaServicioPayload & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setData(j);
      if (!servicio && j.servicio) setServicio(j.servicio);
      if (semana && !j.semanas.some((s) => s.weekStart === semana)) {
        setSemana("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la asistencia.");
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [mes, semana, servicio, esCliente]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = data?.resumen;
  const periodoLabel = data?.semana
    ? (data.semanas.find((s) => s.weekStart === data.semana)?.label ?? data.semana)
    : data
      ? etiquetaMes(data.mesYm)
      : "—";

  const kpis = resumen
    ? [
        { label: "Asistencias", value: resumen.asist },
        { label: "Faltas", value: resumen.falta },
        { label: "Descansos", value: resumen.desc },
        { label: "Vacaciones", value: resumen.vac },
        { label: "Tiempo extra", value: resumen.extra },
        { label: "Incidencias", value: resumen.inc },
      ]
    : [];

  return (
    <AppModuleShell
      role={appRole}
      email={email}
      currentPath="/asistencia-servicio"
      modulosHabilitados={modulosHabilitados}
    >
      <div className="min-w-0 space-y-5">
        <header className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-5 py-6 text-white shadow-sm sm:px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">Consulta de servicio</p>
          <h1 className="mt-1 text-xl font-bold uppercase tracking-wide sm:text-2xl">Asistencia del servicio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Resumen del periodo por colaborador. Use mes o semana; abra el detalle para ver las fechas de cada
            concepto.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-bold uppercase text-slate-900">Periodo</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1">
              <span className="form-label">Mes</span>
              <input
                type="month"
                className="form-control"
                value={mes}
                onChange={(e) => {
                  setMes(e.target.value);
                  setSemana("");
                  setExpanded(null);
                }}
              />
            </label>
            <label className="block space-y-1">
              <span className="form-label">Semana</span>
              <select
                className="form-control"
                value={semana}
                onChange={(e) => {
                  setSemana(e.target.value);
                  setExpanded(null);
                }}
                disabled={!data?.semanas.length}
              >
                <option value="">Todo el mes</option>
                {(data?.semanas ?? []).map((s) => (
                  <option key={s.weekStart} value={s.weekStart}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {!esCliente ? (
              <label className="block space-y-1 sm:col-span-2">
                <span className="form-label">Servicio</span>
                <input
                  className="form-control uppercase"
                  value={servicio}
                  onChange={(e) => setServicio(e.target.value)}
                  placeholder="Nombre del servicio"
                />
              </label>
            ) : (
              <div className="block space-y-1 sm:col-span-2">
                <span className="form-label">Servicio</span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold uppercase text-slate-900">
                  {data?.servicio || servicio || "—"}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-secondary uppercase" disabled={busy} onClick={() => void cargar()}>
              {busy ? "Cargando…" : "Actualizar"}
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
        ) : null}

        {kpis.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{k.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{k.value}</p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
            <h2 className="text-sm font-bold uppercase text-slate-900">Detalle por colaborador</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Periodo: <span className="font-semibold text-slate-700">{periodoLabel}</span>
              {" · "}
              {busy ? "Cargando…" : `${data?.colaboradores.length ?? 0} colaborador(es)`}
              {" · "}
              Seleccione una fila para ver fechas
            </p>
          </div>

          <div className="max-h-[min(70vh,42rem)] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950 text-[10px] font-bold uppercase tracking-wide text-slate-200 shadow-sm">
                <tr>
                  <th className="bg-slate-950 px-4 py-2.5">Colaborador</th>
                  <th className="hidden bg-slate-950 px-3 py-2.5 sm:table-cell">Puesto</th>
                  <th className="bg-slate-950 px-3 py-2.5 text-right">Asist.</th>
                  <th className="bg-slate-950 px-3 py-2.5 text-right">Faltas</th>
                  <th className="bg-slate-950 px-3 py-2.5 text-right">Desc.</th>
                  <th className="bg-slate-950 px-3 py-2.5 text-right">Vac.</th>
                  <th className="bg-slate-950 px-3 py-2.5 text-right">Extra</th>
                  <th className="bg-slate-950 px-3 py-2.5 text-right">Inc.</th>
                  <th className="bg-slate-950 px-4 py-2.5 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {(data?.colaboradores ?? []).map((c) => {
                  const open = expanded === c.noEmpleado;
                  return (
                    <Fragment key={c.noEmpleado}>
                      <tr
                        className={`cursor-pointer border-t border-slate-100 ${
                          open ? "bg-slate-50" : "bg-white hover:bg-slate-50/80"
                        }`}
                        onClick={() => setExpanded(open ? null : c.noEmpleado)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold uppercase text-slate-900">{c.nombre}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {c.noEmpleado}
                            {c.planta ? ` · ${c.planta}` : ""}
                          </p>
                        </td>
                        <td className="hidden px-3 py-3 text-xs uppercase text-slate-600 sm:table-cell">
                          {c.puesto || "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">
                          {c.totales.asist}
                        </td>
                        <td
                          className={`px-3 py-3 text-right tabular-nums font-semibold ${
                            c.totales.falta > 0 ? "text-slate-950" : "text-slate-400"
                          }`}
                        >
                          {c.totales.falta}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{c.totales.desc}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{c.totales.vac}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{c.totales.extra}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{c.totales.inc}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-blue-900">
                          {open ? "Cerrar" : "Ver fechas"}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="border-t border-slate-100 bg-slate-50/80">
                          <td colSpan={9} className="p-0">
                            <DetalleFechas c={c} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!busy && (data?.colaboradores.length ?? 0) === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                Sin colaboradores activos para este servicio en el periodo.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppModuleShell>
  );
}
