/** Captura fiel del dashboard: todas las imágenes a data URL antes de html2canvas. */

const DATA_URL_RE = /^data:|^blob:/i;

/** 1×1 PNG transparente — nunca deja URL externa que contamine el canvas. */
export const PIXEL_TRANSPARENTE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function absUrl(url: string): string | null {
  try {
    return new URL(url.trim(), window.location.origin).href;
  } catch {
    return null;
  }
}

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("No se pudo leer la imagen."));
    fr.readAsDataURL(blob);
  });
}

async function imagenViaProxy(url: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/categorizacion/dashboard/export-asset?url=${encodeURIComponent(url)}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { dataUrl?: string };
    const dataUrl = String(j.dataUrl ?? "").trim();
    return dataUrl.startsWith("data:") ? dataUrl : null;
  } catch {
    return null;
  }
}

export async function urlImagenADataUrl(url: string): Promise<string> {
  const src = url.trim();
  if (!src) return PIXEL_TRANSPARENTE;
  if (DATA_URL_RE.test(src)) return src;

  const abs = absUrl(src);
  if (!abs) return PIXEL_TRANSPARENTE;

  const mismoOrigen = abs.startsWith(window.location.origin);

  if (!mismoOrigen) {
    const viaProxy = await imagenViaProxy(abs);
    if (viaProxy) return viaProxy;
  }

  try {
    const res = await fetch(abs, { mode: "cors", credentials: "omit", cache: "no-store" });
    if (res.ok) {
      return await blobADataUrl(await res.blob());
    }
  } catch {
    /* */
  }

  if (mismoOrigen) {
    const viaProxy = await imagenViaProxy(abs);
    if (viaProxy) return viaProxy;
  }

  return PIXEL_TRANSPARENTE;
}

function urlsImagenEnElemento(root: Element): Set<string> {
  const urls = new Set<string>();
  root.querySelectorAll("img").forEach((img) => {
    const src = (img.currentSrc || img.getAttribute("src") || img.src || "").trim();
    if (!src || DATA_URL_RE.test(src)) return;
    const abs = absUrl(src);
    if (abs) urls.add(abs);
  });
  return urls;
}

export async function construirMapaImagenesExport(root: Element): Promise<Map<string, string>> {
  const urls = urlsImagenEnElemento(root);
  const mapa = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (url) => {
      mapa.set(url, await urlImagenADataUrl(url));
    }),
  );
  return mapa;
}

function resolverDataUrl(src: string, mapa: Map<string, string>): string {
  if (!src || DATA_URL_RE.test(src)) return src || PIXEL_TRANSPARENTE;
  const abs = absUrl(src);
  if (abs && mapa.has(abs)) return mapa.get(abs)!;
  return PIXEL_TRANSPARENTE;
}

export function aplicarMapaImagenesEnDom(
  root: HTMLElement,
  mapa: Map<string, string>,
  restaurar?: Array<() => void>,
): void {
  root.querySelectorAll("img").forEach((img) => {
    const prevSrc = img.src;
    const prevSrcset = img.getAttribute("srcset");
    const prevCross = img.crossOrigin;
    const raw = (img.currentSrc || img.getAttribute("src") || img.src || "").trim();
    const dataUrl = resolverDataUrl(raw, mapa);

    img.src = dataUrl;
    img.removeAttribute("srcset");
    img.crossOrigin = "anonymous";

    if (restaurar) {
      restaurar.push(() => {
        img.src = prevSrc;
        if (prevSrcset) img.setAttribute("srcset", prevSrcset);
        else img.removeAttribute("srcset");
        if (prevCross) img.crossOrigin = prevCross;
        else img.removeAttribute("crossorigin");
      });
    }
  });
}

export function esperarImagenesDecodificadas(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            if (typeof img.decode === "function") {
              void img.decode().then(() => resolve()).catch(() => resolve());
            } else {
              resolve();
            }
            return;
          }
          const fin = () => resolve();
          img.addEventListener("load", fin, { once: true });
          img.addEventListener("error", fin, { once: true });
        }),
    ),
  ).then(() => undefined);
}

const PROPS_LAYOUT_EXPORT = [
  "overflow",
  "overflow-x",
  "overflow-y",
  "max-height",
  "height",
  "min-height",
  "flex",
  "flex-grow",
  "flex-shrink",
  "transform",
] as const;

function expandirNodoExport(el: HTMLElement): () => void {
  const prev = new Map<string, string>();
  for (const prop of PROPS_LAYOUT_EXPORT) {
    prev.set(prop, el.style.getPropertyValue(prop));
  }
  el.style.overflow = "visible";
  el.style.overflowX = "visible";
  el.style.overflowY = "visible";
  el.style.maxHeight = "none";
  el.style.height = "auto";
  el.style.minHeight = "auto";
  el.style.flexGrow = "0";
  el.style.flexShrink = "0";
  el.style.transform = "none";
  return () => {
    for (const prop of PROPS_LAYOUT_EXPORT) {
      const val = prev.get(prop) ?? "";
      if (val) el.style.setProperty(prop, val);
      else el.style.removeProperty(prop);
    }
  };
}

export function prepararLayoutDashboardExport(root: HTMLElement): () => void {
  const restaurar: Array<() => void> = [];
  const nodos = new Set<HTMLElement>();

  const dashboard = root.matches("[data-cat-dashboard]")
    ? root
    : root.querySelector("[data-cat-dashboard]");
  if (dashboard instanceof HTMLElement) nodos.add(dashboard);

  root.querySelectorAll("[data-cat-export-expand], [data-cat-ranking-list]").forEach((node) => {
    if (node instanceof HTMLElement) nodos.add(node);
  });

  root.querySelectorAll("[data-cat-oficial-foto]").forEach((node) => {
    if (node instanceof HTMLElement) nodos.add(node);
  });

  for (const el of nodos) {
    restaurar.push(expandirNodoExport(el));
  }

  return () => {
    for (const fn of restaurar) fn();
  };
}

export function aplicarLayoutExportEnClon(cloneRoot: HTMLElement): void {
  const nodos = new Set<HTMLElement>();
  const dashboard = cloneRoot.matches("[data-cat-dashboard]")
    ? cloneRoot
    : cloneRoot.querySelector("[data-cat-dashboard]");
  if (dashboard instanceof HTMLElement) nodos.add(dashboard);

  cloneRoot.querySelectorAll("[data-cat-export-expand], [data-cat-ranking-list], [data-cat-oficial-foto]").forEach((node) => {
    if (node instanceof HTMLElement) nodos.add(node);
  });

  for (const el of nodos) {
    el.style.overflow = "visible";
    el.style.overflowX = "visible";
    el.style.overflowY = "visible";
    el.style.maxHeight = "none";
    el.style.height = "auto";
    el.style.minHeight = "auto";
    el.style.flexGrow = "0";
    el.style.flexShrink = "0";
    el.style.transform = "none";
  }
}

function esperarReflow(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function medirDashboardExport(el: HTMLElement): { ancho: number; alto: number } {
  const rect = el.getBoundingClientRect();
  return {
    ancho: Math.max(1, Math.ceil(el.scrollWidth), Math.ceil(rect.width), el.clientWidth),
    alto: Math.max(1, Math.ceil(el.scrollHeight), Math.ceil(rect.height), el.clientHeight),
  };
}

export async function prepararImagenesDashboardExport(root: HTMLElement): Promise<{
  mapa: Map<string, string>;
  restaurar: () => void;
}> {
  const mapa = await construirMapaImagenesExport(root);
  const restauraciones: Array<() => void> = [];
  aplicarMapaImagenesEnDom(root, mapa, restauraciones);
  await esperarImagenesDecodificadas(root);
  return {
    mapa,
    restaurar: () => {
      for (const fn of restauraciones) fn();
    },
  };
}

function esErrorCanvasContaminado(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes("taint") || msg.includes("todataurl") || msg.includes("security");
}

async function capturaConHtml2Canvas(
  el: HTMLElement,
  mapa: Map<string, string>,
  opts: { ancho: number; alto: number; scale: number },
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas-pro")).default;
  const canvas = await html2canvas(el, {
    scale: opts.scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
    width: opts.ancho,
    height: opts.alto,
    windowWidth: opts.ancho,
    windowHeight: opts.alto,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc, clonedEl) => {
      const cloneDashboard =
        (clonedDoc.querySelector("[data-cat-dashboard]") as HTMLElement | null) ?? clonedEl;
      aplicarMapaImagenesEnDom(cloneDashboard, mapa);
      aplicarLayoutExportEnClon(cloneDashboard);
      clonedDoc.querySelectorAll("img").forEach((node) => {
        if (!(node instanceof HTMLImageElement)) return;
        const raw = (node.currentSrc || node.getAttribute("src") || node.src || "").trim();
        node.src = resolverDataUrl(raw, mapa);
        node.removeAttribute("srcset");
        node.crossOrigin = "anonymous";
      });
      cloneDashboard.querySelectorAll("*").forEach((node) => {
        if (node instanceof HTMLElement) {
          node.style.animation = "none";
          node.style.transition = "none";
        }
      });
    },
  });
  canvas.toDataURL("image/png");
  return canvas;
}

async function capturaConHtmlToImage(
  el: HTMLElement,
  opts: { ancho: number; alto: number; scale: number },
): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image");
  return await toCanvas(el, {
    pixelRatio: opts.scale,
    width: opts.ancho,
    height: opts.alto,
    backgroundColor: "#ffffff",
    cacheBust: true,
    skipFonts: false,
  });
}

export async function capturarDashboardComoCanvas(
  el: HTMLElement,
  opts?: { scale?: number },
): Promise<HTMLCanvasElement> {
  const scale = opts?.scale ?? Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5));
  const restaurarLayout = prepararLayoutDashboardExport(el);
  await esperarReflow();
  const { ancho, alto } = medirDashboardExport(el);
  const { mapa, restaurar } = await prepararImagenesDashboardExport(el);
  try {
    try {
      return await capturaConHtml2Canvas(el, mapa, { ancho, alto, scale });
    } catch (err) {
      if (!esErrorCanvasContaminado(err)) throw err;
      return await capturaConHtmlToImage(el, { ancho, alto, scale });
    }
  } finally {
    restaurar();
    restaurarLayout();
  }
}
