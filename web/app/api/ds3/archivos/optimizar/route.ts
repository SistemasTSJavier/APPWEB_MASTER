import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditDs3 } from "@/lib/app-role";
import { mimeDs3Permitido } from "@/lib/ds3-archivo";
import { optimizarBufferDs3 } from "@/lib/ds3-optimizar-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditDs3(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData invalido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  if (!mimeDs3Permitido(mime)) {
    return NextResponse.json({ error: "Tipo no permitido (PDF, JPG, PNG, WEBP)." }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const out = await optimizarBufferDs3(buf, mime, file.name);
    return new NextResponse(new Uint8Array(out.buf), {
      status: 200,
      headers: {
        "Content-Type": out.mime,
        "Content-Disposition": `attachment; filename="${out.nombre.replace(/"/g, "")}"`,
        "X-Optimized-Size": String(out.buf.length),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al optimizar" }, { status: 400 });
  }
}
