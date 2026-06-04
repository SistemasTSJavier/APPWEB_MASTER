import sharp from "sharp";
import { DS3_MAX_BYTES } from "@/lib/ds3-constants";
import { esImagenMime, esPdfMime, extensionPorMime } from "@/lib/ds3-archivo";

async function comprimirImagenSharp(buf: Buffer, mime: string): Promise<{ buf: Buffer; mime: string }> {
  let pipeline = sharp(buf, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const w = meta.width ?? 1920;
  const h = meta.height ?? 1080;
  const maxSide = Math.max(w, h);
  if (maxSide > 2400) {
    pipeline = pipeline.resize(2400, 2400, { fit: "inside", withoutEnlargement: true });
  }

  let calidad = 82;
  let outMime = mime === "image/png" ? "image/jpeg" : mime;
  for (let i = 0; i < 10; i++) {
    let encoded: Buffer;
    if (outMime === "image/webp") {
      encoded = await pipeline.webp({ quality: calidad }).toBuffer();
    } else if (outMime === "image/png") {
      encoded = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      if (encoded.length > DS3_MAX_BYTES) {
        outMime = "image/jpeg";
        continue;
      }
    } else {
      encoded = await pipeline.jpeg({ quality: calidad, mozjpeg: true }).toBuffer();
      outMime = "image/jpeg";
    }
    if (encoded.length <= DS3_MAX_BYTES) {
      return { buf: encoded, mime: outMime };
    }
    calidad = Math.max(40, calidad - 8);
    pipeline = sharp(buf, { failOn: "none" }).rotate().resize(
      Math.round((meta.width ?? 1920) * 0.85),
      Math.round((meta.height ?? 1080) * 0.85),
      { fit: "inside", withoutEnlargement: true },
    );
  }
  throw new Error(`NO SE PUDO COMPRIMIR LA IMAGEN BAJO ${DS3_MAX_BYTES / (1024 * 1024)} MB.`);
}

export async function optimizarBufferDs3(
  buf: Buffer,
  mime: string,
  nombreOriginal: string,
): Promise<{ buf: Buffer; mime: string; nombre: string }> {
  const m = mime.toLowerCase();
  if (esPdfMime(m)) {
    if (buf.length <= DS3_MAX_BYTES) {
      return { buf, mime: m, nombre: nombreOriginal };
    }
    throw new Error(
      `EL PDF SUPERA ${DS3_MAX_BYTES / (1024 * 1024)} MB. COMPRIMALO EXTERNAMENTE ANTES DE SUBIR.`,
    );
  }
  if (esImagenMime(m)) {
    const { buf: out, mime: outMime } = await comprimirImagenSharp(buf, m);
    const ext = extensionPorMime(outMime);
    const base = nombreOriginal.replace(/\.[^.]+$/, "") || "imagen";
    return { buf: out, mime: outMime, nombre: `${base}${ext}` };
  }
  throw new Error("TIPO DE ARCHIVO NO SOPORTADO.");
}
