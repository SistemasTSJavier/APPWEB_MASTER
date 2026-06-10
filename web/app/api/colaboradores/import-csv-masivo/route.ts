import { NextResponse } from "next/server";
import {
  COLABORADORES_CSV_MASIVO_FILAS_MAX,
  importColaboradoresCsvMasivoEnServidor,
} from "@/lib/colaboradores-import-csv-masivo";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayWriteExpedienteColaborador } from "@/lib/app-role";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteExpedienteColaborador(auth.role)) {
    return NextResponse.json({ error: "No autorizado para importar expedientes" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  let body: {
    csvText?: string;
    preserveMoper?: boolean;
    mergeExisting?: boolean;
    chunkSize?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const csvText = String(body.csvText ?? "");
  if (!csvText.trim()) {
    return NextResponse.json({ error: "csvText vacio" }, { status: 400 });
  }

  try {
    const result = await importColaboradoresCsvMasivoEnServidor(admin, csvText, {
      preserveMoper: body.preserveMoper !== false,
      mergeExisting: body.mergeExisting === true,
      chunkSize: body.chunkSize,
    });
    return NextResponse.json({
      ok: true,
      imported: result.imported,
      skippedEmpty: result.skippedEmpty,
      errors: result.errors,
      lotes: result.lotes,
      filasCsvValidas: result.filasCsvValidas,
      duplicateNosMerged: result.duplicateNosMerged,
      resolvedByNombre: result.resolvedByNombre,
      avisos: result.avisos,
      maxFilasPorArchivo: COLABORADORES_CSV_MASIVO_FILAS_MAX,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al importar CSV masivo" },
      { status: 500 },
    );
  }
}
