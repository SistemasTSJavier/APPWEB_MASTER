import { NextResponse } from "next/server";
import { verificarRegistroBuzon } from "@/lib/buzon-server";

export const dynamic = "force-dynamic";

/** Público: consultar estatus por código de seguimiento. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get("codigo")?.trim() ?? "";
  const result = await verificarRegistroBuzon(codigo);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }
  return NextResponse.json({ ok: true, registro: result.registro });
}
