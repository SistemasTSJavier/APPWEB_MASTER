"use client";

import { FormEvent, useCallback, useEffect, useState, useRef, type ChangeEvent } from "react";
import Link from "next/link";
import {
  type CatalogoServicioItem,
  agregarServicioCatalogo,
  actualizarServicioCatalogo,
  eliminarServicioCatalogo,
  fetchServiciosCatalogo,
  integrarServiciosDesdeExpedientes,
  importarServiciosCatalogoDosColumnasCsv,
} from "@/lib/servicios-catalogo-client";

type DraftFila = { nombre: string; numero: string; planta: string };

export function ServiciosPageClient({
  puedeEditarCatalogo,
  puedeImportarCsvDosColumnasAdmin,
}: {
  puedeEditarCatalogo: boolean;
  puedeImportarCsvDosColumnasAdmin: boolean;
}) {
  const [items, setItems] = useState<CatalogoServicioItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftFila>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [nuevoNumero, setNuevoNumero] = useState("");
  const [nuevoPlanta, setNuevoPlanta] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [integrando, setIntegrando] = useState(false);
  const [infoIntegracion, setInfoIntegracion] = useState<string | null>(null);
  /** Evita repetir la integración automática en la misma sesión (primera carga del catálogo). */
  const catalogoSesionInicializada = useRef(false);
  const fileImportCsvRef = useRef<HTMLInputElement>(null);
  const [importandoCsv, setImportandoCsv] = useState(false);
  const [infoImportCsv, setInfoImportCsv] = useState<string | null>(null);

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
      const d: Record<string, DraftFila> = {};
      for (const it of list) {
        d[it.id] = {
          nombre: it.nombre,
          numero: (it.numero_servicio ?? "").trim(),
          planta: (it.planta ?? "").trim(),
        };
      }
      setDrafts(d);
    } catch (e) {
      setItems([]);
      setDrafts({});
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
      await agregarServicioCatalogo({
        nombre: t,
        numero_servicio: nuevoNumero.trim() || null,
        planta: nuevoPlanta.trim() || null,
      });
      setNuevo("");
      setNuevoNumero("");
      setNuevoPlanta("");
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

  async function onGuardarFila(id: string) {
    if (!puedeEditarCatalogo) return;
    const d = drafts[id];
    if (!d) return;
    const nombre = d.nombre.trim();
    if (!nombre) {
      setError("EL NOMBRE NO PUEDE QUEDAR VACIO.");
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      await actualizarServicioCatalogo({
        id,
        nombre,
        numero_servicio: d.numero.trim() || null,
        planta: d.planta.trim() || null,
      });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "NO SE PUDO ACTUALIZAR.");
    } finally {
      setSavingId(null);
    }
  }

  function setDraft(id: string, patch: Partial<DraftFila>) {
    setDrafts((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }

  async function onImportCsvDosColumnas(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f || !puedeImportarCsvDosColumnasAdmin) return;
    setImportandoCsv(true);
    setError(null);
    setInfoImportCsv(null);
    try {
      const res = await importarServiciosCatalogoDosColumnasCsv(f);
      const summary = `CSV: ${res.inserted} nuevo(s), ${res.updated} actualizado(s) (N.º y/o planta), ${res.skipped} sin cambio u omitido(s) (${res.totalInput} filas).`;
      const errPart =
        res.errors.length > 0
          ? ` Avisos: ${res.errors
              .slice(0, 8)
              .map((x) => `Línea ${x.line}: ${x.message}`)
              .join(" · ")}${res.errors.length > 8 ? " …" : ""}`
          : "";
      const hints = [res.hint008, res.hint010].filter(Boolean).join("\n\n");
      const hintPart = hints ? `\n\n${hints}` : "";
      setInfoImportCsv(`${summary}${errPart}${hintPart}`);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ERROR AL IMPORTAR CSV.");
    } finally {
      setImportandoCsv(false);
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
            servicio nuevo en Altas si no está aquí). El <strong>N.º de servicio</strong> se usa en Cuadrícula (asistencia).
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

      {puedeImportarCsvDosColumnasAdmin ? (
        <div className="card mb-4 space-y-3 border border-indigo-200 bg-indigo-50/80">
          <h2 className="text-sm font-bold uppercase text-indigo-950">Importar CSV (solo administrador)</h2>
          <p className="text-sm font-medium text-slate-800">
            Archivo <strong>CSV</strong> con <strong>dos o tres columnas</strong> (coma o punto y coma según Excel): (1){' '}
            <strong>nombre del servicio</strong>, (2) <strong>N.º de servicio</strong>, (3) opcional{' '}
            <strong>planta</strong>. Primera fila puede ser encabezado reconocible (p. ej.{' '}
            <code className="rounded bg-white px-1">
              nombre_servicio,numero_servicio,planta
            </code>
            ). Con <strong>dos columnas</strong>: igual que antes — si el servicio existe, solo se actualiza el N.º (vacío = quitar número).
            Con <strong>tres columnas</strong>: por cada nombre se actualizan <strong>N.º y planta</strong> en catálogo (vacío = borrar ese dato).
            Servicios nuevos se crean con número y planta si vienen en el archivo.
          </p>
          <input
            ref={fileImportCsvRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            aria-label="Seleccionar archivo CSV de servicios: nombre, número de servicio y opcionalmente planta"
            onChange={(e) => void onImportCsvDosColumnas(e)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary uppercase text-sm"
              disabled={importandoCsv}
              onClick={() => fileImportCsvRef.current?.click()}
            >
              {importandoCsv ? "Importando…" : "Elegir CSV e importar"}
            </button>
            <span className="text-xs font-semibold uppercase text-indigo-900">Máx. 5000 filas · 512 KB</span>
          </div>
        </div>
      ) : null}

      {infoImportCsv ? (
        <div className="card mb-4 border border-indigo-200 bg-white px-4 py-3 text-sm font-medium normal-case leading-relaxed text-slate-900 whitespace-pre-line">
          {infoImportCsv}
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
            <label className="w-[140px] space-y-1">
              <span className="form-label uppercase">N.º servicio</span>
              <input
                className="form-control"
                value={nuevoNumero}
                onChange={(e) => setNuevoNumero(e.target.value)}
                placeholder="OPCIONAL"
                disabled={saving}
                maxLength={64}
              />
            </label>
            <label className="min-w-[140px] flex-1 space-y-1">
              <span className="form-label uppercase">Planta</span>
              <input
                className="form-control uppercase"
                value={nuevoPlanta}
                onChange={(e) => setNuevoPlanta(e.target.value)}
                placeholder="OPCIONAL"
                disabled={saving}
                maxLength={128}
              />
            </label>
            <button type="submit" className="btn-primary uppercase" disabled={saving || !nuevo.trim()}>
              Guardar en catálogo
            </button>
          </form>
          <p className="text-[11px] text-slate-500">
            Migraciones: <strong className="text-slate-700">004_catalogo_servicios.sql</strong> y{" "}
            <strong className="text-slate-700">008_catalogo_servicios_numero.sql</strong> (N.º) y{" "}
            <strong className="text-slate-700">010_catalogo_servicios_planta.sql</strong> (Planta). Variables{" "}
            <strong className="text-slate-700">NEXT_PUBLIC_SUPABASE_URL</strong> / <strong className="text-slate-700">SUPABASE_SERVICE_ROLE_KEY</strong>{" "}
            en el servidor.
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
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-700">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="w-[140px] px-3 py-2">N.º servicio</th>
                  <th className="min-w-[120px] px-3 py-2">Planta</th>
                  {puedeEditarCatalogo ? <th className="w-[200px] px-3 py-2 text-right">Acciones</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it) => {
                  const d = drafts[it.id] ?? {
                    nombre: it.nombre,
                    numero: (it.numero_servicio ?? "").trim(),
                    planta: (it.planta ?? "").trim(),
                  };
                  return (
                    <tr key={it.id} className="align-top uppercase">
                      <td className="px-3 py-2">
                        {puedeEditarCatalogo ? (
                          <input
                            className="form-control w-full text-sm uppercase"
                            value={d.nombre}
                            onChange={(e) => setDraft(it.id, { nombre: e.target.value })}
                            aria-label={`Nombre ${it.nombre}`}
                          />
                        ) : (
                          <span className="font-medium text-slate-900">{it.nombre}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {puedeEditarCatalogo ? (
                          <input
                            className="form-control w-full text-sm"
                            value={d.numero}
                            onChange={(e) => setDraft(it.id, { numero: e.target.value })}
                            placeholder="—"
                            maxLength={64}
                            aria-label={`Número de servicio ${it.nombre}`}
                          />
                        ) : (
                          <span className="font-mono text-slate-800">{(it.numero_servicio ?? "").trim() || "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {puedeEditarCatalogo ? (
                          <input
                            className="form-control w-full text-sm uppercase"
                            value={d.planta}
                            onChange={(e) => setDraft(it.id, { planta: e.target.value })}
                            placeholder="—"
                            maxLength={128}
                            aria-label={`Planta ${it.nombre}`}
                          />
                        ) : (
                          <span className="text-slate-800">{(it.planta ?? "").trim() || "—"}</span>
                        )}
                      </td>
                      {puedeEditarCatalogo ? (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="btn-secondary mr-2 text-xs uppercase"
                            disabled={savingId === it.id}
                            onClick={() => void onGuardarFila(it.id)}
                          >
                            {savingId === it.id ? "Guardando…" : "Guardar"}
                          </button>
                          <button type="button" className="link-action text-xs uppercase text-rose-700" onClick={() => void onEliminar(it.id)}>
                            Eliminar
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
