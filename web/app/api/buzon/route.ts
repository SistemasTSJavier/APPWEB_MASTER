import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { userMayAccessBuzon, userMayEditBuzon } from "@/lib/app-role";
import { esBuzonAprobacion, esBuzonEstatus, validarBuzonCreate, BUZON_EVIDENCIA_MAX_BYTES } from "@/lib/buzon";
import { departamentoExiste } from "@/lib/app-catalogos";
import { crearRegistroBuzon, listarRegistrosBuzon } from "@/lib/buzon-server";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Público: crear registro (multipart: campos + evidencia). */
export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido." }, { status: 400 });
  }

  const validado = validarBuzonCreate({
    departamento: formData.get("departamento"),
    nombreColaborador: formData.get("nombreColaborador"),
    quejaRequerimiento: formData.get("quejaRequerimiento"),
  });
  if (!validado.ok) {
    return NextResponse.json({ error: validado.error }, { status: 400 });
  }

  if (!(await departamentoExiste(validado.data.departamento))) {
    return NextResponse.json({ error: "Departamento no válido." }, { status: 400 });
  }

  const file = formData.get("evidencia");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json(
      { error: "La evidencia fotográfica es obligatoria. Tómela al momento del registro." },
      { status: 400 },
    );
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "La evidencia debe ser JPEG, PNG o WebP." }, { status: 400 });
  }
  if (file.size > BUZON_EVIDENCIA_MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera 5 MB." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await crearRegistroBuzon(validado.data, { buf, mime });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    codigoSeguimiento: result.row.codigoSeguimiento,
    id: result.row.id,
  });
}

/** Panel: listar registros. */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayAccessBuzon(auth.role, meta)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(req.url);
  const aprobacionRaw = url.searchParams.get("aprobacion")?.trim() ?? "";
  const estadoRaw = url.searchParams.get("estatus")?.trim() ?? "";
  const aprobacion = esBuzonAprobacion(aprobacionRaw) ? aprobacionRaw : undefined;
  const estatus = esBuzonEstatus(estadoRaw) ? estadoRaw : undefined;

  const result = await listarRegistrosBuzon({ aprobacion, estatus });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    rows: result.rows,
    puedeEditar: userMayEditBuzon(auth.role, meta),
  });
}
