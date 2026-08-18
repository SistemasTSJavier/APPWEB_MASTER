import { NextResponse } from "next/server";
import { requireAlertasLegalApi, requireAlertasLegalGestionApi } from "@/lib/alertas-legal-api-auth";
import { esAlertaLegalEstado, esAlertaLegalMotivo } from "@/lib/alertas-legal-types";
import { destinatarioAlertasLegalLlegada } from "@/lib/alertas-legal-email";
import {
  crearAlertaLegal,
  datosColaboradorParaAlerta,
  listarAlertasLegal,
} from "@/lib/alertas-legal-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireAlertasLegalApi();
  if ("error" in gate) return gate.error;

  const estadoRaw = new URL(req.url).searchParams.get("estado")?.trim() ?? "";
  const estado = esAlertaLegalEstado(estadoRaw) ? estadoRaw : undefined;
  const result = await listarAlertasLegal({ estado });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ rows: result.rows, emailTo: await destinatarioAlertasLegalLlegada() });
}

export async function POST(req: Request) {
  const gate = await requireAlertasLegalGestionApi();
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const noEmpleado = String(o.noEmpleado ?? "").trim();
  const motivoRaw = String(o.motivo ?? "renuncia").trim().toLowerCase();
  if (!esAlertaLegalMotivo(motivoRaw)) {
    return NextResponse.json({ error: "Motivo no válido." }, { status: 400 });
  }

  const result = await crearAlertaLegal({
    noEmpleado,
    nombre: String(o.nombre ?? "").trim(),
    servicio: String(o.servicio ?? "").trim(),
    motivo: motivoRaw,
    notas: String(o.notas ?? "").trim(),
    createdByEmail: gate.auth.user.email ?? "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
  }
  return NextResponse.json({ ok: true, row: result.row });
}

/** Vista previa de expediente al pegar N.º de empleado. */
export async function PUT(req: Request) {
  const gate = await requireAlertasLegalGestionApi();
  if ("error" in gate) return gate.error;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const no = String((body as { noEmpleado?: string })?.noEmpleado ?? "").trim();
  const hit = await datosColaboradorParaAlerta(no);
  if (!hit) return NextResponse.json({ error: "No se encontró ese N.º de empleado." }, { status: 404 });
  return NextResponse.json(hit);
}
