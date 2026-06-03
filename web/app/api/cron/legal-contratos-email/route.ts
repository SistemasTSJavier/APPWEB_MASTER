import { NextResponse } from "next/server";
import { ejecutarEnvioAutomaticoProgramado } from "@/lib/legal-contratos-server";

export const dynamic = "force-dynamic";

/**
 * Cron diario: envía listado a legal cuando queden 8 días o menos para vencer el contrato de prueba.
 * Proteger con CRON_SECRET en Authorization: Bearer <secret> o ?secret=
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (expected) {
    const url = new URL(req.url);
    const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const query = url.searchParams.get("secret")?.trim();
    if (header !== expected && query !== expected) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    const result = await ejecutarEnvioAutomaticoProgramado({ forzar: true });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
