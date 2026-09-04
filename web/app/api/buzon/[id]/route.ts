import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { userMayEditBuzon } from "@/lib/app-role";
import { esBuzonEstatus } from "@/lib/buzon";
import { actualizarAprobacionBuzon, actualizarEstatusBuzon } from "@/lib/buzon-server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Panel: aprobar/rechazar o cambiar estatus (solo si aprobado) + nota. */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayEditBuzon(auth.role, meta)) {
    return NextResponse.json({ error: "No autorizado para editar." }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const accion = String(o.accion ?? "").trim();
  const nota = String(o.nota ?? "").trim();
  const email = auth.user.email ?? auth.user.id ?? "usuario";

  if (accion === "aprobacion") {
    const aprobacionRaw = String(o.aprobacion ?? "").trim();
    if (aprobacionRaw !== "aprobado" && aprobacionRaw !== "no_aprobado") {
      return NextResponse.json(
        { error: "Indique aprobado o no_aprobado." },
        { status: 400 },
      );
    }
    const result = await actualizarAprobacionBuzon(id, aprobacionRaw, nota, email);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }
    return NextResponse.json({ ok: true, row: result.row });
  }

  if (accion === "estatus" || (!accion && o.estatus != null)) {
    const estatusRaw = String(o.estatus ?? "").trim();
    if (!esBuzonEstatus(estatusRaw)) {
      return NextResponse.json({ error: "Estatus inválido." }, { status: 400 });
    }
    const result = await actualizarEstatusBuzon(id, estatusRaw, nota, email);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }
    return NextResponse.json({ ok: true, row: result.row });
  }

  return NextResponse.json(
    { error: "Indique accion: 'aprobacion' o 'estatus'." },
    { status: 400 },
  );
}
