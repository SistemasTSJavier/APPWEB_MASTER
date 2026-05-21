"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/app-role";
import {
  roleMayPickSgcDepartamento,
  sgcDepartamentoFijoPorRol,
} from "@/lib/app-role";
import {
  SGC_BUCKET,
  SGC_DEPARTAMENTOS,
  SGC_MAX_BYTES,
  type SgcCategoriaId,
  type SgcDepartamentoId,
  sgcCategoriaLabel,
  sgcDepartamentoLabel,
} from "@/lib/sgc-calidad";
import { formatoFechaDiaMesAnio } from "@/lib/fecha-formato-display";

const SGC_MAX_MB = Math.round(SGC_MAX_BYTES / (1024 * 1024));

type SgcFile = {
  name: string;
  storageName: string;
  path: string;
  url: string;
  updatedAt: string | null;
};

type ListResponse = {
  files?: SgcFile[];
  error?: string;
  canUpload?: boolean;
  canDelete?: boolean;
  canPickDepartamento?: boolean;
};

async function fetchSgcFiles(categoria: SgcCategoriaId, departamento: SgcDepartamentoId): Promise<ListResponse> {
  const q = new URLSearchParams({ categoria, departamento });
  const r = await fetch(`/api/sgc/archivos?${q}`, { cache: "no-store" });
  return (await r.json().catch(() => ({}))) as ListResponse & { files?: SgcFile[] };
}

function formatoFecha(iso: string | null): string {
  if (!iso?.trim()) return "—";
  return formatoFechaDiaMesAnio(iso);
}

export function SgcCategoriaPageClient({
  categoria,
  appRole,
}: {
  categoria: SgcCategoriaId;
  appRole: AppRole;
}) {
  const departamentoFijo = sgcDepartamentoFijoPorRol(appRole);
  const puedeElegirDepto = roleMayPickSgcDepartamento(appRole);

  const [departamento, setDepartamento] = useState<SgcDepartamentoId>(
    departamentoFijo ?? "operaciones",
  );
  const [files, setFiles] = useState<SgcFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const titulo = sgcCategoriaLabel(categoria);
  const deptoLabel = useMemo(() => sgcDepartamentoLabel(departamento), [departamento]);

  const recargar = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const j = await fetchSgcFiles(categoria, departamento);
      if (j.error) throw new Error(j.error);
      setFiles(Array.isArray(j.files) ? j.files : []);
      setCanUpload(!!j.canUpload);
      setCanDelete(!!j.canDelete);
    } catch (e) {
      setFiles([]);
      setListError(e instanceof Error ? e.message : "No se pudo cargar la lista.");
    } finally {
      setLoading(false);
    }
  }, [categoria, departamento]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  async function subirArchivo(file: File) {
    setUploadMsg(null);
    setUploadBusy(true);
    try {
      if (file.size > SGC_MAX_BYTES) {
        throw new Error(`El archivo supera ${SGC_MAX_MB} MB.`);
      }

      const sig = await fetch("/api/sgc/archivos/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria,
          departamento,
          file_name: file.name,
          file_size_bytes: file.size,
        }),
      });
      const sigJson = (await sig.json().catch(() => ({}))) as {
        error?: string;
        path?: string;
        token?: string;
        bucket?: string;
      };
      if (!sig.ok) throw new Error(sigJson.error ?? `Error ${sig.status}`);

      const bucket = sigJson.bucket ?? SGC_BUCKET;
      const path = sigJson.path;
      const token = sigJson.token;
      if (!path?.trim() || !token?.trim()) {
        throw new Error("Respuesta invalida del servidor (falta path o token).");
      }

      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, {
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);

      setUploadMsg(`Archivo subido: ${file.name}`);
      await recargar();
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "Error al subir.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function eliminarArchivo(storageName: string, displayName: string) {
    if (!confirm(`¿Eliminar «${displayName}»?`)) return;
    setUploadMsg(null);
    try {
      const q = new URLSearchParams({
        categoria,
        departamento,
        storage_name: storageName,
      });
      const r = await fetch(`/api/sgc/archivos?${q}`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setUploadMsg(`Eliminado: ${displayName}`);
      await recargar();
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <Link
          href="/sgc"
          className="text-xs font-bold uppercase tracking-wide text-sky-800 hover:text-sky-950"
        >
          ← Sistemas de gestión de calidad
        </Link>
        <h1 className="mt-3 text-xl font-extrabold uppercase tracking-wide text-slate-900 sm:text-2xl">{titulo}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Archivos del departamento seleccionado. Solo usuarios autorizados de cada área gestionan su carpeta.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">Departamento</label>
        {puedeElegirDepto ? (
          <select
            className="mt-2 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value as SgcDepartamentoId)}
          >
            {SGC_DEPARTAMENTOS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-2 text-sm font-bold text-slate-900">{deptoLabel}</p>
        )}
      </div>

      {canUpload ? (
        <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50/50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-900">Subir archivo</p>
          <p className="mt-1 text-xs text-slate-600">
            Máximo {SGC_MAX_MB} MB · se guarda en {titulo} / {deptoLabel}
          </p>
          <input
            type="file"
            className="mt-3 block w-full max-w-lg text-sm"
            disabled={uploadBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void subirArchivo(f);
            }}
          />
          {uploadBusy ? <p className="mt-2 text-xs font-semibold text-slate-600">Subiendo…</p> : null}
          {uploadMsg ? (
            <p
              className={`mt-2 text-xs font-bold uppercase ${uploadMsg.startsWith("Archivo") || uploadMsg.startsWith("Eliminado") ? "text-emerald-800" : "text-amber-900"}`}
            >
              {uploadMsg}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
            Archivos · {deptoLabel}
            {loading ? " (cargando…)" : ` (${files.length})`}
          </p>
        </div>

        {listError ? (
          <p className="px-5 py-8 text-center text-sm font-semibold text-amber-900">{listError}</p>
        ) : files.length === 0 && !loading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No hay archivos en esta carpeta.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {files.map((f) => (
              <li
                key={f.path}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{f.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Actualizado: {formatoFecha(f.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-slate-800"
                  >
                    Abrir
                  </a>
                  {canDelete ? (
                    <button
                      type="button"
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold uppercase text-red-900 hover:bg-red-100"
                      onClick={() => void eliminarArchivo(f.storageName, f.name)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
