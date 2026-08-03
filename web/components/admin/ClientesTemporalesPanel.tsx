"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLIENT_MODULOS_DEFAULT,
  CLIENT_MODULOS_HABILITABLES,
  type ClientModuloId,
} from "@/lib/app-role";
import type { CatEnfoqueAccesoCliente, CatEnfoqueAccesoCreado } from "@/lib/categorizacion-enfoque-acceso";

type AccesoCreadoUi = CatEnfoqueAccesoCreado & { mostrarCredenciales?: boolean };

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function finDefaultIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function ClientesTemporalesPanel({
  serviciosDisponibles = [],
  compact = false,
}: {
  serviciosDisponibles?: string[];
  /** Estilo más compacto (p. ej. embebido en Categorización). */
  compact?: boolean;
}) {
  const [accesos, setAccesos] = useState<CatEnfoqueAccesoCliente[]>([]);
  const [serviciosExtra, setServiciosExtra] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [servicio, setServicio] = useState("");
  const [fechaInicio, setFechaInicio] = useState(hoyIso);
  const [fechaFin, setFechaFin] = useState(finDefaultIso);
  const [nota, setNota] = useState("");
  const [modulos, setModulos] = useState<ClientModuloId[]>([...CLIENT_MODULOS_DEFAULT]);
  const [ultimoCreado, setUltimoCreado] = useState<AccesoCreadoUi | null>(null);
  const [editando, setEditando] = useState<CatEnfoqueAccesoCliente | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/categorizacion/enfoque-accesos", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAccesos(j.rows ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al cargar accesos.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      try {
        const r = await fetch("/api/servicios", { cache: "no-store" });
        const j = (await r.json()) as {
          items?: Array<{ nombre?: string }>;
          rows?: Array<{ nombre?: string; servicio?: string }>;
        };
        if (!r.ok) return;
        const names = [...(j.items ?? []), ...(j.rows ?? [])]
          .map((x) => String((x as { nombre?: string; servicio?: string }).nombre ?? (x as { servicio?: string }).servicio ?? "").trim())
          .filter(Boolean);
        setServiciosExtra(names);
      } catch {
        /* opcional */
      }
    })();
  }, [load]);

  const opcionesServicio = useMemo(() => {
    const set = new Set<string>();
    for (const s of serviciosDisponibles) if (s.trim()) set.add(s.trim());
    for (const s of serviciosExtra) if (s.trim()) set.add(s.trim());
    for (const a of accesos) if (a.servicio.trim()) set.add(a.servicio.trim());
    return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [serviciosDisponibles, serviciosExtra, accesos]);

  function toggleModulo(id: ClientModuloId) {
    setModulos((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function resetForm() {
    setServicio("");
    setFechaInicio(hoyIso());
    setFechaFin(finDefaultIso());
    setNota("");
    setModulos([...CLIENT_MODULOS_DEFAULT]);
    setEditando(null);
  }

  function iniciarEdicion(a: CatEnfoqueAccesoCliente) {
    setEditando(a);
    setServicio(a.servicio);
    setFechaInicio(a.fechaInicio);
    setFechaFin(a.fechaFin);
    setNota(a.nota);
    setModulos(a.modulos?.length ? a.modulos : [...CLIENT_MODULOS_DEFAULT]);
    setUltimoCreado(null);
    setMsg(null);
    setOk(null);
  }

  async function guardar() {
    if (!servicio.trim()) {
      setMsg("Seleccione un servicio.");
      return;
    }
    if (modulos.length === 0) {
      setMsg("Seleccione al menos un módulo.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setOk(null);
    try {
      if (editando) {
        const r = await fetch("/api/categorizacion/enfoque-accesos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editando.id,
            servicio,
            fechaInicio,
            fechaFin,
            nota,
            modulos,
            activo: true,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setOk("Acceso de cliente actualizado.");
        resetForm();
      } else {
        const r = await fetch("/api/categorizacion/enfoque-accesos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ servicio, fechaInicio, fechaFin, nota, modulos }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setUltimoCreado({ ...(j.row as CatEnfoqueAccesoCreado), mostrarCredenciales: true });
        setOk("Usuario temporal creado.");
        setNota("");
        setModulos([...CLIENT_MODULOS_DEFAULT]);
      }
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function revocar(id: string) {
    if (!confirm("¿Revocar este acceso de cliente?")) return;
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
      if (editando?.id === id) resetForm();
      await load();
      setOk("Acceso revocado.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al revocar.");
    } finally {
      setBusy(false);
    }
  }

  const labelModulo = (id: ClientModuloId) =>
    CLIENT_MODULOS_HABILITABLES.find((m) => m.id === id)?.label ?? id;

  return (
    <section
      className={
        compact
          ? "card space-y-4 border-sky-200 bg-sky-50/30"
          : "space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      }
    >
      <div>
        <h2 className="text-sm font-bold uppercase text-slate-900">
          {editando ? "Editar cliente temporal" : "Clientes temporales — acceso por servicio"}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Active solo las secciones que el cliente debe ver. Por defecto: Categorización, Efectividad operativa y
          Asistencia del servicio. El cliente entra en{" "}
          <a href="/login/cliente" className="font-bold text-sky-800 underline">
            /login/cliente
          </a>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[11px] font-bold uppercase text-slate-600">Servicio</span>
          <select className={inputCls} value={servicio} onChange={(e) => setServicio(e.target.value)}>
            <option value="">— Elija servicio —</option>
            {opcionesServicio.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-600">Inicio</span>
          <input
            type="date"
            className={inputCls}
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-600">Fin</span>
          <input type="date" className={inputCls} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </label>
        <label className="block space-y-1 sm:col-span-4">
          <span className="text-[11px] font-bold uppercase text-slate-600">Nota (opcional)</span>
          <input
            className={inputCls}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej. Cliente XYZ — evaluación Q2"
          />
        </label>
      </div>

      <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <legend className="px-1 text-[11px] font-bold uppercase text-slate-700">Módulos habilitados</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {CLIENT_MODULOS_HABILITABLES.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={modulos.includes(m.id)}
                onChange={() => toggleModulo(m.id)}
              />
              <span className="font-semibold">{m.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary uppercase"
          disabled={busy}
          onClick={() => void guardar()}
        >
          {busy ? "Guardando…" : editando ? "Guardar cambios" : "Generar usuario temporal"}
        </button>
        {editando ? (
          <button type="button" className="btn-secondary uppercase" disabled={busy} onClick={resetForm}>
            Cancelar edición
          </button>
        ) : null}
      </div>

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
          <p className="mt-2">
            <strong>Liga de acceso:</strong>{" "}
            <a
              className="font-mono font-bold text-emerald-900 underline break-all"
              href="/login/cliente"
              target="_blank"
              rel="noreferrer"
            >
              /login/cliente
            </a>
          </p>
          <p className="mt-1 text-[10px] font-medium text-emerald-900/80">
            Envíe al cliente la liga completa de su dominio, por ejemplo{" "}
            <span className="font-mono">https://su-dominio/login/cliente</span>
          </p>
          <p>
            <strong>Vigencia:</strong> {ultimoCreado.fechaInicio} → {ultimoCreado.fechaFin}
          </p>
          <p>
            <strong>Módulos:</strong>{" "}
            {(ultimoCreado.modulos ?? []).map(labelModulo).join(" · ") || "—"}
          </p>
        </div>
      ) : null}

      {msg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900">
          {msg}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
          {ok}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
            <tr>
              <th className="p-2 text-left">Servicio</th>
              <th className="p-2 text-left">Correo</th>
              <th className="p-2 text-left">Vigencia</th>
              <th className="p-2 text-left">Módulos</th>
              <th className="p-2 text-center">Estado</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {accesos.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="p-2 font-semibold uppercase">{a.servicio}</td>
                <td className="p-2 font-mono text-[11px]">{a.email}</td>
                <td className="p-2 whitespace-nowrap">
                  {a.fechaInicio} → {a.fechaFin}
                </td>
                <td className="p-2 text-[10px] uppercase text-slate-700">
                  {(a.modulos ?? []).map(labelModulo).join(" · ") || "—"}
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
                <td className="p-2 text-right whitespace-nowrap">
                  {a.activo ? (
                    <>
                      <button
                        type="button"
                        className="mr-3 text-[10px] font-bold uppercase text-sky-800"
                        disabled={busy}
                        onClick={() => iniciarEdicion(a)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-bold uppercase text-red-800"
                        disabled={busy}
                        onClick={() => void revocar(a.id)}
                      >
                        Revocar
                      </button>
                    </>
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
