import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessGestoresProceso } from "@/lib/app-role";
import { GestoresProcesoClient } from "./GestoresProcesoClient";

function hoyYmdMx(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Carga el reporte en cliente vía API (evita bloquear la página al leer todos los expedientes en SSR). */
export default async function GestoresProcesoPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessGestoresProceso(auth.role)) redirect("/");

  const hoy = hoyYmdMx();

  return (
    <GestoresProcesoClient initialPeriodo="mes" initialFecha={hoy} fuente="supabase" />
  );
}
