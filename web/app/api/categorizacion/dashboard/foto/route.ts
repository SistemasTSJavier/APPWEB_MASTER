import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function supabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function storageDesdeUrlPublica(publicUrl: string): { bucket: string; path: string } | null {
  const u = publicUrl.trim();
  const marker = "/storage/v1/object/public/";
  const i = u.indexOf(marker);
  if (i === -1) return null;
  const rest = u.slice(i + marker.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const path = decodeURIComponent((rest.slice(slash + 1).split("?")[0] ?? "").split("#")[0] ?? "");
  return bucket && path ? { bucket, path } : null;
}

function mimeDesdePath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function esUrlImagenPermitida(url: string, appOrigin: string): boolean {
  try {
    const u = new URL(url);
    if (u.origin === appOrigin) return true;
    const sb = supabaseOrigin();
    if (sb && u.origin === sb) return true;
    if (u.pathname.includes("/storage/v1/object/public/")) return true;
    return false;
  } catch {
    return false;
  }
}

async function leerImagenBytes(abs: string): Promise<{ buf: Buffer; mime: string } | null> {
  const storage = storageDesdeUrlPublica(abs);
  if (storage && isSupabaseServerConfigured()) {
    const admin = createSupabaseServiceRoleClient();
    if (admin) {
      const { data, error } = await admin.storage.from(storage.bucket).download(storage.path);
      if (!error && data) {
        const buf = Buffer.from(await data.arrayBuffer());
        if (buf.length > 0 && buf.length <= MAX_BYTES) {
          const mime = (data.type || mimeDesdePath(storage.path)).split(";")[0]?.trim() || "image/jpeg";
          if (ALLOWED_MIME.has(mime)) return { buf, mime };
        }
      }
    }
  }

  try {
    const res = await fetch(abs, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;
    const mime = (res.headers.get("content-type") ?? mimeDesdePath(abs)).split(";")[0]?.trim() || "image/jpeg";
    if (!ALLOWED_MIME.has(mime)) return null;
    return { buf, mime };
  } catch {
    return null;
  }
}

/** GET ?url= — reenvía la imagen desde el mismo origen (evita CORS y buckets no públicos). */
export async function GET(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;

  const appOrigin = new URL(req.url).origin;
  const raw = new URL(req.url).searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "url requerida" }, { status: 400 });
  }

  let abs = raw;
  try {
    abs = new URL(raw, appOrigin).href;
  } catch {
    return NextResponse.json({ error: "url invalida" }, { status: 400 });
  }

  if (!esUrlImagenPermitida(abs, appOrigin)) {
    return NextResponse.json({ error: "url no permitida" }, { status: 403 });
  }

  const imagen = await leerImagenBytes(abs);
  if (!imagen) {
    return NextResponse.json({ error: "imagen no encontrada" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(imagen.buf), {
    status: 200,
    headers: {
      "Content-Type": imagen.mime,
      "Content-Length": String(imagen.buf.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
