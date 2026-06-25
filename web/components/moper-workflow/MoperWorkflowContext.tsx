"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { AppRole } from "@/lib/app-role";
import { moperFetch } from "@/lib/moper-fetch";
import type { MoperRegistroApi } from "@/lib/moper-registros-types";
import {
  moperWorkflowPuedeFirmarControl,
  moperWorkflowPuedeFirmarGerente,
  moperWorkflowPuedeFirmarRh,
  moperWorkflowPuedeCancelar,
  moperWorkflowPuedeEditar,
  moperWorkflowPuedeMarcarRecibidoContabilidad,
  moperWorkflowPuedeReenviarEmailContabilidad,
  moperWorkflowEsSoloContabilidad,
  moperWorkflowEsNominasRecepcion,
  moperWorkflowRolFromAppRole,
  type MoperWorkflowRol,
} from "@/lib/moper-workflow-role";

export type MoperWorkflowUser = {
  email: string;
  nombre: string;
  rol: MoperWorkflowRol;
};

type AccesoCodigo = { codigo: string; registro: MoperRegistroApi };

type MoperWorkflowContextValue = {
  user: MoperWorkflowUser;
  appRole: AppRole;
  accesoPorCodigo: AccesoCodigo | null;
  puedeEditar: boolean;
  puedeCancelar: boolean;
  puedeFirmarRh: boolean;
  puedeFirmarGerente: boolean;
  puedeFirmarControl: boolean;
  puedeMarcarRecibidoContabilidad: boolean;
  puedeReenviarEmailContabilidad: boolean;
  esSoloContabilidad: boolean;
  esNominasRecepcion: boolean;
  loginPorCodigo: (codigo: string) => Promise<{ ok: boolean; error?: string }>;
  clearCodigoAcceso: () => void;
  setRegistroPorCodigo: (registro: MoperRegistroApi) => void;
  authHeaders: () => Record<string, string>;
};

const MoperWorkflowContext = createContext<MoperWorkflowContextValue | null>(null);

export function MoperWorkflowProvider({
  children,
  appRole,
  userEmail,
  userName,
}: {
  children: ReactNode;
  appRole: AppRole;
  userEmail: string;
  userName: string;
}) {
  const [accesoPorCodigo, setAccesoPorCodigo] = useState<AccesoCodigo | null>(null);

  const user: MoperWorkflowUser = {
    email: userEmail,
    nombre: userName,
    rol: moperWorkflowRolFromAppRole(appRole),
  };

  const authHeaders = useCallback((): Record<string, string> => ({}), []);

  const loginPorCodigo = useCallback(async (codigo: string) => {
    const c = codigo.trim().toUpperCase();
    if (!c) return { ok: false, error: "Ingrese el codigo" };
    try {
      const res = await moperFetch(`/api/moper/codigo/${encodeURIComponent(c)}`);
      const registro = (await res.json()) as MoperRegistroApi & { error?: string };
      if (!res.ok) return { ok: false, error: registro.error || "Codigo no valido" };
      setAccesoPorCodigo({ codigo: c, registro });
      return { ok: true };
    } catch {
      return { ok: false, error: "Error de conexion" };
    }
  }, []);

  const clearCodigoAcceso = useCallback(() => setAccesoPorCodigo(null), []);

  const setRegistroPorCodigo = useCallback((registro: MoperRegistroApi) => {
    setAccesoPorCodigo((prev) => (prev ? { ...prev, registro } : null));
  }, []);

  const value: MoperWorkflowContextValue = {
    user,
    appRole,
    accesoPorCodigo,
    puedeEditar: moperWorkflowPuedeEditar(appRole),
    puedeCancelar: moperWorkflowPuedeCancelar(userEmail, appRole),
    puedeFirmarRh: moperWorkflowPuedeFirmarRh(appRole),
    puedeFirmarGerente: moperWorkflowPuedeFirmarGerente(appRole),
    puedeFirmarControl: moperWorkflowPuedeFirmarControl(appRole),
    puedeMarcarRecibidoContabilidad: moperWorkflowPuedeMarcarRecibidoContabilidad(appRole),
    puedeReenviarEmailContabilidad: moperWorkflowPuedeReenviarEmailContabilidad(appRole),
    esSoloContabilidad: moperWorkflowEsSoloContabilidad(appRole),
    esNominasRecepcion: moperWorkflowEsNominasRecepcion(appRole),
    loginPorCodigo,
    clearCodigoAcceso,
    setRegistroPorCodigo,
    authHeaders,
  };

  return <MoperWorkflowContext.Provider value={value}>{children}</MoperWorkflowContext.Provider>;
}

export function useMoperWorkflow() {
  const ctx = useContext(MoperWorkflowContext);
  if (!ctx) throw new Error("useMoperWorkflow debe usarse dentro de MoperWorkflowProvider");
  return ctx;
}
