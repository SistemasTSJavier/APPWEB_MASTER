/**
 * Base URL del backend MOPER (sin barra final).
 * - Vacío: mismas peticiones a /api del mismo origen (proxy o Express sirviendo el build).
 * - Integración en otra plataforma: VITE_API_URL=https://tu-api.ejemplo.com
 */
export const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
