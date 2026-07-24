"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/app-role";
import {
  roleMayPickSgcDepartamento,
  roleMayUploadSgc,
  roleMayDeleteSgc,
  sgcDepartamentoDesdeUsuario,
  userMayModulo,
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
  sgcCategoriaMeta,
} from "@/components/sgc/sgc-ui";

export function SgcCategoriaPageClient({
  categoria,
  appRole,
  userMetadata,
}: {
  categoria: SgcCategoriaId;
  appRole: AppRole;
  userMetadata?: Record<string, unknown> | null;
}) {
  const meta = sgcCategoriaMeta(categoria);
  const departamentoFijo = sgcDepartamentoDesdeUsuario(appRole, userMetadata);
  const puedeElegirDepto = roleMayPickSgcDepartamento(appRole);
  const puedeGestionarRol = roleMayUploadSgc(appRole);
  const puedeSubir =
    puedeGestionarRol && userMayModulo(appRole, userMetadata ?? null, "/sgc", "editar");
  const puedeBorrar =
    roleMayDeleteSgc(appRole) && userMayModulo(appRole, userMetadata ?? null, "/sgc", "eliminar");
  const puedeGestionar = puedeSubir || puedeBorrar;

  const [departamento, setDepartamento] = useState<SgcDepartamentoId>(departamentoFijo ?? "operaciones");
  const [busqueda, setBusqueda] = useState("");
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [replaceBusyName, setReplaceBusyName] = useState<string | null>(null);
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
  } = useSgcFiles(categoria, departamento);

  const deptoLabel = useMemo(() => sgcDepartamentoLabel(departamento), [departamento]);
  const puedeReemplazar = puedeSubir && canUpload;

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

  async function reemplazarArchivo(storageName: string, displayName: string, file: File) {
    if (file.size > SGC_MAX_BYTES) {
      setUploadMsg(`El archivo supera ${Math.round(SGC_MAX_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    if (
      !confirm(
        `¿Reemplazar «${displayName}» por «${file.name}»?\nSe eliminará la versión anterior (sin historial).`,
      )
    ) {
      return;
    }

    setReplaceBusyName(storageName);
    setUploadMsg(null);
    try {
      const sig = await fetch("/api/sgc/archivos/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria,
          departamento,
          file_name: file.name,
          file_size_bytes: file.size,
          replace: true,
          replace_storage_name: storageName,
        }),
      });
      const sigJson = (await sig.json().catch(() => ({}))) as {
        error?: string;
        path?: string;
        token?: string;
        bucket?: string;
      };
      if (!sig.ok) throw new Error(sigJson.error ?? `Error ${sig.status}`);
      if (!sigJson.path?.trim() || !sigJson.token?.trim()) {
        throw new Error("Respuesta inválida del servidor.");
      }

      const { error: upErr } = await supabaseRef.current.storage
        .from(sigJson.bucket ?? SGC_BUCKET)
        .uploadToSignedUrl(sigJson.path, sigJson.token, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);

      setUploadMsg(`Reemplazado: ${file.name}`);
      void recargar({ silent: true });
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "No se pudo reemplazar.");
      void recargar({ silent: true });
    } finally {
      setReplaceBusyName(null);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <SgcHero
        eyebrow="SGC"
        title={meta.label}
        description={
          puedeGestionar
            ? `${meta.description} Puede reemplazar o eliminar archivos. Para subir nuevos use el asistente en Inicio SGC.`
            : `${meta.description} Solo consulta de su departamento.`
        }
        backHref="/sgc"
        backLabel="Sistemas de gestión de calidad"
      />

      <SgcLayoutPanel sidebar={<SgcSideNav activeCategoria={categoria} />}>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Departamento</p>
          <p className="mt-1 text-xs text-slate-500">
            {puedeElegirDepto
              ? "Elija el área cuyos archivos desea administrar."
              : "Solo se listan los archivos de su área."}
          </p>
          <div className="mt-3">
            <SgcDeptPicker
              departamento={departamento}
              onChange={setDepartamento}
              locked={!puedeElegirDepto}
              lockedLabel={deptoLabel}
            />
          </div>
        </section>

        {uploadMsg ? (
          <p
            className={`rounded-lg px-3 py-2 text-xs font-bold uppercase ${
              uploadMsg.startsWith("Eliminado") || uploadMsg.startsWith("Reemplazado")
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {uploadMsg}
          </p>
        ) : null}

        {!puedeGestionar ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Modo consulta: puede abrir y descargar formatos. Subir, reemplazar o eliminar requiere Administrador o
            Mejora continua.
          </p>
        ) : (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            Para cargar un archivo nuevo:{" "}
            <Link href="/sgc" className="font-bold uppercase underline-offset-2 hover:underline">
              Inicio SGC → asistente
            </Link>
            . Aquí puede reemplazar o eliminar.
          </p>
        )}

        <SgcFileList
          files={files}
          loading={loading}
          refreshing={refreshing}
          error={listError}
          canDelete={canDelete && puedeBorrar}
          canReplace={puedeReemplazar}
          search={busqueda}
          onSearchChange={setBusqueda}
          deptoLabel={deptoLabel}
          onDelete={(sn, dn) => void eliminarArchivo(sn, dn)}
          onReplace={(sn, dn, f) => void reemplazarArchivo(sn, dn, f)}
          replaceBusyName={replaceBusyName}
        />
      </SgcLayoutPanel>
    </div>
  );
}
