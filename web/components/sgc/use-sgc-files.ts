"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SgcCategoriaId, SgcDepartamentoId } from "@/lib/sgc-calidad";

export type SgcFile = {
  name: string;
  storageName: string;
  path: string;
  url: string;
  updatedAt: string | null;
  sizeBytes: number | null;
};

type ListResponse = {
  files?: SgcFile[];
  error?: string;
  canUpload?: boolean;
  canDelete?: boolean;
};

export function useSgcFiles(categoria: SgcCategoriaId, departamento: SgcDepartamentoId) {
  const [files, setFiles] = useState<SgcFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const permsSet = useRef(false);

  const recargar = useCallback(
    async (opts?: { silent?: boolean }) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setListError(null);

      try {
        const q = new URLSearchParams({ categoria, departamento });
        const r = await fetch(`/api/sgc/archivos?${q}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const j = (await r.json().catch(() => ({}))) as ListResponse;
        if (ac.signal.aborted) return;
        if (!r.ok || j.error) throw new Error(j.error ?? `Error ${r.status}`);
        setFiles(Array.isArray(j.files) ? j.files : []);
        if (!permsSet.current) {
          setCanUpload(!!j.canUpload);
          setCanDelete(!!j.canDelete);
          permsSet.current = true;
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        setFiles([]);
        setListError(e instanceof Error ? e.message : "No se pudo cargar la lista.");
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [categoria, departamento],
  );

  useEffect(() => {
    permsSet.current = false;
    const timer = window.setTimeout(() => {
      void recargar();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [recargar]);

  const quitarArchivo = useCallback((storageName: string) => {
    setFiles((prev) => prev.filter((f) => f.storageName !== storageName));
  }, []);

  const agregarArchivo = useCallback((file: SgcFile) => {
    setFiles((prev) => [file, ...prev]);
  }, []);

  return {
    files,
    loading,
    refreshing,
    listError,
    canUpload,
    canDelete,
    recargar,
    quitarArchivo,
    agregarArchivo,
    setFiles,
  };
}
