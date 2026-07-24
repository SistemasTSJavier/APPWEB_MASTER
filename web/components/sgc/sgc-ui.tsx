"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  SGC_BUCKET,
  SGC_CATEGORIAS,
  SGC_DEPARTAMENTOS,
  SGC_MAX_BYTES,
  type SgcCategoriaId,
  type SgcCategoriaMeta,
  type SgcDepartamentoId,
  sgcCategoriaMeta,
  sgcFileKindFromName,
  sgcFormatBytes,
} from "@/lib/sgc-calidad";
import { formatoFechaDiaMesAnio } from "@/lib/fecha-formato-display";
import type { SgcFile } from "./use-sgc-files";

const SGC_MAX_MB = Math.round(SGC_MAX_BYTES / (1024 * 1024));

function useDepartamentosSgc(): { id: SgcDepartamentoId; label: string }[] {
  const [deps, setDeps] = useState(() =>
    SGC_DEPARTAMENTOS.map((d) => ({ id: d.id as SgcDepartamentoId, label: d.label })),
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/catalogos/departamentos", { cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as {
          departamentos?: { id: string; label: string }[];
        };
        if (!cancelled && r.ok && j.departamentos?.length) {
          setDeps(j.departamentos.map((d) => ({ id: d.id as SgcDepartamentoId, label: d.label })));
        }
      } catch {
        /* keep builtins */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return deps;
}

const FILE_KIND_ICON: Record<ReturnType<typeof sgcFileKindFromName>, string> = {
  pdf: "📕",
  office: "📊",
  image: "🖼️",
  archive: "🗜️",
  other: "📎",
};

export function SgcHero({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-5 py-7 shadow-xl sm:px-8 sm:py-9">
      <div
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-[0.07]"
        style={{ backgroundImage: "url('/logo.webp')", backgroundSize: "min(70%, 240px)" }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-sky-500/20 blur-3xl" aria-hidden />
      {backHref ? (
        <Link
          href={backHref}
          className="relative inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-sky-300 transition hover:text-white"
        >
          <span aria-hidden>←</span> {backLabel ?? "Volver"}
        </Link>
      ) : (
        <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300 sm:text-xs">{eyebrow}</p>
      )}
      <h1 className="relative mt-3 text-xl font-extrabold uppercase tracking-wide text-white sm:text-2xl md:text-3xl">
        {title}
      </h1>
      <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{description}</p>
    </header>
  );
}

export function SgcCategoryGrid({ activeId }: { activeId?: SgcCategoriaId }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return SGC_CATEGORIAS;
    return SGC_CATEGORIAS.filter(
      (c) => c.label.toLowerCase().includes(n) || c.description.toLowerCase().includes(n),
    );
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <label className="sr-only" htmlFor="sgc-buscar-categoria">
          Buscar tipo de documento
        </label>
        <input
          id="sgc-buscar-categoria"
          type="search"
          placeholder="Buscar carpeta (documentos, formatos, manual…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Ninguna carpeta coincide con la búsqueda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((cat) => (
            <SgcCategoryCard key={cat.id} cat={cat} active={activeId === cat.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function SgcCategoryCard({ cat, active }: { cat: SgcCategoriaMeta; active?: boolean }) {
  return (
    <Link
      href={`/sgc/${cat.id}`}
      className={`group relative flex flex-col rounded-xl border p-5 shadow-md shadow-slate-900/[0.04] ring-1 transition hover:-translate-y-0.5 hover:shadow-lg ${cat.accent} ${
        active ? "ring-2 ring-sky-400" : ""
      }`}
    >
      <span className="text-2xl" aria-hidden>
        {cat.icon}
      </span>
      <p className="mt-3 text-sm font-extrabold uppercase tracking-wide">{cat.label}</p>
      <p className="mt-2 flex-1 text-xs leading-snug opacity-80">{cat.description}</p>
      <span className="mt-4 text-[11px] font-bold uppercase tracking-wide opacity-70 group-hover:opacity-100">
        Abrir carpeta →
      </span>
    </Link>
  );
}

export function SgcDeptPicker({
  departamento,
  onChange,
  locked,
  lockedLabel,
}: {
  departamento: SgcDepartamentoId;
  onChange: (d: SgcDepartamentoId) => void;
  locked: boolean;
  lockedLabel?: string;
}) {
  const departamentos = useDepartamentosSgc();

  if (locked) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Su departamento</p>
        <p className="mt-1 text-sm font-extrabold text-emerald-950">{lockedLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {departamentos.map((d) => {
        const on = departamento === d.id;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onChange(d.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              on
                ? "bg-slate-900 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
            }`}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

export function SgcUploadZone({
  disabled,
  busy,
  categoriaLabel,
  deptoLabel,
  onFile,
  message,
}: {
  disabled: boolean;
  busy: boolean;
  categoriaLabel: string;
  deptoLabel: string;
  onFile: (f: File) => void;
  message: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (f) onFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (!disabled && !busy) pick(e.dataTransfer.files);
  }

  const okMsg =
    message?.startsWith("Archivo") ||
    message?.startsWith("Eliminado") ||
    message?.startsWith("Reemplazado") ||
    message?.toLowerCase().includes("subido");

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !busy) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed p-5 transition sm:p-6 ${
        drag
          ? "border-sky-400 bg-sky-50"
          : "border-slate-300 bg-gradient-to-b from-slate-50 to-white"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-2xl">⬆️</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold uppercase tracking-wide text-slate-900">Subir archivo</p>
          <p className="mt-1 text-xs text-slate-600">
            Arrastre aquí o use el botón · máx. {SGC_MAX_MB} MB · {categoriaLabel} / {deptoLabel}
          </p>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Subiendo…" : "Seleccionar archivo"}
          </button>
          {message ? (
            <p className={`mt-3 text-xs font-bold uppercase ${okMsg ? "text-emerald-700" : "text-amber-800"}`}>
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Asistente: 1) archivo → 2) departamento → 3) módulo → confirmar (con reemplazo sin historial). */
export function SgcUploadWizard({
  onUploaded,
}: {
  onUploaded?: (info: { categoria: SgcCategoriaId; departamento: SgcDepartamentoId; name: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const supabaseRef = useRef(createSupabaseBrowserClient());
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [departamento, setDepartamento] = useState<SgcDepartamentoId>("operaciones");
  const [categoria, setCategoria] = useState<SgcCategoriaId>("formatos");
  const [reemplazar, setReemplazar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const departamentos = useDepartamentosSgc();

  function resetWizard() {
    setPaso(1);
    setFile(null);
    setDepartamento("operaciones");
    setCategoria("formatos");
    setReemplazar(true);
    setMessage(null);
  }

  function pickFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > SGC_MAX_BYTES) {
      setMessage(`El archivo supera ${SGC_MAX_MB} MB.`);
      return;
    }
    setMessage(null);
    setFile(f);
    setPaso(2);
  }

  async function confirmarSubida() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const sig = await fetch("/api/sgc/archivos/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria,
          departamento,
          file_name: file.name,
          file_size_bytes: file.size,
          replace: reemplazar,
        }),
      });
      const sigJson = (await sig.json().catch(() => ({}))) as {
        error?: string;
        path?: string;
        token?: string;
        bucket?: string;
        replaced?: number;
      };
      if (!sig.ok) throw new Error(sigJson.error ?? `Error ${sig.status}`);
      if (!sigJson.path?.trim() || !sigJson.token?.trim()) {
        throw new Error("Respuesta inválida del servidor.");
      }

      const { error: upErr } = await supabaseRef.current.storage
        .from(sigJson.bucket ?? SGC_BUCKET)
        .uploadToSignedUrl(sigJson.path, sigJson.token, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);

      const replaced = Number(sigJson.replaced ?? 0);
      setMessage(
        replaced > 0
          ? `Reemplazado: ${file.name} (versión anterior eliminada).`
          : `Archivo subido: ${file.name}`,
      );
      onUploaded?.({ categoria, departamento, name: file.name });
      setPaso(4);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error al subir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-blue-950 px-4 py-4 text-white sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Gestión de archivos</p>
        <h2 className="mt-1 text-base font-extrabold uppercase tracking-wide">Subir o actualizar formato</h2>
        <p className="mt-1 text-xs text-slate-300">
          Archivo → departamento con acceso → módulo. Si reemplaza, se elimina la versión anterior (sin historial).
        </p>
        <ol className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
          {[
            { n: 1, t: "Archivo" },
            { n: 2, t: "Departamento" },
            { n: 3, t: "Módulo" },
            { n: 4, t: "Listo" },
          ].map((s) => (
            <li
              key={s.n}
              className={`rounded-full px-2.5 py-1 ${
                paso === s.n ? "bg-sky-400 text-slate-950" : paso > s.n ? "bg-white/20 text-white" : "bg-white/10 text-slate-400"
              }`}
            >
              {s.n}. {s.t}
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {paso === 1 && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pickFile(e.dataTransfer.files);
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
              drag ? "border-sky-400 bg-sky-50" : "border-slate-300 bg-slate-50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              onChange={(e) => {
                pickFile(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="text-sm font-extrabold uppercase text-slate-900">1. Ingrese el archivo</p>
            <p className="mt-1 text-xs text-slate-600">Arrastre o seleccione · máx. {SGC_MAX_MB} MB</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase text-white hover:bg-slate-800"
            >
              Seleccionar archivo
            </button>
          </div>
        )}

        {paso === 2 && file && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-[10px] font-bold uppercase text-slate-500">Archivo</span>
              <p className="font-semibold text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">{sgcFormatBytes(file.size)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-800">
                2. Departamento que tendrá acceso
              </p>
              <div className="mt-3">
                <SgcDeptPicker departamento={departamento} onChange={setDepartamento} locked={false} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-800"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => setPaso(3)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase text-white"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {paso === 3 && file && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p>
                <strong className="uppercase">{file.name}</strong> →{" "}
                {departamentos.find((d) => d.id === departamento)?.label ?? departamento}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-800">3. Módulo / carpeta</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SGC_CATEGORIAS.map((c) => {
                  const on = categoria === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoria(c.id)}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        on
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-800 hover:border-sky-300"
                      }`}
                    >
                      <span className="mr-1" aria-hidden>
                        {c.icon}
                      </span>
                      <span className="text-xs font-bold uppercase">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={reemplazar}
                onChange={(e) => setReemplazar(e.target.checked)}
              />
              <span>
                <strong className="uppercase">Reemplazar si ya existe</strong> el mismo nombre en este módulo y
                departamento. Elimina la versión anterior (sin historial).
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPaso(2)}
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-800 disabled:opacity-50"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => void confirmarSubida()}
                disabled={busy}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {busy ? "Subiendo…" : reemplazar ? "Subir / reemplazar" : "Subir archivo"}
              </button>
            </div>
          </div>
        )}

        {paso === 4 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
            <p className="text-sm font-extrabold uppercase text-emerald-950">Listo</p>
            {message ? <p className="mt-2 text-sm text-emerald-900">{message}</p> : null}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href={`/sgc/${categoria}`}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase text-white"
              >
                Ver carpeta
              </Link>
              <button
                type="button"
                onClick={resetWizard}
                className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-bold uppercase text-emerald-950"
              >
                Subir otro
              </button>
            </div>
          </div>
        )}

        {message && paso !== 4 ? (
          <p className="text-xs font-bold uppercase text-amber-800">{message}</p>
        ) : null}
      </div>
    </section>
  );
}

function SgcFileSkeleton() {
  return (
    <li className="flex animate-pulse gap-4 px-4 py-4 sm:px-5">
      <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-200" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-2/3 max-w-xs rounded bg-slate-200" />
        <div className="h-3 w-1/3 rounded bg-slate-100" />
      </div>
    </li>
  );
}

export function SgcFileList({
  files,
  loading,
  refreshing,
  error,
  canDelete,
  canReplace,
  search,
  onSearchChange,
  deptoLabel,
  onDelete,
  onReplace,
  replaceBusyName,
}: {
  files: SgcFile[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  canDelete: boolean;
  canReplace?: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  deptoLabel: string;
  onDelete: (storageName: string, displayName: string) => void;
  onReplace?: (storageName: string, displayName: string, file: File) => void;
  replaceBusyName?: string | null;
}) {
  const filtered = useMemo(() => {
    const n = search.trim().toLowerCase();
    if (!n) return files;
    return files.filter((f) => f.name.toLowerCase().includes(n));
  }, [files, search]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-800">
            Archivos · {deptoLabel}
            {!loading ? ` (${files.length})` : ""}
          </p>
          {refreshing ? (
            <p className="text-[10px] font-semibold uppercase text-sky-700">Actualizando…</p>
          ) : null}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por nombre…"
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:max-w-xs"
        />
      </div>

      {error ? (
        <p className="px-5 py-10 text-center text-sm font-semibold text-amber-900">{error}</p>
      ) : loading ? (
        <ul>
          <SgcFileSkeleton />
          <SgcFileSkeleton />
          <SgcFileSkeleton />
        </ul>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-4xl opacity-40" aria-hidden>
            📂
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-700">
            {files.length === 0 ? "Esta carpeta está vacía" : "Sin coincidencias en la búsqueda"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {files.length === 0
              ? "Los administradores pueden cargar documentos desde el inicio de SGC."
              : "Pruebe otro término."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Archivo</th>
                  <th className="px-3 py-3">Tamaño</th>
                  <th className="px-3 py-3">Actualizado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((f) => (
                  <SgcFileRow
                    key={f.path}
                    file={f}
                    canDelete={canDelete}
                    canReplace={!!canReplace && !!onReplace}
                    replaceBusy={replaceBusyName === f.storageName}
                    onDelete={onDelete}
                    onReplace={onReplace}
                    variant="table"
                  />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {filtered.map((f) => (
              <SgcFileRow
                key={f.path}
                file={f}
                canDelete={canDelete}
                canReplace={!!canReplace && !!onReplace}
                replaceBusy={replaceBusyName === f.storageName}
                onDelete={onDelete}
                onReplace={onReplace}
                variant="card"
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SgcFileRow({
  file,
  canDelete,
  canReplace,
  replaceBusy,
  onDelete,
  onReplace,
  variant,
}: {
  file: SgcFile;
  canDelete: boolean;
  canReplace: boolean;
  replaceBusy?: boolean;
  onDelete: (storageName: string, displayName: string) => void;
  onReplace?: (storageName: string, displayName: string, file: File) => void;
  variant: "table" | "card";
}) {
  const kind = sgcFileKindFromName(file.name);
  const icon = FILE_KIND_ICON[kind];
  const fecha = file.updatedAt?.trim() ? formatoFechaDiaMesAnio(file.updatedAt) : "—";
  const replaceRef = useRef<HTMLInputElement>(null);

  const actions = (
    <div className="flex shrink-0 flex-wrap gap-2">
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-slate-800"
      >
        Abrir
      </a>
      {canReplace && onReplace ? (
        <>
          <input
            ref={replaceRef}
            type="file"
            className="sr-only"
            disabled={replaceBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onReplace(file.storageName, file.name, f);
            }}
          />
          <button
            type="button"
            disabled={replaceBusy}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold uppercase text-sky-950 hover:bg-sky-100 disabled:opacity-50"
            onClick={() => replaceRef.current?.click()}
          >
            {replaceBusy ? "…" : "Reemplazar"}
          </button>
        </>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase text-red-900 hover:bg-red-100"
          onClick={() => onDelete(file.storageName, file.name)}
        >
          Eliminar
        </button>
      ) : null}
    </div>
  );

  if (variant === "table") {
    return (
      <tr className="hover:bg-slate-50/80">
        <td className="px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
              {icon}
            </span>
            <span className="truncate font-semibold text-slate-900">{file.name}</span>
          </div>
        </td>
        <td className="px-3 py-3.5 tabular-nums text-slate-600">{sgcFormatBytes(file.sizeBytes)}</td>
        <td className="px-3 py-3.5 text-slate-600">{fecha}</td>
        <td className="px-5 py-3.5 text-right">{actions}</td>
      </tr>
    );
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex min-w-0 gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="break-words font-bold text-slate-900">{file.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {sgcFormatBytes(file.sizeBytes)} · {fecha}
          </p>
        </div>
      </div>
      {actions}
    </li>
  );
}

export function SgcSideNav({ activeCategoria }: { activeCategoria: SgcCategoriaId }) {
  return (
    <nav
      aria-label="Tipos de documento"
      className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-4"
    >
      <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Carpetas</p>
      <ul className="max-h-[min(50vh,28rem)] space-y-0.5 overflow-y-auto">
        {SGC_CATEGORIAS.map((c) => {
          const on = c.id === activeCategoria;
          return (
            <li key={c.id}>
              <Link
                href={`/sgc/${c.id}`}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                  on ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span aria-hidden>{c.icon}</span>
                <span className="truncate">{c.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/sgc"
        className="mt-2 block rounded-lg px-3 py-2 text-center text-[10px] font-bold uppercase text-sky-800 hover:bg-sky-50"
      >
        Todas las carpetas
      </Link>
    </nav>
  );
}

export function SgcLayoutPanel({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      {sidebar}
      <div className="min-w-0 space-y-5">{children}</div>
    </div>
  );
}

export { sgcCategoriaMeta };
