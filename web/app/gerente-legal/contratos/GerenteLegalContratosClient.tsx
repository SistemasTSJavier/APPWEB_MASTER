"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppModuleShell } from "@/components/app-module-shell";
import type { AppRole } from "@/lib/app-role";
import {
  DIAS_ALERTA_EMAIL,
  LEGAL_CONTRATOS_ALERTA_EMAIL,
  MESES_PRUEBA_ADMIN,
  MESES_PRUEBA_OPERATIVA,
  type LegalContratoFila,
  type LegalContratoVista,
  formatearFechaLegibleMx,
} from "@/lib/legal-contratos";

type Payload = {
  referencia: string;
  vista: LegalContratoVista;
  filas: LegalContratoFila[];
  servicios: string[];
  pendientesEmail: number;
  ultimoEnvioEmail: string | null;
  ultimaEjecucionAutomatica: string | null;
};

export function GerenteLegalContratosClient({
  appRole,
  email,
  modulosHabilitados,
}: {
  appRole: AppRole;
  email: string;
  modulosHabilitados?: readonly string[] | null;
}) {
  const [vista, setVista] = useState<LegalContratoVista>("activas");
  const [servicio, setServicio] = useState("");
  const [referencia, setReferencia] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({ vista });
      if (servicio) params.set("servicio", servicio);
      if (busqueda.trim()) params.set("q", busqueda.trim());
      if (referencia) params.set("referencia", referencia);
      const r = await fetch(`/api/gerente-legal/contratos-alertas?${params}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setData({
        referencia: String(j.referencia ?? ""),
        vista,
        filas: Array.isArray(j.filas) ? j.filas : [],
        servicios: Array.isArray(j.servicios) ? j.servicios : [],
        pendientesEmail: Number(j.pendientesEmail ?? 0),
        ultimoEnvioEmail: j.ultimoEnvioEmail ?? null,
        ultimaEjecucionAutomatica: j.ultimaEjecucionAutomatica ?? null,
      });
    } catch (e) {
      setData(null);
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
    }
  }, [vista, servicio, busqueda, referencia]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const filasUrgentes = useMemo(
    () => (data?.filas ?? []).filter((f) => f.diasRestantes >= 0 && f.diasRestantes <= DIAS_ALERTA_EMAIL),
    [data?.filas],
  );

  async function enviarAlertasManual() {
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/gerente-legal/contratos-alertas/enviar", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "No se pudo enviar el correo.");
      setMsg(
        j.enviados > 0
          ? `CORREO ENVIADO A ${LEGAL_CONTRATOS_ALERTA_EMAIL} (${j.enviados} COLABORADOR(ES)).`
          : "NO HAY ALERTAS PENDIENTES DE ENVÍO (< 1 SEMANA Y SIN CORREO PREVIO).",
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL ENVIAR.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppModuleShell
      role={appRole}
      email={email}
      currentPath="/gerente-legal/contratos"
      modulosHabilitados={modulosHabilitados}
    >
      <div className="space-y-4">
        <header className="card border border-violet-100 bg-violet-50/40">
          <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900 sm:text-2xl">
            Gerente Legal — Alertas de contrato
          </h1>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-700 sm:text-sm">
            Colaboradores <strong>nuevos en el mes</strong> o con <strong>menos de 3 meses</strong> de antigüedad (hasta{" "}
            <strong>4 meses</strong> en esta sección). Planta <strong>administración</strong>: prueba de{" "}
            {MESES_PRUEBA_ADMIN} meses; demás plantas: {MESES_PRUEBA_OPERATIVA} meses. Con{" "}
            <strong>{DIAS_ALERTA_EMAIL} días o menos</strong> para vencer el contrato se envía correo automático (al cargar
            esta página, máximo una vez al día, y también con el cron diario en el servidor) a{" "}
            <strong className="text-violet-900">{LEGAL_CONTRATOS_ALERTA_EMAIL}</strong>.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={vista === "activas" ? "btn-primary text-xs uppercase" : "btn-secondary text-xs uppercase"}
            onClick={() => setVista("activas")}
          >
            Alertas activas
          </button>
          <button
            type="button"
            className={vista === "historial" ? "btn-primary text-xs uppercase" : "btn-secondary text-xs uppercase"}
            onClick={() => setVista("historial")}
          >
            Historial (vencidos)
          </button>
        </div>

        <section className="card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="form-label">Fecha de referencia</span>
            <input
              type="date"
              className="form-control"
              value={referencia || data?.referencia || ""}
              onChange={(e) => setReferencia(e.target.value)}
            />
            <span className="text-[10px] text-slate-500">Calcula días restantes a esa fecha (vacío = hoy).</span>
          </label>
          <label className="space-y-1">
            <span className="form-label">Servicio</span>
            <select
              className="form-control uppercase"
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
            >
              <option value="">Todos</option>
              {(data?.servicios ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="form-label">Buscar</span>
            <input
              type="search"
              className="form-control uppercase"
              placeholder="N°, NOMBRE O SERVICIO…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
        </section>

        {data?.ultimaEjecucionAutomatica ? (
          <p className="text-[11px] font-semibold text-slate-600">
            Última revisión automática de envío:{" "}
            {new Date(data.ultimaEjecucionAutomatica).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
          </p>
        ) : null}

        {data && vista === "activas" && data.pendientesEmail > 0 ? (
          <section className="card border-amber-200 bg-amber-50/80">
            <p className="text-sm font-bold text-amber-950">
              {data.pendientesEmail} colaborador(es) con {DIAS_ALERTA_EMAIL} días o menos — el sistema intentará enviar el
              correo al abrir esta pantalla (si no se envió hoy).
            </p>
            {appRole === "admin" || appRole === "gerente_legal" ? (
              <button
                type="button"
                className="btn-secondary mt-2 text-xs uppercase"
                disabled={enviando || busy}
                onClick={() => void enviarAlertasManual()}
              >
                {enviando ? "Enviando…" : "Reenviar ahora (admin)"}
              </button>
            ) : null}
            {data.ultimoEnvioEmail ? (
              <p className="mt-2 text-[11px] text-amber-900">
                Último correo registrado: {new Date(data.ultimoEnvioEmail).toLocaleString("es-MX")}
              </p>
            ) : null}
          </section>
        ) : null}

        {msg ? (
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-800">
            {msg}
          </p>
        ) : null}

        <section className="card overflow-x-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase text-slate-900">
              {vista === "activas" ? "Contratos vigentes" : "Contratos vencidos"} ({data?.filas.length ?? 0})
            </h2>
            <button type="button" className="text-xs font-bold uppercase text-violet-800" disabled={busy} onClick={() => void load()}>
              Actualizar
            </button>
          </div>

          {busy ? <p className="text-sm text-slate-500">Cargando…</p> : null}

          {!busy && (data?.filas.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {vista === "activas"
                ? "Sin colaboradores en periodo de seguimiento con los filtros actuales."
                : "Sin contratos vencidos en el historial con los filtros actuales."}
            </p>
          ) : null}

          {(data?.filas.length ?? 0) > 0 ? (
            <div className="max-h-[min(70vh,40rem)] overflow-auto rounded-lg border border-slate-100">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                  <tr>
                    <th className="p-2">N°</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Servicio</th>
                    <th className="p-2">Planta</th>
                    <th className="p-2">Ingreso</th>
                    <th className="p-2">Prueba</th>
                    <th className="p-2">Vence contrato</th>
                    <th className="p-2">Tiempo restante</th>
                    <th className="p-2">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.filas.map((f) => (
                    <tr
                      key={`${f.noEmpleado}-${f.fechaVencimientoContrato}`}
                      className={`border-b border-slate-100 ${
                        filasUrgentes.some((u) => u.noEmpleado === f.noEmpleado) ? "bg-amber-50/90" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="p-2 font-mono font-bold">{f.noEmpleado}</td>
                      <td className="p-2">{f.nombre}</td>
                      <td className="p-2">{f.servicio || "—"}</td>
                      <td className="p-2">
                        {f.planta || "—"}
                        {f.esPlantaAdministracion ? (
                          <span className="ml-1 text-[9px] font-bold text-violet-800">(ADM)</span>
                        ) : null}
                      </td>
                      <td className="p-2 whitespace-nowrap">{formatearFechaLegibleMx(f.fechaIngreso)}</td>
                      <td className="p-2">{f.mesesPrueba} mes(es)</td>
                      <td className="p-2 whitespace-nowrap font-semibold">
                        {formatearFechaLegibleMx(f.fechaVencimientoContrato)}
                      </td>
                      <td className="p-2 font-bold tabular-nums">{f.textoRestante}</td>
                      <td className="p-2 text-[10px]">
                        {f.alertaEmailEnviada ? (
                          <span className="font-bold text-emerald-800">Enviado</span>
                        ) : f.alertaEmailPendiente ? (
                          <span className="font-bold text-amber-900">Pendiente</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </AppModuleShell>
  );
}
