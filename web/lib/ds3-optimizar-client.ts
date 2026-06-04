import { DS3_MAX_BYTES } from "@/lib/ds3-constants";
import { esImagenMime, mimeDs3Permitido } from "@/lib/ds3-archivo";

function leerComoImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("NO SE PUDO LEER LA IMAGEN."));
    };
    img.src = url;
  });
}

async function canvasABlob(canvas: HTMLCanvasElement, mime: string, calidad: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("ERROR AL COMPRIMIR IMAGEN."))),
      mime,
      calidad,
    );
  });
}

/** Reduce JPEG/WebP/PNG en el navegador hasta acercarse al límite. */
export async function optimizarImagenCliente(file: File, maxBytes = DS3_MAX_BYTES): Promise<File> {
  if (!esImagenMime(file.type)) return file;
  if (file.size <= maxBytes) return file;

  const img = await leerComoImagen(file);
  const outMime = file.type === "image/png" ? "image/jpeg" : file.type;
  const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";

  let escala = Math.min(1, Math.sqrt(maxBytes / file.size));
  let calidad = 0.85;

  for (let intento = 0; intento < 12; intento++) {
    const w = Math.max(320, Math.round(img.naturalWidth * escala));
    const h = Math.max(320, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CANVAS NO DISPONIBLE.");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await canvasABlob(canvas, outMime, calidad);
    if (blob.size <= maxBytes) {
      const ext = outMime === "image/png" ? ".png" : outMime === "image/webp" ? ".webp" : ".jpg";
      return new File([blob], `${baseName}${ext}`, { type: outMime, lastModified: Date.now() });
    }
    calidad = Math.max(0.45, calidad - 0.08);
    escala *= 0.88;
  }

  throw new Error(`NO SE PUDO REDUCIR LA IMAGEN BAJO ${Math.round(maxBytes / (1024 * 1024))} MB.`);
}

export async function optimizarArchivoEnServidor(file: File): Promise<File> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const r = await fetch("/api/ds3/archivos/optimizar", { method: "POST", body: fd });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Error ${r.status}`);
  }
  const blob = await r.blob();
  const disp = r.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/i.exec(disp);
  const nombre = match?.[1] ?? file.name;
  const type = r.headers.get("Content-Type") ?? file.type;
  return new File([blob], nombre, { type, lastModified: Date.now() });
}

/** Prepara un archivo para subida DS3 (≤ 5 MB). */
export async function prepararArchivoDs3(file: File): Promise<File> {
  const mime = (file.type || "").toLowerCase();
  if (!mimeDs3Permitido(mime)) {
    throw new Error("TIPO NO PERMITIDO. USE PDF, JPG, PNG O WEBP.");
  }

  let actual = esImagenMime(mime) ? await optimizarImagenCliente(file) : file;
  if (actual.size <= DS3_MAX_BYTES) return actual;

  actual = await optimizarArchivoEnServidor(actual);
  if (actual.size > DS3_MAX_BYTES) {
    throw new Error(`EL ARCHIVO SIGUE SUPERANDO ${DS3_MAX_BYTES / (1024 * 1024)} MB TRAS OPTIMIZAR.`);
  }
  return actual;
}
