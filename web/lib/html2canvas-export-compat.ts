/** html2canvas 1.x no entiende lab(), oklch(), lch() ni color-mix() de Tailwind v4. */

const MODERN_COLOR_FN_RE = /\b(?:lab|oklch|lch|color-mix)\(/i;

function reemplazarColoresModernosEnCss(css: string): string {
  return css.replace(/\b(?:lab|oklch|lch|color-mix)\([^)]*\)/gi, "transparent");
}

export function sanitizarDocumentoParaHtml2Canvas(clonedDoc: Document): void {
  clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());
  clonedDoc.querySelectorAll("style").forEach((style) => {
    const text = style.textContent ?? "";
    if (MODERN_COLOR_FN_RE.test(text)) {
      style.textContent = reemplazarColoresModernosEnCss(text);
    }
  });
}

function copiarEstiloCalculado(source: Element, target: HTMLElement): void {
  const computed = window.getComputedStyle(source);
  for (let i = 0; i < computed.length; i++) {
    const prop = computed.item(i);
    const value = computed.getPropertyValue(prop);
    if (!value) continue;
    target.style.setProperty(prop, value, computed.getPropertyPriority(prop));
  }
}

/** Inline estilos calculados (RGB) desde el DOM vivo al clon, sin hojas Tailwind. */
export function inlineComputedStylesParaHtml2Canvas(sourceRoot: Element, cloneRoot: HTMLElement): void {
  const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
  const cloneNodes = [cloneRoot, ...cloneRoot.querySelectorAll("*")];
  const total = Math.min(sourceNodes.length, cloneNodes.length);

  for (let i = 0; i < total; i++) {
    const source = sourceNodes[i];
    const clone = cloneNodes[i];
    if (!(clone instanceof HTMLElement)) continue;
    if (!(source instanceof HTMLElement || source instanceof SVGElement)) continue;
    copiarEstiloCalculado(source, clone);
  }
}

export function prepararClonHtml2Canvas(
  clonedDoc: Document,
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement,
): void {
  sanitizarDocumentoParaHtml2Canvas(clonedDoc);
  inlineComputedStylesParaHtml2Canvas(sourceRoot, cloneRoot);
}
