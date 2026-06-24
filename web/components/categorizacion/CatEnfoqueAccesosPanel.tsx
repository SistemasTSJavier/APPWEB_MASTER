"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatEnfoqueAccesoCliente, CatEnfoqueAccesoCreado } from "@/lib/categorizacion-enfoque-acceso";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";
import { conteoActivosPorServicio } from "@/components/categorizacion/CatEmpleadoBuscador";
import type { CatColaboradorActivoOpcion } from "@/lib/categorizacion-types";

type AccesoCreadoUi = CatEnfoqueAccesoCreado & { mostrarCredenciales?: boolean };

export function CatEnfoqueAccesosPanel({
  serviciosDisponibles,
}: {
  serviciosDisponibles: string[];
}) {
  const [accesos, setAccesos] = useState<CatEnfoqueAccesoCliente[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [servicio, setServicio] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [nota, setNota] = useState("");
  const [ultimoCreado, setUltimoCreado] = useState<AccesoCreadoUi | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/categorizacion/enfoque-accesos", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAccesos(j.rows ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR ACCESOS.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const opcionesServicio = useMemo(() => {
    const set = new Set(serviciosDisponibles.map((s) => s.trim()).filter(Boolean));
    for (const a of accesos) set.add(a.servicio);
    return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [serviciosDisponibles, accesos]);

  async function generarAcceso() {
    if (!servicio.trim()) {
      setMsg("SELECCIONE UN SERVICIO.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setUltimoCreado(null);
    try {
      const r = await fetch("/api/categorizacion/enfoque-accesos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicio, fechaInicio, fechaFin, nota }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setUltimoCreado({ ...(j.row as CatEnfoqueAccesoCreado), mostrarCredenciales: true });
      setNota("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CREAR ACCESO.");
    } finally {
      setBusy(false);
    }
  }

  async function revocar(id: string) {
    if (!confirm("¿Revocar este acceso de cliente? El usuario no podrá iniciar sesión para calificar.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/enfoque-accesos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion: "revocar" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL REVOCAR.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 border-violet-200 bg-violet-50/30">
      <div>
        <h2 className="text-sm font-bold uppercase text-violet-950">Accesos temporales — cliente por servicio</h2>
        <p className="mt-1 text-xs text-slate-600">
          Solo el administrador puede crear cuentas de <strong>consulta</strong> para que el cliente vea{" "}
          <strong>Enfoque al cliente</strong> y el dashboard de los colaboradores activos del servicio. La vigencia
          limita el tiempo de acceso.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1 sm:col-span-2">
          <span className="form-label">Servicio</span>
          <select className="form-control uppercase" value={servicio} onChange={(e) => setServicio(e.target.value)}>
            <option value="">— Elija servicio —</option>
            {opcionesServicio.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="form-label">Inicio</span>
          <input type="date" className="form-control" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="form-label">Fin</span>
          <input type="date" className="form-control" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </label>
        <label className="block space-y-1 sm:col-span-4">
          <span className="form-label">Nota (opcional)</span>
          <input className="form-control" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Cliente XYZ — evaluación Q2" />
        </label>
      </div>

      <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void generarAcceso()}>
        Generar usuario temporal
      </button>

      {ultimoCreado?.mostrarCredenciales ? (
        <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-xs text-emerald-950">
          <p className="font-bold uppercase">Credenciales (cópielas ahora; la contraseña no se vuelve a mostrar)</p>
          <p className="mt-2">
            <strong>Servicio:</strong> {ultimoCreado.servicio}
          </p>
          <p>
            <strong>Correo:</strong> <span className="font-mono">{ultimoCreado.email}</span>
          </p>
          <p>
            <strong>Contraseña:</strong> <span className="font-mono">{ultimoCreado.passwordPlano}</span>
          </p>
          <p>
            <strong>Vigencia:</strong> {ultimoCreado.fechaInicio} → {ultimoCreado.fechaFin}
          </p>
        </div>
      ) : null}

      <CatMsg msg={msg} />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
            <tr>
              <th className="p-2 text-left">Servicio</th>
              <th className="p-2 text-left">Correo</th>
              <th className="p-2 text-left">Vigencia</th>
              <th className="p-2 text-center">Estado</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {accesos.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="p-2 font-semibold uppercase">{a.servicio}</td>
                <td className="p-2 font-mono text-[11px]">{a.email}</td>
                <td className="p-2">
                  {a.fechaInicio} → {a.fechaFin}
                </td>
                <td className="p-2 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      a.vigente ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {!a.activo ? "Revocado" : a.vigente ? "Vigente" : "Fuera de vigencia"}
                  </span>
                </td>
                <td className="p-2 text-right">
                  {a.activo ? (
                    <button
                      type="button"
                      className="text-[10px] font-bold uppercase text-red-800"
                      disabled={busy}
                      onClick={() => void revocar(a.id)}
                    >
                      Revocar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accesos.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">Sin accesos registrados.</p>
        ) : null}
      </div>
    </section>
  );
}

export function serviciosDesdeActivos(activos: CatColaboradorActivoOpcion[]): string[] {
  return conteoActivosPorServicio(activos).map((c) => c.servicio);
}
