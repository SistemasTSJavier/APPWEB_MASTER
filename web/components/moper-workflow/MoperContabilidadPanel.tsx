"use client";

import { useCallback, useEffect, useState } from "react";
import { moperFetch } from "@/lib/moper-fetch";
import type { MoperContabilidadItem } from "@/lib/moper-registros-types";
import { formatearFechaLegibleMx } from "@/lib/legal-contratos";

type FiltroRecibido = "todos" | "si" | "no";

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  return d.length === 10 ? formatearFechaLegibleMx(d) : iso.slice(0, 16).replace("T", " ");
}

function fmtFechaHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function MoperContabilidadPanel({
  authHeaders,
  puedeMarcarRecibido,
  puedeReenviarEmail,
  registroSeleccionadoId,
  onRefreshRegistro,
  soloPendientes = false,
  abrirEnNuevaVentana = false,
  etiquetaRecepcion = "Contabilidad",
}: {
  authHeaders: () => Record<string, string>;
  puedeMarcarRecibido: boolean;
  puedeReenviarEmail: boolean;
  registroSeleccionadoId?: number | null;
  onRefreshRegistro?: () => void;
  /** Solo MOPER sin marcar como recibidos (vista Nóminas). */
  soloPendientes?: boolean;
  /** Abrir el registro en pestaña nueva con el flujo completo. */
  abrirEnNuevaVentana?: boolean;
  etiquetaRecepcion?: string;
}) {
  const [items, setItems] = useState<MoperContabilidadItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [recibido, setRecibido] = useState<FiltroRecibido>(soloPendientes ? "no" : "todos");

  const filtroRecibido = soloPendientes ? "no" : recibido;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      if (filtroRecibido !== "todos") params.set("recibido", filtroRecibido);
      const qs = params.toString();
      const r = await moperFetch(`/api/moper/contabilidad${qs ? `?${qs}` : ""}`, { headers: authHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail ?? j.error ?? "Error al cargar");
      setItems((j.items ?? []) as MoperContabilidadItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar historial");
      setItems([]);
    } finally {
      setCargando(false);
    }
  }, [authHeaders, desde, hasta, filtroRecibido]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const abrirRegistro = useCallback(
    (id: number) => {
      const url = `/moper?registro=${id}`;
      if (abrirEnNuevaVentana) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      window.location.assign(url);
    },
    [abrirEnNuevaVentana],
  );

  const marcarRecibido = useCallback(
    async (id: number) => {
      if (
        !window.confirm(
          `¿Confirma que ${etiquetaRecepcion} recibió este MOPER? Esta acción registra el cambio oficial.`,
        )
      ) {
        return;
      }
      setBusyId(id);
      setMsg(null);
      try {
        const r = await moperFetch(`/api/moper/${id}/recibido`, {
          method: "PATCH",
          headers: authHeaders(),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Error");
        setMsg("MOPER marcado como recibido.");
        await cargar();
        if (registroSeleccionadoId === id) onRefreshRegistro?.();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Error al marcar recibido");
      } finally {
        setBusyId(null);
      }
    },
    [authHeaders, cargar, etiquetaRecepcion, onRefreshRegistro, registroSeleccionadoId],
  );

  const reenviarEmail = useCallback(
    async (id: number, pendiente: boolean) => {
      const texto = pendiente
        ? "¿Reenviar recordatorio de MOPER pendiente de recepción?"
        : "¿Reenviar notificación de este MOPER?";
      if (!window.confirm(texto)) return;
      setBusyId(id);
      setMsg(null);
      try {
        const r = await moperFetch(`/api/moper/${id}/notificar-contabilidad`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ pendiente }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Error al enviar correo");
        setMsg(pendiente ? "Recordatorio enviado." : "Correo reenviado.");
        await cargar();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Error al enviar correo");
      } finally {
        setBusyId(null);
      }
    },
    [authHeaders, cargar],
  );

  const tituloSeccion = soloPendientes ? "MOPER pendientes de recepción" : "Historial MOPER recibidos";
  const subtitulo = soloPendientes
    ? `Documentos completados que aún no han sido marcados como recibidos por ${etiquetaRecepcion}. Pulse Ver para revisar firmas y confirmar recepción.`
    : `Documentos completados ordenados por fecha de creación. ${etiquetaRecepcion} puede abrir el enlace y marcar recepción oficial.`;

  return (
    <section className="rounded-xl border-2 border-sky-200 bg-sky-50/40 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">Recepción MOPER</p>
          <h2 className="text-lg font-bold uppercase text-slate-900">{tituloSeccion}</h2>
          <p className="mt-1 text-sm text-slate-700 max-w-3xl">
            {subtitulo}
            {soloPendientes && items.length > 0 ? (
              <span className="ml-1 font-semibold text-amber-800">
                {items.length} pendiente{items.length === 1 ? "" : "s"}.
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          className="btn-secondary min-h-[40px] text-xs uppercase"
        >
          Actualizar
        </button>
      </div>

      {!soloPendientes ? (
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-slate-600">Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-slate-600">Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-slate-600">Recepción</span>
            <select
              value={recibido}
              onChange={(e) => setRecibido(e.target.value as FiltroRecibido)}
              className="rounded border border-slate-300 px-2 py-1.5 min-w-[10rem]"
            >
              <option value="todos">Todos</option>
              <option value="no">Pendientes</option>
              <option value="si">Recibidos</option>
            </select>
          </label>
        </div>
      ) : null}

      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <th className="p-2.5 font-semibold">Creado</th>
              <th className="p-2.5 font-semibold">Folio</th>
              <th className="p-2.5 font-semibold">Oficial</th>
              <th className="p-2.5 font-semibold">Movimiento</th>
              {!soloPendientes ? <th className="p-2.5 font-semibold">Correo</th> : null}
              {!soloPendientes ? <th className="p-2.5 font-semibold">Recepción</th> : null}
              <th className="p-2.5 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={soloPendientes ? 5 : 7} className="p-4 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={soloPendientes ? 5 : 7} className="p-4 text-center text-slate-500">
                  {soloPendientes
                    ? "No hay MOPER pendientes de recepción."
                    : "No hay MOPER completados con los filtros seleccionados."}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const pendiente = !item.recibido_contabilidad_at;
                const activo = registroSeleccionadoId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-100 ${activo ? "bg-sky-50" : ""}`}
                  >
                    <td className="p-2.5 whitespace-nowrap text-slate-800">{fmtFecha(item.created_at)}</td>
                    <td className="p-2.5 font-mono text-xs">{item.folio ?? "—"}</td>
                    <td className="p-2.5">{item.oficial_nombre}</td>
                    <td className="p-2.5 text-xs text-slate-700">
                      <div>
                        {item.servicio_actual_nombre} → {item.servicio_nuevo_nombre}
                      </div>
                      <div className="text-slate-500">
                        {item.puesto_actual_nombre} → {item.puesto_nuevo_nombre}
                      </div>
                    </td>
                    {!soloPendientes ? (
                      <td className="p-2.5 text-xs whitespace-nowrap">
                        {item.email_contabilidad_enviado_at
                          ? fmtFechaHora(item.email_contabilidad_enviado_at)
                          : "Sin enviar"}
                      </td>
                    ) : null}
                    {!soloPendientes ? (
                      <td className="p-2.5 text-xs">
                        {pendiente ? (
                          <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                            Pendiente
                          </span>
                        ) : (
                          <span className="block text-emerald-800 font-medium">
                            {fmtFechaHora(item.recibido_contabilidad_at)}
                            {item.recibido_contabilidad_por ? (
                              <span className="block text-slate-500 font-normal">
                                {item.recibido_contabilidad_por}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                    ) : null}
                    <td className="p-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirRegistro(item.id)}
                          className="rounded border border-sky-700 bg-sky-700 px-3 py-1.5 text-xs font-semibold uppercase text-white hover:bg-sky-800"
                        >
                          Ver
                        </button>
                        {!abrirEnNuevaVentana && puedeMarcarRecibido && pendiente ? (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void marcarRecibido(item.id)}
                            className="rounded border border-emerald-600 bg-emerald-600 px-2 py-1 text-xs font-semibold uppercase text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Recibido
                          </button>
                        ) : null}
                        {puedeReenviarEmail ? (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void reenviarEmail(item.id, pendiente)}
                            className="rounded border border-sky-700 px-2 py-1 text-xs font-semibold uppercase text-sky-900 hover:bg-sky-50 disabled:opacity-60"
                            title={pendiente ? "Recordatorio pendiente de recepción" : "Reenviar notificación"}
                          >
                            {pendiente ? "Recordar" : "Reenviar"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
