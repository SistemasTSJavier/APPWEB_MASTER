"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { APP_ROLE_LABEL, type AppRole } from "@/lib/app-role";
import {
  ALERTAS_LEGAL_ESTADO_LABEL,
  ALERTAS_LEGAL_MOTIVO_LABEL,
  ALERTAS_LEGAL_MOTIVOS,
  type AlertaLegalFila,
  type AlertaLegalMotivo,
} from "@/lib/alertas-legal-types";

type AlertaLegalSugerencia = {
  noEmpleado: string;
  nombre: string;
  servicio: string;
};

const ALERTAS_LEGAL_RECIENTES_KEY = "alertas-legal-recentes";

function pareceNumeroEmpleado(v: string): boolean {
  const t = v.trim();
  return /^[0-9.\s]+$/.test(t);
}

function leerRecientes(): AlertaLegalSugerencia[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERTAS_LEGAL_RECIENTES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => (x && typeof x === "object" ? (x as AlertaLegalSugerencia) : null))
      .filter((x): x is AlertaLegalSugerencia => Boolean(x?.noEmpleado && x?.nombre))
      .slice(0, 6);
  } catch {
    return [];
  }
}

function guardarRecientes(item: AlertaLegalSugerencia) {
  if (typeof window === "undefined") return;
  const prev = leerRecientes().filter((x) => x.noEmpleado !== item.noEmpleado);
  const next = [item, ...prev].slice(0, 6);
  window.localStorage.setItem(ALERTAS_LEGAL_RECIENTES_KEY, JSON.stringify(next));
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-slate-600";

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  } catch {
    return iso;
  }
}

export function AlertasLegalClient({
  appRole,
  email,
  puedeGestionar,
  puedeCancelar,
  puedeMarcarLlegada,
  puedeConfigurar,
}: {
  appRole: AppRole;
  email: string;
  puedeGestionar: boolean;
  puedeCancelar: boolean;
  puedeMarcarLlegada: boolean;
  puedeConfigurar: boolean;
}) {
  const [rows, setRows] = useState<AlertaLegalFila[]>([]);
  const [emailTo, setEmailTo] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"pendiente" | "llego" | "todas">("pendiente");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [noEmp, setNoEmp] = useState("");
  const [busquedaPersona, setBusquedaPersona] = useState("");
  const [nombre, setNombre] = useState("");
  const [servicio, setServicio] = useState("");
  const [motivo, setMotivo] = useState<AlertaLegalMotivo>("renuncia");
  const [notas, setNotas] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [sugerencias, setSugerencias] = useState<AlertaLegalSugerencia[]>([]);
  const [recientes, setRecientes] = useState<AlertaLegalSugerencia[]>([]);
  const recepcionSolo = puedeMarcarLlegada && !puedeGestionar && !puedeCancelar && !puedeConfigurar;

  const load = useCallback(async () => {
    const r = await fetch("/api/alertas-legal", { cache: "no-store" });
    const j = (await r.json()) as { rows?: AlertaLegalFila[]; emailTo?: string; error?: string };
    if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
    setRows(Array.isArray(j.rows) ? j.rows : []);
    if (j.emailTo) {
      setEmailTo(j.emailTo);
      setEmailDraft(j.emailTo);
    }
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Error al cargar"));
  }, [load]);

  useEffect(() => {
    setRecientes(leerRecientes());
  }, []);

  useEffect(() => {
    const t = busquedaPersona.trim();
    if (!puedeGestionar) return;
    if (t.length < 2) {
      setSugerencias(t.length === 0 ? recientes : []);
      return;
    }
    const h = window.setTimeout(() => {
      void (async () => {
        setLookupBusy(true);
        try {
          if (pareceNumeroEmpleado(t)) {
            const r = await fetch("/api/alertas-legal", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ noEmpleado: t }),
            });
            const j = (await r.json()) as { noEmpleado?: string; nombre?: string; servicio?: string };
            if (r.ok && j.noEmpleado && j.nombre) {
              setSugerencias([{ noEmpleado: j.noEmpleado, nombre: j.nombre, servicio: j.servicio ?? "" }]);
              return;
            }
          }
          if (t.length >= 3) {
            const r = await fetch("/api/alertas-legal", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: t }),
            });
            const j = (await r.json()) as { rows?: AlertaLegalSugerencia[] };
            if (r.ok) {
              setSugerencias(Array.isArray(j.rows) ? j.rows : []);
              return;
            }
          }
          setSugerencias([]);
        } catch {
          setSugerencias([]);
        } finally {
          setLookupBusy(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(h);
  }, [busquedaPersona, puedeGestionar, recientes]);

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (recepcionSolo) {
        if (r.estado !== "pendiente") return false;
      } else {
        if (tab === "pendiente" && r.estado !== "pendiente") return false;
        if (tab === "llego" && r.estado !== "llego") return false;
      }
      if (!needle) return true;
      return (
        r.noEmpleado.toLowerCase().includes(needle) ||
        r.nombre.toLowerCase().includes(needle) ||
        r.servicio.toLowerCase().includes(needle)
      );
    });
  }, [q, recepcionSolo, rows, tab]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!noEmp.trim()) {
      setErr("Selecciona una persona del buscador (N.º o nombre).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/alertas-legal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noEmpleado: noEmp,
          nombre,
          servicio,
          motivo,
          notas,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setMsg("Persona agregada a la lista de recepción.");
      setNoEmp("");
      setBusquedaPersona("");
      setNombre("");
      setServicio("");
      setNotas("");
      setMotivo("renuncia");
      setSugerencias([]);
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "No se pudo agregar.");
    } finally {
      setBusy(false);
    }
  }

  async function accion(id: string, tipo: "llego" | "cancelar") {
    setErr(null);
    setMsg(null);
    setActingId(id);
    try {
      const r = await fetch(`/api/alertas-legal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: tipo }),
      });
      const j = (await r.json()) as { error?: string; emailOk?: boolean; emailError?: string; emailTo?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      if (tipo === "llego") {
        if (j.emailOk) setMsg(`Marcado. Correo enviado a ${j.emailTo ?? "Legal"}.`);
        else setMsg(`Marcado en sistema, pero el correo falló: ${j.emailError ?? "sin detalle"}.`);
      } else {
        setMsg("Alerta cancelada.");
      }
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "No se pudo actualizar.");
    } finally {
      setActingId(null);
    }
  }

  async function guardarDestino(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/alertas-legal/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailTo: emailDraft }),
      });
      const j = (await r.json()) as { error?: string; emailTo?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      const next = j.emailTo ?? emailDraft.trim();
      setEmailTo(next);
      setEmailDraft(next);
      setMsg(`Correo destinatario actualizado: ${next}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "No se pudo guardar el correo.");
    } finally {
      setBusy(false);
    }
  }

  function seleccionarSugerencia(item: AlertaLegalSugerencia) {
    setNoEmp(item.noEmpleado);
    setBusquedaPersona(item.nombre);
    setNombre(item.nombre);
    setServicio(item.servicio ?? "");
    setSugerencias([]);
    guardarRecientes(item);
    setRecientes(leerRecientes());
  }

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Módulo</p>
        <h1 className="page-title uppercase">Alertas Legal</h1>
        <p className="page-lead text-sm">
          {puedeConfigurar
            ? "Configura el correo destinatario aquí. Los permisos de cada usuario (ver lista, agregar o marcar llegada) se asignan en Usuarios."
            : puedeGestionar
              ? "Agrega a las personas con alerta activa. Recepción las verá y marcará cuando lleguen a firmar."
              : recepcionSolo
                ? "Aquí solo verás a las personas registradas pendientes de llegada, para confirmar cuando se presenten."
              : puedeMarcarLlegada
                ? "Busca a la persona y pulsa Llegó a firmar para enviar la alerta de seguimiento al instante."
                : "Consulta las personas con alerta activa."}
          {emailTo && !puedeConfigurar ? (
            <>
              {" "}
              Aviso a <span className="font-semibold">{emailTo}</span>.
            </>
          ) : null}
        </p>
        {email ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Sesión {APP_ROLE_LABEL[appRole]} · {email}
          </p>
        ) : null}
      </div>

      {err ? (
        <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}

      {puedeConfigurar ? (
        <section className="card space-y-3">
          <h2 className="text-sm font-bold uppercase text-slate-900">Correo destinatario</h2>
          <p className="text-xs text-slate-600">
            Cuando Recepción marque <strong>Llegó a firmar</strong>, el aviso se envía a este correo. Los permisos de la
            sección se asignan en <strong>Usuarios</strong> (Ver / Editar / Eliminar).
          </p>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => void guardarDestino(e)}>
            <label className="block min-w-0 flex-1 space-y-1.5">
              <span className={labelCls}>Correo</span>
              <input
                className={inputCls}
                type="email"
                required
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="legal@tacticalsupport.com.mx"
              />
            </label>
            <button type="submit" className="btn-primary uppercase sm:shrink-0" disabled={busy}>
              {busy ? "Guardando…" : "Guardar correo"}
            </button>
          </form>
        </section>
      ) : null}

      {puedeGestionar ? (
        <section className="card space-y-4">
          <h2 className="text-sm font-bold uppercase text-slate-900">Agregar a la lista</h2>
          <form className="space-y-4" onSubmit={onAdd}>
            <div className="grid gap-4">
              <label className="block space-y-1.5">
                <span className={labelCls}>Buscar colaborador (N.º o nombre)</span>
                <input
                  className={`${inputCls} uppercase`}
                  value={busquedaPersona}
                  onChange={(e) => setBusquedaPersona(e.target.value)}
                  onFocus={() => {
                    if (!busquedaPersona.trim()) setSugerencias(recientes);
                  }}
                  placeholder="Ej. 12345 o nombre completo"
                />
                <span className="text-[11px] text-slate-500">Sugerencias de colaboradores activos.</span>
                {lookupBusy ? <span className="text-[11px] text-slate-500">Buscando coincidencias…</span> : null}
                {sugerencias.length > 0 ? (
                  <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {sugerencias.map((item) => (
                      <li key={item.noEmpleado}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => seleccionarSugerencia(item)}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold uppercase text-slate-900">{item.nombre}</span>
                            <span className="block text-[11px] text-slate-500">{item.servicio || "Sin servicio"}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs font-bold text-slate-600">{item.noEmpleado}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className={labelCls}>N.º de empleado</span>
                <input className={`${inputCls} font-mono`} value={noEmp} readOnly placeholder="Selecciona una coincidencia" />
              </label>
              <label className="block space-y-1.5">
                <span className={labelCls}>Nombre</span>
                <input
                  className={`${inputCls} uppercase`}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  placeholder="Se completa al encontrar el N.º"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className={labelCls}>Motivo</span>
                <select
                  className={`${inputCls} uppercase`}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as AlertaLegalMotivo)}
                >
                  {ALERTAS_LEGAL_MOTIVOS.map((m) => (
                    <option key={m} value={m}>
                      {ALERTAS_LEGAL_MOTIVO_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className={labelCls}>Servicio</span>
                <input className={`${inputCls} uppercase`} value={servicio} onChange={(e) => setServicio(e.target.value)} />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className={labelCls}>Notas (opcional)</span>
              <input
                className={inputCls}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                maxLength={300}
                placeholder="Ej. No dejar firmar sin Legal presente"
              />
            </label>
            <button type="submit" className="btn-primary uppercase" disabled={busy}>
              {busy ? "Guardando…" : "Agregar a lista"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-bold uppercase text-slate-900">
            {recepcionSolo
              ? "Personas registradas pendientes"
              : tab === "pendiente"
                ? "Pendientes de llegada"
                : tab === "llego"
                  ? "Ya llegaron"
                  : "Todas"}
          </h2>
          {!recepcionSolo ? (
            <div className="flex flex-wrap gap-2">
              {(["pendiente", "llego", "todas"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase ${
                    tab === t ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => setTab(t)}
                >
                  {t === "pendiente" ? "Pendientes" : t === "llego" ? "Llegaron" : "Todas"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <label className="block space-y-1.5">
          <span className={labelCls}>Buscar (nombre o N.º)</span>
          <input
            className={inputCls}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escribe para filtrar al instante"
            autoFocus={!puedeGestionar}
          />
        </label>

        <ul className="divide-y divide-slate-100">
          {visibles.length === 0 ? (
            <li className="py-8 text-center text-sm text-slate-500">No hay personas en este filtro.</li>
          ) : (
            visibles.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold uppercase text-slate-900">{r.nombre}</p>
                  <p className="text-xs text-slate-600">
                    <span className="font-mono font-bold">{r.noEmpleado}</span>
                    {" · "}
                    {ALERTAS_LEGAL_MOTIVO_LABEL[r.motivo]}
                    {r.servicio ? ` · ${r.servicio}` : ""}
                  </p>
                  {r.notas ? <p className="mt-1 text-xs text-slate-500">{r.notas}</p> : null}
                  <p className="mt-1 text-[10px] font-bold uppercase text-slate-500">
                    {ALERTAS_LEGAL_ESTADO_LABEL[r.estado]}
                    {r.llegoAt ? ` · ${fmtWhen(r.llegoAt)}` : ""}
                    {r.emailEnviadoAt ? " · correo enviado" : r.emailError ? " · correo pendiente" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {puedeMarcarLlegada && r.estado === "pendiente" ? (
                    <button
                      type="button"
                      className="rounded-md bg-red-800 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-red-900 disabled:opacity-50"
                      disabled={actingId === r.id}
                      onClick={() => {
                        if (window.confirm(`¿Confirmar que ${r.nombre} llegó a firmar ${ALERTAS_LEGAL_MOTIVO_LABEL[r.motivo]}?`)) {
                          void accion(r.id, "llego");
                        }
                      }}
                    >
                      {actingId === r.id ? "Enviando…" : "Llegó a firmar"}
                    </button>
                  ) : null}
                  {!recepcionSolo && puedeMarcarLlegada && r.estado === "llego" && !r.emailEnviadoAt ? (
                    <button
                      type="button"
                      className="rounded-md bg-amber-700 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-amber-800 disabled:opacity-50"
                      disabled={actingId === r.id}
                      onClick={() => void accion(r.id, "llego")}
                    >
                      {actingId === r.id ? "Reenviando…" : "Reenviar correo"}
                    </button>
                  ) : null}
                  {puedeCancelar && r.estado === "pendiente" ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs uppercase"
                      disabled={actingId === r.id}
                      onClick={() => void accion(r.id, "cancelar")}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
