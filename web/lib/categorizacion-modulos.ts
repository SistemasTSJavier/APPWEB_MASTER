/** Módulos de la sección Categorización. */
export const CATEGORIZACION_MODULOS = [
  {
    id: "personal",
    label: "Personal",
    description: "Colaboradores activos sincronizados desde expedientes. Filtro por servicio y búsqueda.",
    icon: "👤",
  },
  {
    id: "recursos-humanos",
    label: "Recursos Humanos",
    description: "Faltas del mes desde cuadrícula (automático). Rotación y actas (1–5).",
    icon: "🏢",
  },
  {
    id: "catalogo-capacitaciones",
    label: "Catálogo capacitaciones",
    description: "Alta y edición de capacitaciones con fecha de inicio y vencimiento.",
    icon: "📋",
  },
  {
    id: "capacitacion",
    label: "Capacitación",
    description: "Registrar colaboradores a cursos vigentes; desempeño (1–5).",
    icon: "📚",
  },
  {
    id: "operaciones",
    label: "Operaciones",
    description: "Oficial: 15 criterios. Jefe de turno (JT): 24 criterios calificados por cada oficial del servicio; promedio acumulado.",
    icon: "⚙️",
  },
  {
    id: "enfoque-al-cliente",
    label: "Enfoque al cliente",
    description: "4 criterios de servicio al cliente (1–5), promedio y comentarios.",
    icon: "🤝",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Vista analítica, gráficas, nivel y paquete. Filtro por servicio y colaborador.",
    icon: "📈",
  },
  {
    id: "nivel",
    label: "Nivel",
    description: "GAMMA (1–2.5), BETA (2.6–4.5), ALFA (4.6–5) según promedio general.",
    icon: "📊",
  },
  {
    id: "paquete-prestaciones",
    label: "Paquete prestaciones",
    description: "Básico, Plus o Premium según el mismo promedio general.",
    icon: "🎁",
  },
] as const;

export type CategorizacionModuloId = (typeof CATEGORIZACION_MODULOS)[number]["id"];

export function isCategorizacionModuloId(id: string): id is CategorizacionModuloId {
  return CATEGORIZACION_MODULOS.some((m) => m.id === id);
}

export function categorizacionModuloMeta(id: CategorizacionModuloId) {
  return CATEGORIZACION_MODULOS.find((m) => m.id === id)!;
}

export function hrefCategorizacionModulo(id: CategorizacionModuloId): string {
  if (id === "dashboard") return "/categorizacion/dashboard";
  return `/categorizacion/${id}`;
}
