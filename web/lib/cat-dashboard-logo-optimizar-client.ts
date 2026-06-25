/** Logos horizontales de cliente — más ancho que alto. */
const MAX_ANCHO = 640;
const MAX_ALTO = 320;
export const CAT_LOGO_SERVICIO_MAX_BYTES = 350_000;

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

function escalaDentroDe(imgW: number, imgH: number, maxW: number, maxH: number): { w: number; h: number } {
  if (imgW <= 0 || imgH <= 0) return { w: maxW, h: maxH };
  const ratio = Math.min(maxW / imgW, maxH / imgH, 1);
  return {
    w: Math.max(1, Math.round(imgW * ratio)),
    h: Math.max(1, Math.round(imgH * ratio)),
  };
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

async function mimeSalidaOptimo(canvas: HTMLCanvasElement): Promise<"image/webp" | "image/jpeg"> {
  const probe = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
  return probe ? "image/webp" : "image/jpeg";
}

export async function optimizarLogoServicioParaSubida(file: File): Promise<File> {
  const mimeIn = (file.type || "").toLowerCase();
  if (!mimeIn.startsWith("image/")) throw new Error("SOLO SE PERMITEN IMÁGENES.");

  const img = await leerComoImagen(file);
  const { w, h } = escalaDentroDe(img.naturalWidth, img.naturalHeight, MAX_ANCHO, MAX_ALTO);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS NO DISPONIBLE.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const outMime = await mimeSalidaOptimo(canvas);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "logo-cliente";

  let calidad = 0.9;
  let blob: Blob | null = null;
  for (let i = 0; i < 10; i++) {
    blob = await canvasABlob(canvas, outMime, calidad);
    if (blob.size <= CAT_LOGO_SERVICIO_MAX_BYTES) break;
    calidad = Math.max(0.55, calidad - 0.06);
  }
  if (!blob) throw new Error("ERROR AL COMPRIMIR IMAGEN.");
  if (blob.size > CAT_LOGO_SERVICIO_MAX_BYTES) {
    throw new Error("EL LOGO SIGUE SIENDO MUY PESADO TRAS OPTIMIZAR.");
  }

  const ext = outMime === "image/webp" ? ".webp" : ".jpg";
  return new File([blob], `${baseName}${ext}`, { type: outMime, lastModified: Date.now() });
}
