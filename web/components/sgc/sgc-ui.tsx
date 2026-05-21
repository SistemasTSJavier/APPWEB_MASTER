"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
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
      {SGC_DEPARTAMENTOS.map((d) => {
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

  const okMsg = message?.startsWith("Archivo") || message?.startsWith("Eliminado");

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
  search,
  onSearchChange,
  deptoLabel,
  onDelete,
}: {
  files: SgcFile[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  canDelete: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  deptoLabel: string;
  onDelete: (storageName: string, displayName: string) => void;
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
            {files.length === 0 ? "Suba el primer documento con el área de arriba." : "Pruebe otro término."}
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
                  <SgcFileRow key={f.path} file={f} canDelete={canDelete} onDelete={onDelete} variant="table" />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {filtered.map((f) => (
              <SgcFileRow key={f.path} file={f} canDelete={canDelete} onDelete={onDelete} variant="card" />
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
  onDelete,
  variant,
}: {
  file: SgcFile;
  canDelete: boolean;
  onDelete: (storageName: string, displayName: string) => void;
  variant: "table" | "card";
}) {
  const kind = sgcFileKindFromName(file.name);
  const icon = FILE_KIND_ICON[kind];
  const fecha = file.updatedAt?.trim() ? formatoFechaDiaMesAnio(file.updatedAt) : "—";

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
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
              {icon}
            </span>
            <span className="truncate font-semibold text-slate-900">{file.name}</span>
          </div>
        </td>
        <td className="px-3 py-3.5 text-slate-600 tabular-nums">{sgcFormatBytes(file.sizeBytes)}</td>
        <td className="px-3 py-3.5 text-slate-600">{fecha}</td>
        <td className="px-5 py-3.5 text-right">{actions}</td>
      </tr>
    );
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex gap-3 min-w-0">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 break-words">{file.name}</p>
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
