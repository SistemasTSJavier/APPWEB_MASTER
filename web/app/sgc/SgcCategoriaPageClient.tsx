"use client";

import { useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/app-role";
import {
  roleMayPickSgcDepartamento,
  sgcDepartamentoFijoPorRol,
} from "@/lib/app-role";
import {
  SGC_BUCKET,
  SGC_MAX_BYTES,
  type SgcCategoriaId,
  type SgcDepartamentoId,
  sgcDepartamentoLabel,
} from "@/lib/sgc-calidad";
import { useSgcFiles } from "@/components/sgc/use-sgc-files";
import {
  SgcDeptPicker,
  SgcFileList,
  SgcHero,
  SgcLayoutPanel,
  SgcSideNav,
  SgcUploadZone,
  sgcCategoriaMeta,
} from "@/components/sgc/sgc-ui";

export function SgcCategoriaPageClient({
  categoria,
  appRole,
}: {
  categoria: SgcCategoriaId;
  appRole: AppRole;
}) {
  const meta = sgcCategoriaMeta(categoria);
  const departamentoFijo = sgcDepartamentoFijoPorRol(appRole);
  const puedeElegirDepto = roleMayPickSgcDepartamento(appRole);

  const [departamento, setDepartamento] = useState<SgcDepartamentoId>(departamentoFijo ?? "operaciones");
  const [busqueda, setBusqueda] = useState("");
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const supabaseRef = useRef(createSupabaseBrowserClient());

  const {
    files,
    loading,
    refreshing,
    listError,
    canUpload,
    canDelete,
    recargar,
    quitarArchivo,
    agregarArchivo,
  } = useSgcFiles(categoria, departamento);

  const deptoLabel = useMemo(() => sgcDepartamentoLabel(departamento), [departamento]);

  async function subirArchivo(file: File) {
    setUploadMsg(null);
    setUploadBusy(true);
    try {
      if (file.size > SGC_MAX_BYTES) {
        throw new Error(`El archivo supera ${Math.round(SGC_MAX_BYTES / (1024 * 1024))} MB.`);
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
        publicUrl?: string;
      };
      if (!sig.ok) throw new Error(sigJson.error ?? `Error ${sig.status}`);

      const bucket = sigJson.bucket ?? SGC_BUCKET;
      const path = sigJson.path;
      const token = sigJson.token;
      if (!path?.trim() || !token?.trim()) {
        throw new Error("Respuesta inválida del servidor.");
      }

      const { error: upErr } = await supabaseRef.current.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);

      const storageName = path.split("/").pop() ?? path;
      agregarArchivo({
        name: file.name,
        storageName,
        path,
        url: sigJson.publicUrl ?? "",
        updatedAt: new Date().toISOString(),
        sizeBytes: file.size,
      });
      setUploadMsg(`Archivo subido: ${file.name}`);
      void recargar({ silent: true });
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "Error al subir.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function eliminarArchivo(storageName: string, displayName: string) {
    if (!confirm(`¿Eliminar «${displayName}»?`)) return;
    quitarArchivo(storageName);
    setUploadMsg(null);
    try {
      const q = new URLSearchParams({ categoria, departamento, storage_name: storageName });
      const r = await fetch(`/api/sgc/archivos?${q}`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setUploadMsg(`Eliminado: ${displayName}`);
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "No se pudo eliminar.");
      void recargar({ silent: true });
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <SgcHero
        eyebrow="SGC"
        title={meta.label}
        description={meta.description}
        backHref="/sgc"
        backLabel="Sistemas de gestión de calidad"
      />

      <SgcLayoutPanel sidebar={<SgcSideNav activeCategoria={categoria} />}>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Departamento</p>
          <p className="mt-1 text-xs text-slate-500">Solo se listan los archivos de esta área.</p>
          <div className="mt-3">
            <SgcDeptPicker
              departamento={departamento}
              onChange={setDepartamento}
              locked={!puedeElegirDepto}
              lockedLabel={deptoLabel}
            />
          </div>
        </section>

        {canUpload ? (
          <SgcUploadZone
            disabled={false}
            busy={uploadBusy}
            categoriaLabel={meta.label}
            deptoLabel={deptoLabel}
            onFile={(f) => void subirArchivo(f)}
            message={uploadMsg}
          />
        ) : null}

        <SgcFileList
          files={files}
          loading={loading}
          refreshing={refreshing}
          error={listError}
          canDelete={canDelete}
          search={busqueda}
          onSearchChange={setBusqueda}
          deptoLabel={deptoLabel}
          onDelete={(sn, dn) => void eliminarArchivo(sn, dn)}
        />
      </SgcLayoutPanel>
    </div>
  );
}
