import { NextResponse } from "next/server";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessBonos } from "@/lib/app-role";
import { enviarEmailBonosSemana, parseDestinatariosBonos } from "@/lib/bonos-email";
import type { BonosFila } from "@/lib/bonos-types";
import { semanaDesdeIso } from "@/lib/semana-lun-dom";

export const dynamic = "force-dynamic";

function esBonosFila(raw: unknown): raw is BonosFila {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.noEmpleado === "string" &&
    typeof o.nombre === "string" &&
    typeof o.fechaIngreso === "string" &&
    typeof o.servicio === "string" &&
    typeof o.localForaneo === "string" &&
    typeof o.bonoDias === "number" &&
    typeof o.fechaCumplimiento === "string" &&
    typeof o.periodoEvaluadoDesde === "string" &&
    typeof o.periodoEvaluadoHasta === "string"
  );
}

/** POST: envía correo con bonos seleccionados de la semana. */
export async function POST(req: Request) {
  const auth = await getAuthedUserWithRole();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!roleMayAccessBonos(auth.role)) {
    return NextResponse.json({ error: "Sin permiso para Bonos" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const destinatariosRaw = typeof o.destinatarios === "string" ? o.destinatarios : "";
  const destinatarios = Array.isArray(o.destinatarios)
    ? parseDestinatariosBonos(o.destinatarios.filter((x) => typeof x === "string").join(","))
    : parseDestinatariosBonos(destinatariosRaw);

  const weekStartIso = typeof o.weekStartIso === "string" ? o.weekStartIso.trim() : "";
  const semana = semanaDesdeIso(weekStartIso);
  if (!semana) {
    return NextResponse.json({ error: "Indique weekStartIso (lunes YYYY-MM-DD)" }, { status: 400 });
  }

  const filasRaw = o.filas;
  if (!Array.isArray(filasRaw) || filasRaw.length === 0) {
    return NextResponse.json({ error: "Seleccione al menos un colaborador" }, { status: 400 });
  }

  const filas = filasRaw.filter(esBonosFila);
  if (filas.length === 0) {
    return NextResponse.json({ error: "Datos de colaboradores inválidos" }, { status: 400 });
  }

  try {
    const resultado = await enviarEmailBonosSemana({ destinatarios, filas, semana });
    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, error: resultado.error ?? "No se pudo enviar el correo", modo: resultado.modo },
        { status: resultado.modo === "sin_configurar" ? 503 : 502 },
      );
    }
    return NextResponse.json({ ok: true, enviados: resultado.enviados, modo: resultado.modo });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al enviar correo" },
      { status: 500 },
    );
  }
}
