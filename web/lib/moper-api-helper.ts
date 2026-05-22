import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayReadMoperHistorialApi } from "@/lib/app-role";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/app-role";

export type MoperApiContext = { admin: SupabaseClient; role: AppRole; email: string | null };

export async function requireMoperApiRead(): Promise<MoperApiContext | NextResponse> {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadMoperHistorialApi(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }
  return { admin, role: auth.role, email: auth.user.email ?? null };
}

export async function requireMoperApiWrite(): Promise<MoperApiContext | NextResponse> {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  const { roleMayWriteMoperHistorial } = await import("@/lib/app-role");
  if (!roleMayWriteMoperHistorial(ctx.role)) {
    return NextResponse.json({ error: "No autorizado para editar MOPER" }, { status: 403 });
  }
  return ctx;
}

export function parseRegistroId(raw: string): number | null {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export function displayNameFromAuth(email: string | null, meta: unknown): string {
  if (meta && typeof meta === "object" && meta !== null) {
    const m = meta as Record<string, unknown>;
    const n = String(m.nombre ?? m.full_name ?? m.name ?? "").trim();
    if (n) return n;
  }
  return (email ?? "").trim() || "Usuario";
}
