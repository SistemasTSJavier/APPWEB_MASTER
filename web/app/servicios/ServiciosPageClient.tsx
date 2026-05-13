"use client";

import { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  type CatalogoServicioItem,
  agregarServicioCatalogo,
  eliminarServicioCatalogo,
  fetchServiciosCatalogo,
  integrarServiciosDesdeExpedientes,
} from "@/lib/servicios-catalogo-client";

export function ServiciosPageClient({ puedeEditarCatalogo }: { puedeEditarCatalogo: boolean }) {
  const [items, setItems] = useState<CatalogoServicioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [integrando, setIntegrando] = useState(false);
  const [infoIntegracion, setInfoIntegracion] = useState<string | null>(null);
  /** Evita repetir la integración automática en la misma sesión (primera carga del catálogo). */
  const catalogoSesionInicializada = useRef(false);

  async function ejecutarIntegracionExpedientes() {
    if (!puedeEditarCatalogo) return;
    setInfoIntegracion(null);
    setIntegrando(true);
    setError(null);
    try {
      const res = await integrarServiciosDesdeExpedientes();
      await cargar();
      setInfoIntegracion(
        `${res.inserted} NUEVO(S), ${res.duplicated} YA EXISTIAN (${res.totalCandidates} LINEAS DISTINTAS EN ${res.expedientes} EXPEDIENTE(S)).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR AL INTEGRAR DESDE EXPEDIENTES.");
    } finally {
      setIntegrando(false);
    }
  }

  const cargar = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      let list = await fetchServiciosCatalogo();

      const primeraPasadaSesion = !catalogoSesionInicializada.current;
      catalogoSesionInicializada.current = true;

      if (list.length === 0 && primeraPasadaSesion && puedeEditarCatalogo) {
        try {
          const res = await integrarServiciosDesdeExpedientes();
          list = await fetchServiciosCatalogo();
          if (res.totalCandidates > 0) {
            setInfoIntegracion(
              `INICIAL DESDE EXPEDIENTES: ${res.inserted} NUEVO(S), ${res.duplicated} YA EXISTIAN (${res.totalCandidates} LINEAS DISTINTAS, ${res.expedientes} EXPEDIENTE(S)).`,
            );
          }
        } catch {
          /* Catalogo/colaboradores no disponibles: queda lista vacía */
        }
      }

      setItems(list);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "ERROR AL CARGAR SERVICIOS.");
    } finally {
      setLoading(false);
    }
  }, [puedeEditarCatalogo]);

  useEffect(() => {
    void cargar();
  }, [cargar, puedeEditarCatalogo]);

  async function onAgregar(e: FormEvent) {
    e.preventDefault();
    if (!puedeEditarCatalogo) return;
    const t = nuevo.trim();
    if (!t) return;
    setSaving(true);
    setError(null);
    try {
      await agregarServicioCatalogo(t);
      setNuevo("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "NO SE PUDO GUARDAR.");
    } finally {
      setSaving(false);
    }
  }

  async function onEliminar(id: string) {
    if (!puedeEditarCatalogo) return;
    if (!confirm("¿Eliminar este servicio del catálogo? (No borra datos ya capturados en expedientes.)")) return;
    setError(null);
    try {
      await eliminarServicioCatalogo(id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "NO SE PUDO ELIMINAR.");
    }
  }

  return (
    <div className="w-full">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Catálogo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">SERVICIOS</h1>
            <p className="mt-1 text-base font-medium leading-relaxed text-slate-800">
              Alta, baja y consulta del listado que aparece al capturar <strong>SERVICIO</strong> en Altas (también puedes escribir un
              servicio nuevo en Altas si no está aquí).
            </p>
          </div>
        </div>

        {error ? (
          <div className="card mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold uppercase text-red-900">{error}</div>
        ) : null}

        {infoIntegracion ? (
          <div className="card mb-4 border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold uppercase text-green-900">
            Integracion desde expedientes: {infoIntegracion}
          </div>
        ) : null}

        {puedeEditarCatalogo ? (
        <div className="card mb-4 space-y-3">
          <h2 className="text-sm font-bold uppercase text-slate-800">Desde expedientes actuales</h2>
          <p className="text-sm font-medium text-slate-800">
            Carga todas las líneas de servicio distintas que ya aparecen en <strong>servicio asignado</strong>, <strong>MOPER</strong>{" "}
            y <strong>último servicio</strong> en los expedientes (texto íntegro: CAT RAMOS, U-ERRE NORTE, etc.).
          </p>
          <button
            type="button"
            className="btn-secondary uppercase text-sm"
            disabled={integrando}
            onClick={() => void ejecutarIntegracionExpedientes()}
          >
            {integrando ? "Integrando…" : "Añadir al catálogo los servicios de colaboradores"}
          </button>
        </div>
        ) : (
          <div className="card mb-4 border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase leading-relaxed text-slate-800">
            Modo solo consulta: puedes ver el catalogo. La integracion desde expedientes y el alta o baja de servicios no estan permitidas para tu rol.
          </div>
        )}

        {puedeEditarCatalogo ? (
        <div className="card mb-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-slate-800">Agregar servicio manual</h2>
          <form onSubmit={onAgregar} className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1 space-y-1">
              <span className="form-label uppercase">Nombre del servicio</span>
              <input
                className="form-control uppercase"
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
                placeholder="EJ. CAT RAMOS"
                disabled={saving}
              />
            </label>
            <button type="submit" className="btn-primary uppercase" disabled={saving || !nuevo.trim()}>
              Guardar en catálogo
            </button>
          </form>
          <p className="text-[11px] text-slate-500">
            Requiere Supabase migración <strong className="text-slate-700">004_catalogo_servicios.sql</strong> y variables{" "}
            <strong className="text-slate-700">NEXT_PUBLIC_SUPABASE_URL</strong> / <strong className="text-slate-700">SUPABASE_SERVICE_ROLE_KEY</strong>{" "}
            en el servidor (mismo que expedientes).
          </p>
        </div>
        ) : null}

        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase text-slate-800">Servicios registrados</h2>
            <button type="button" className="btn-secondary uppercase text-xs" onClick={() => void cargar()} disabled={loading}>
              Actualizar
            </button>
          </div>
          {loading ? (
            <p className="text-sm font-semibold text-slate-800 uppercase">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold uppercase text-amber-950">
              SIN SERVICIOS EN EL CATALOGO (O TABLA NO CREADA / API NO DISPONIBLE). LOS CAMPOS EN ALTAS SIGUEN ACEPTANDO TEXTO LIBRE.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm uppercase">
                  <span className="font-medium text-slate-900">{it.nombre}</span>
                  {puedeEditarCatalogo ? (
                    <button
                      type="button"
                      className="link-action text-xs uppercase text-rose-700"
                      onClick={() => void onEliminar(it.id)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/altas" className="link-action font-semibold uppercase">
            Ir a Altas
          </Link>
        </p>
    </div>
  );
}
