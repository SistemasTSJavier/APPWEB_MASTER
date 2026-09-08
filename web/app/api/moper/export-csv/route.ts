import { NextResponse } from "next/server";
import { requireMoperApiRead } from "@/lib/moper-api-helper";
import { construirCsvMoperVerificados } from "@/lib/moper-registros-server";
import { moperWorkflowPuedeExportarCsv } from "@/lib/moper-workflow-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  if (!moperWorkflowPuedeExportarCsv(ctx.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const csv = await construirCsvMoperVerificados(ctx.admin);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="moper-verificados-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo generar el CSV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
