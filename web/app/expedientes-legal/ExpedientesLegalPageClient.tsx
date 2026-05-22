"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listColaboradoresCompletos, type ColaboradorCompleto } from "@/lib/colaboradores-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  EXPEDIENTE_LEGAL_BUCKET,
  EXPEDIENTE_LEGAL_MAX_BYTES,
} from "@/lib/expediente-legal-constants";
import { type AppRole, roleMayEditColaboradoresLegacyRh } from "@/lib/app-role";
import { formatoFechaDiaMesAnio } from "@/lib/fecha-formato-display";

const EXPEDIENTE_LEGAL_MAX_MB = Math.round(EXPEDIENTE_LEGAL_MAX_BYTES / (1024 * 1024));

type LegalFile = { name: string; path: string; url: string; updatedAt: string | null };

function coincideNoONombre(c: ColaboradorCompleto, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return false;
  return c.noEmpleado.toLowerCase().includes(n) || c.nombreCompleto.toLowerCase().includes(n);
}

function formatoFecha(iso: string | null): string {
  if (!iso?.trim()) return "—";
  return formatoFechaDiaMesAnio(iso);
}

async function assertCabeceraPdf(file: File): Promise<void> {
  const b = await file.slice(0, 5).arrayBuffer();
  const s = new TextDecoder("ascii").decode(b);
  if (s !== "%PDF-") {
    throw new Error("EL ARCHIVO NO PARECE UN PDF VÁLIDO (FALTA CABECERA %PDF-).");
  }
}

async function fetchLegalFiles(noEmpleado: string): Promise<LegalFile[]> {
  const r = await fetch(`/api/colaboradores/expediente-legal?no_empleado=${encodeURIComponent(noEmpleado)}`, {
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { files?: LegalFile[]; error?: string };
  if (!r.ok) {
    throw new Error(j.error ?? `Error ${r.status}`);
  }
  return Array.isArray(j.files) ? j.files : [];
}

export function ExpedientesLegalPageClient({ appRole }: { appRole: AppRole }) {
  const puedeEditar = roleMayEditColaboradoresLegacyRh(appRole);

  const [rows, setRows] = useState<ColaboradorCompleto[]>([]);
  const [listaError, setListaError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<ColaboradorCompleto | null>(null);

  const [files, setFiles] = useState<LegalFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
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
      const list = await fetchLegalFiles(no);
      setFiles(list);
    } catch (e) {
      setFiles([]);
      setFilesError(e instanceof Error ? e.message : "NO SE PUDO CARGAR LA LISTA DE PDF.");
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    const no = seleccionado?.noEmpleado?.trim().toUpperCase();
    if (!no) {
      setFiles([]);
      setFilesError(null);
      setPreviewUrl(null);
      return;
    }
    void recargarArchivos(no);
    setPreviewUrl(null);
  }, [seleccionado, recargarArchivos]);

  async function subirPdf(file: File) {
    if (!seleccionado) return;
    const no = seleccionado.noEmpleado.trim().toUpperCase();
    setUploadMsg(null);
    setUploadBusy(true);
    try {
      if (file.size > EXPEDIENTE_LEGAL_MAX_BYTES) {
        throw new Error(`EL PDF SUPERA ${EXPEDIENTE_LEGAL_MAX_MB} MB (LIMITE DEL SISTEMA).`);
      }
      const mime = (file.type || "").toLowerCase();
      if (mime && mime !== "application/pdf") {
        throw new Error("SOLO SE PERMITEN ARCHIVOS PDF.");
      }
      await assertCabeceraPdf(file);

      const sig = await fetch("/api/colaboradores/expediente-legal/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ no_empleado: no, file_size_bytes: file.size }),
      });
      const sigJson = (await sig.json().catch(() => ({}))) as {
        error?: string;
        path?: string;
        token?: string;
        bucket?: string;
      };
      if (!sig.ok) {
        throw new Error(sigJson.error ?? `Error ${sig.status}`);
      }
      const bucket = sigJson.bucket ?? EXPEDIENTE_LEGAL_BUCKET;
      const path = sigJson.path;
      const token = sigJson.token;
      if (!path?.trim() || !token?.trim()) {
        throw new Error("RESPUESTA INVALIDA DEL SERVIDOR (FALTA PATH O TOKEN DE SUBIDA).");
      }

      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, {
        contentType: "application/pdf",
        upsert: false,
        cacheControl: "3600",
      });
      if (upErr) {
        throw new Error(upErr.message || "ERROR AL SUBIR A STORAGE.");
      }

      setUploadMsg("PDF SUBIDO CORRECTAMENTE.");
      await recargarArchivos(no);
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL SUBIR.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function eliminarPdf(name: string) {
    if (!seleccionado) return;
    const no = seleccionado.noEmpleado.trim().toUpperCase();
    const ok = window.confirm(`¿Eliminar el PDF "${name}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    setFilesError(null);
    try {
      const r = await fetch(
        `/api/colaboradores/expediente-legal?no_empleado=${encodeURIComponent(no)}&name=${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        throw new Error(j.error ?? `Error ${r.status}`);
      }
      setPreviewUrl((prev) => {
        const hit = files.find((f) => f.name === name && f.url === prev);
        return hit ? null : prev;
      });
      await recargarArchivos(no);
    } catch (e) {
      setFilesError(e instanceof Error ? e.message : "NO SE PUDO ELIMINAR.");
    }
  }

  return (
    <div className="w-full">
        <div className="mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Módulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">Expedientes legal</h1>
            <p className="mt-1 max-w-2xl text-base font-medium leading-relaxed text-slate-800">
              {puedeEditar ? (
                <>
                  Busca un colaborador por número de empleado o nombre, sube PDFs asociados a su expediente y ábrelos cuando lo necesites. Los archivos se
                  guardan en almacenamiento seguro (Supabase).
                </>
              ) : (
                <>
                  Busca un colaborador por número de empleado o nombre y consulta los PDFs del expediente legal. Solo lectura: no puedes subir ni eliminar
                  archivos.
                </>
              )}
            </p>
          </div>
        </div>

        {listaError ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase text-amber-950">
            {listaError}
          </p>
        ) : null}

        <section className="card mb-6 space-y-4">
          <h2 className="text-sm font-bold uppercase text-slate-800">Buscar colaborador</h2>
          <p className="text-xs text-slate-600">
            Escribe parte del <strong>N° de empleado</strong> o del <strong>nombre completo</strong>. Elige un resultado para ver y gestionar PDFs.
          </p>
          <label className="block text-xs font-bold uppercase text-slate-700">
            Búsqueda
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej. 12345 o GARCÍA"
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
                {candidatos.map((c) => {
                  const activo = seleccionado?.noEmpleado === c.noEmpleado;
                  return (
                    <li key={c.noEmpleado}>
                      <button
                        type="button"
                        onClick={() => setSeleccionado(c)}
                        className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                          activo ? "bg-sky-50" : ""
                        }`}
                      >
                        <span className="font-bold uppercase text-slate-900">{c.noEmpleado}</span>
                        <span className="text-xs font-semibold uppercase leading-snug text-slate-700">{c.nombreCompleto}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>

        {seleccionado ? (
          <section className="card mb-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase text-slate-800">Colaborador seleccionado</h2>
                <p className="mt-1 text-lg font-bold uppercase text-slate-950">{seleccionado.noEmpleado}</p>
                <p className="text-sm font-semibold uppercase text-slate-700">{seleccionado.nombreCompleto}</p>
              </div>
              <button type="button" className="btn-secondary text-xs uppercase" onClick={() => setSeleccionado(null)}>
                Quitar selección
              </button>
            </div>

            {puedeEditar ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <h3 className="text-xs font-bold uppercase text-slate-800">Subir PDF</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Hasta {EXPEDIENTE_LEGAL_MAX_MB} MB por archivo (subida directa a Supabase). Solo PDF; se valida la cabecera del archivo.
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={uploadBusy}
                  className="mt-2 block w-full max-w-md text-sm font-medium text-slate-800 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void subirPdf(f);
                  }}
                />
                {uploadBusy ? <p className="mt-2 text-xs font-semibold uppercase text-slate-600">Subiendo…</p> : null}
                {uploadMsg ? (
                  <p
                    className={`mt-2 text-xs font-semibold uppercase ${
                      uploadMsg.includes("ERROR") || uploadMsg.includes("NO ") ? "text-red-800" : "text-emerald-900"
                    }`}
                  >
                    {uploadMsg}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-700">
                Tu rol solo permite consultar y abrir PDFs; no subir ni eliminar.
              </p>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase text-slate-800">Archivos PDF</h3>
              {filesLoading ? <p className="mt-2 text-sm text-slate-600">Cargando lista…</p> : null}
              {filesError ? (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold uppercase text-red-900">
                  {filesError}
                </p>
              ) : null}
              {!filesLoading && !filesError && files.length === 0 ? (
                <p className="mt-2 text-sm font-semibold uppercase text-slate-600">Aún no hay PDFs para este colaborador.</p>
              ) : null}
              {!filesLoading && files.length > 0 ? (
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {files.map((f) => (
                    <li key={f.path} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold uppercase text-slate-900" title={f.name}>
                          {f.name}
                        </p>
                        <p className="text-[11px] font-semibold uppercase text-slate-500">Actualizado: {formatoFecha(f.updatedAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary px-3 py-1.5 text-xs uppercase"
                        >
                          Abrir PDF
                        </a>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs uppercase"
                          onClick={() => setPreviewUrl((u) => (u === f.url ? null : f.url))}
                        >
                          {previewUrl === f.url ? "Ocultar vista" : "Ver en página"}
                        </button>
                        {puedeEditar ? (
                          <button
                            type="button"
                            className="rounded border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase text-rose-900 hover:bg-rose-50"
                            onClick={() => void eliminarPdf(f.name)}
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

            {previewUrl ? (
              <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-900/5 shadow-inner">
                <p className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700">Vista previa</p>
                <iframe title="Vista previa PDF" src={previewUrl} className="h-[min(72vh,720px)] w-full bg-white" />
              </div>
            ) : null}
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-semibold uppercase text-slate-600">
            Selecciona un colaborador para ver o subir expedientes legales en PDF.
          </p>
        )}
    </div>
  );
}
