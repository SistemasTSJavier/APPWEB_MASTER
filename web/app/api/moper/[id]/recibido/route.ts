import { NextResponse } from "next/server";
import {
  marcarRecibidoContabilidadMoper,
  notificarContabilidadMoperPorId,
} from "@/lib/moper-registros-server";
import { displayNameFromAuth, parseRegistroId, requireMoperApiRead } from "@/lib/moper-api-helper";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayMarcarRecibidoContabilidadMoper } from "@/lib/app-role";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const { id: idRaw } = await params;
  const id = parseRegistroId(idRaw);
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  if (!roleMayMarcarRecibidoContabilidadMoper(ctx.role)) {
    return NextResponse.json({ error: "Solo contabilidad puede marcar como recibido" }, { status: 403 });
  }

  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;

  const nombre = displayNameFromAuth(
    auth.user.email ?? null,
    auth.user.user_metadata ?? auth.user.app_metadata,
  );

  try {
    const registro = await marcarRecibidoContabilidadMoper(ctx.admin, id, nombre || auth.user.email || "Contabilidad");
    return NextResponse.json(registro);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al marcar como recibido" },
      { status: 400 },
    );
  }
}
