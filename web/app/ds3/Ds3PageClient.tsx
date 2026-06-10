"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listColaboradoresCompletos, type ColaboradorCompleto } from "@/lib/colaboradores-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type AppRole, roleMayEditDs3 } from "@/lib/app-role";
import { formatoFechaDiaMesAnio } from "@/lib/fecha-formato-display";
import { type Ds3ArchivoListado, esPdfMime, puedePrevisualizarEnPagina } from "@/lib/ds3-archivo";
import { DS3_BUCKET, DS3_MAX_ARCHIVOS_POR_LOTE, DS3_MAX_MB } from "@/lib/ds3-constants";
import { prepararArchivoDs3 } from "@/lib/ds3-optimizar-client";

function coincideNoONombre(c: ColaboradorCompleto, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return false;
  return c.noEmpleado.toLowerCase().includes(n) || c.nombreCompleto.toLowerCase().includes(n);
}

function formatoFecha(iso: string | null): string {
  if (!iso?.trim()) return "—";
  return formatoFechaDiaMesAnio(iso);
}

function formatoTamano(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function fetchDs3Files(noEmpleado: string): Promise<Ds3ArchivoListado[]> {
  const r = await fetch(`/api/ds3/archivos?no_empleado=${encodeURIComponent(noEmpleado)}`, {
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { files?: Ds3ArchivoListado[]; error?: string };
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return Array.isArray(j.files) ? j.files : [];
}

export function Ds3PageClient({ appRole }: { appRole: AppRole }) {
  const puedeEditar = roleMayEditDs3(appRole);

  const [rows, setRows] = useState<ColaboradorCompleto[]>([]);
  const [listaError, setListaError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<ColaboradorCompleto | null>(null);

  const [files, setFiles] = useState<Ds3ArchivoListado[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const [preview, setPreview] = useState<Ds3ArchivoListado | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      setListaError(null);
      try {
        const list = await listColaboradoresCompletos();
        if (!cancel) setRows(list);
      } catch (e) {
        if (!cancel) setRows([]);
        if (!cancel) setListaError(e instanceof Error ? e.message : "ERROR AL CARGAR COLABORADORES.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const candidatos = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return [];
    return rows.filter((c) => coincideNoONombre(c, q)).slice(0, 50);
  }, [rows, busqueda]);

  const recargarArchivos = useCallback(async (no: string) => {
    setFilesLoading(true);
    setFilesError(null);
    try {
      setFiles(await fetchDs3Files(no));
    } catch (e) {
      setFiles([]);
      setFilesError(e instanceof Error ? e.message : "NO SE PUDO CARGAR ARCHIVOS.");
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    const no = seleccionado?.noEmpleado?.trim().toUpperCase();
    if (!no) {
      setFiles([]);
      setFilesError(null);
      setPreview(null);
      return;
    }
    void recargarArchivos(no);
    setPreview(null);
  }, [seleccionado, recargarArchivos]);

  async function subirUnArchivo(file: File, no: string) {
    const preparado = await prepararArchivoDs3(file);
    const sig = await fetch("/api/ds3/archivos/signed-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no_empleado: no,
        file_size_bytes: preparado.size,
        content_type: preparado.type,
        original_name: preparado.name,
      }),
    });
    const sigJson = (await sig.json().catch(() => ({}))) as {
      error?: string;
      path?: string;
      token?: string;
      bucket?: string;
      contentType?: string;
    };
    if (!sig.ok) throw new Error(sigJson.error ?? `Error ${sig.status}`);

    const bucket = sigJson.bucket ?? DS3_BUCKET;
    const path = sigJson.path;
    const token = sigJson.token;
    if (!path?.trim() || !token?.trim()) {
      throw new Error("RESPUESTA INVALIDA DEL SERVIDOR.");
    }

    const supabase = createSupabaseBrowserClient();
    const { error: upErr } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, preparado, {
      contentType: sigJson.contentType ?? preparado.type,
      upsert: false,
      cacheControl: "3600",
    });
    if (upErr) throw new Error(upErr.message || "ERROR AL SUBIR A STORAGE.");
  }

  async function subirVarios(lista: FileList | File[]) {
    if (!seleccionado) return;
    const no = seleccionado.noEmpleado.trim().toUpperCase();
    const arr = [...lista];
    if (arr.length === 0) return;
    if (arr.length > DS3_MAX_ARCHIVOS_POR_LOTE) {
      setUploadMsg(`MAXIMO ${DS3_MAX_ARCHIVOS_POR_LOTE} ARCHIVOS POR LOTE.`);
      return;
    }

    setUploadMsg(null);
    setUploadBusy(true);
    let ok = 0;
    const errores: string[] = [];

    for (let i = 0; i < arr.length; i++) {
      const f = arr[i]!;
      setUploadProgress(`Procesando ${i + 1} de ${arr.length}: ${f.name}`);
      try {
        await subirUnArchivo(f, no);
        ok++;
      } catch (e) {
        errores.push(`${f.name}: ${e instanceof Error ? e.message : "ERROR"}`);
      }
    }

    setUploadProgress("");
    if (ok > 0) {
      setUploadMsg(
        `${ok} ARCHIVO(S) SUBIDO(S) (OPTIMIZADOS A MAX. ${DS3_MAX_MB} MB).` +
          (errores.length ? ` AVISOS: ${errores.slice(0, 3).join(" · ")}` : ""),
      );
      await recargarArchivos(no);
    } else {
      setUploadMsg(errores[0]?.toUpperCase() ?? "NO SE SUBIO NINGUN ARCHIVO.");
    }
    setUploadBusy(false);
  }

  async function eliminarArchivo(name: string) {
    if (!seleccionado) return;
    const no = seleccionado.noEmpleado.trim().toUpperCase();
    if (!window.confirm(`¿Eliminar "${name}"?`)) return;
    setFilesError(null);
    try {
      const r = await fetch(
        `/api/ds3/archivos?no_empleado=${encodeURIComponent(no)}&name=${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setPreview((p) => (p?.name === name ? null : p));
      await recargarArchivos(no);
    } catch (e) {
      setFilesError(e instanceof Error ? e.message : "NO SE PUDO ELIMINAR.");
    }
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Módulo</p>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">DC-3</h1>
        <p className="mt-1 max-w-3xl text-base font-medium leading-relaxed text-slate-800">
          Consulta y sube archivos por colaborador (PDF e imágenes). Puede seleccionar varios a la vez; cada uno se
          optimiza para no superar <strong>{DS3_MAX_MB} MB</strong>. Luego puede verlos en la página o descargarlos.
        </p>
      </div>

      {listaError ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase text-amber-950">
          {listaError}
        </p>
      ) : null}

      <section className="card mb-6 space-y-4">
        <h2 className="text-sm font-bold uppercase text-slate-800">Buscar colaborador</h2>
        <label className="block text-xs font-bold uppercase text-slate-700">
          Búsqueda
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="N° de empleado o nombre"
            className="mt-1 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none ring-sky-500/30 focus:ring-2"
            autoComplete="off"
          />
        </label>
        {busqueda.trim() && candidatos.length === 0 ? (
          <p className="text-sm font-semibold uppercase text-slate-600">Sin coincidencias.</p>
        ) : null}
        {candidatos.length > 0 ? (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {candidatos.map((c) => (
                <li key={c.noEmpleado}>
                  <button
                    type="button"
                    onClick={() => setSeleccionado(c)}
                    className={`flex w-full flex-col items-start px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                      seleccionado?.noEmpleado === c.noEmpleado ? "bg-sky-50" : ""
                    }`}
                  >
                    <span className="font-bold uppercase text-slate-900">{c.noEmpleado}</span>
                    <span className="text-xs font-semibold uppercase text-slate-700">{c.nombreCompleto}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {seleccionado ? (
        <section className="card mb-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase text-slate-800">Colaborador</h2>
              <p className="text-lg font-bold uppercase text-slate-950">{seleccionado.noEmpleado}</p>
              <p className="text-sm font-semibold uppercase text-slate-700">{seleccionado.nombreCompleto}</p>
            </div>
            <button type="button" className="btn-secondary text-xs uppercase" onClick={() => setSeleccionado(null)}>
              Quitar selección
            </button>
          </div>

          {puedeEditar ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <h3 className="text-xs font-bold uppercase text-slate-800">Subir archivos</h3>
              <p className="mt-1 text-xs text-slate-600">
                PDF, JPG, PNG o WEBP — hasta {DS3_MAX_ARCHIVOS_POR_LOTE} por lote. Se comprimen automáticamente (máx.{" "}
                {DS3_MAX_MB} MB c/u).
              </p>
              <input
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                disabled={uploadBusy}
                className="mt-2 block w-full max-w-lg text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase"
                onChange={(e) => {
                  const list = e.target.files;
                  e.target.value = "";
                  if (list?.length) void subirVarios(list);
                }}
              />
              {uploadProgress ? <p className="mt-2 text-xs font-semibold text-slate-600">{uploadProgress}</p> : null}
              {uploadBusy ? <p className="mt-2 text-xs font-semibold uppercase text-slate-600">Optimizando y subiendo…</p> : null}
              {uploadMsg ? (
                <p
                  className={`mt-2 text-xs font-semibold uppercase ${
                    uploadMsg.includes("ERROR") || uploadMsg.includes("NO ") || uploadMsg.includes("MAXIMO")
                      ? "text-red-800"
                      : "text-emerald-900"
                  }`}
                >
                  {uploadMsg}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-700">
              Solo consulta: puede ver y descargar archivos.
            </p>
          )}

          <div>
            <h3 className="text-xs font-bold uppercase text-slate-800">Archivos ({files.length})</h3>
            {filesLoading ? <p className="mt-2 text-sm text-slate-600">Cargando…</p> : null}
            {filesError ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold uppercase text-red-900">
                {filesError}
              </p>
            ) : null}
            {!filesLoading && files.length === 0 ? (
              <p className="mt-2 text-sm font-semibold uppercase text-slate-600">Sin archivos para este colaborador.</p>
            ) : null}
            {!filesLoading && files.length > 0 ? (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {files.map((f) => (
                  <li key={f.path} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold uppercase text-slate-900" title={f.originalLabel}>
                        {f.originalLabel}
                      </p>
                      <p className="text-[11px] font-semibold uppercase text-slate-500">
                        {formatoTamano(f.sizeBytes)} · {formatoFecha(f.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={f.url}
                        download={f.originalLabel}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary px-3 py-1.5 text-xs uppercase"
                      >
                        Descargar
                      </a>
                      {puedePrevisualizarEnPagina(f.mimeType) ? (
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-xs uppercase"
                          onClick={() => setPreview((p) => (p?.path === f.path ? null : f))}
                        >
                          {preview?.path === f.path ? "Ocultar" : "Ver"}
                        </button>
                      ) : (
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn-primary px-3 py-1.5 text-xs uppercase">
                          Abrir
                        </a>
                      )}
                      {puedeEditar ? (
                        <button
                          type="button"
                          className="rounded border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase text-rose-900 hover:bg-rose-50"
                          onClick={() => void eliminarArchivo(f.name)}
                        >
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {preview ? (
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-inner">
              <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase text-slate-700">
                Vista previa — {preview.originalLabel}
              </p>
              {esPdfMime(preview.mimeType) ? (
                <iframe title="Vista previa PDF" src={preview.url} className="h-[min(72vh,720px)] w-full bg-white" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.originalLabel} className="mx-auto max-h-[min(72vh,720px)] w-auto object-contain p-4" />
              )}
            </div>
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-semibold uppercase text-slate-600">
          Selecciona un colaborador para consultar o subir archivos DC-3.
        </p>
      )}
    </div>
  );
}
