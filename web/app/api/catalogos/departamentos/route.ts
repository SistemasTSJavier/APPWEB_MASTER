import { NextResponse } from "next/server";
import { listarDepartamentosOpciones } from "@/lib/app-catalogos";

export const dynamic = "force-dynamic";

/** Lista pública de departamentos (fijos + catálogo) para formularios. */
export async function GET() {
  try {
    const departamentos = await listarDepartamentosOpciones();
    return NextResponse.json({
      departamentos: departamentos.map((d) => ({ id: d.id, label: d.label })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al listar departamentos" },
      { status: 500 },
    );
  }
}
