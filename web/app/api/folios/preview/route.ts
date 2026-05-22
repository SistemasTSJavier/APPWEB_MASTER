import { NextResponse } from "next/server";
import { leerSiguienteFolioPreview } from "@/lib/moper-registros-server";
import { requireMoperApiRead } from "@/lib/moper-api-helper";
import { hintSupabaseClientError } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  try {
    const folio = await leerSiguienteFolioPreview(ctx.admin);
    return NextResponse.json({ folio });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer folio";
    return NextResponse.json(
      {
        error: "Error al leer folio",
        detail: hintSupabaseClientError(msg),
      },
      { status: 500 },
    );
  }
}
