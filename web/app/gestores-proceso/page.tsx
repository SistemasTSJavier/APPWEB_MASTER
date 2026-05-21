import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessGestoresProceso } from "@/lib/app-role";
import { buildGestoresProcesoReport } from "@/lib/gestores-proceso";
import { listColaboradoresGestoresServer } from "@/lib/gestores-proceso-server";
import { GestoresProcesoClient } from "./GestoresProcesoClient";

function hoyYmdMx(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function GestoresProcesoPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessGestoresProceso(auth.role)) redirect("/");

  const hoy = hoyYmdMx();
  const { list, fuente } = await listColaboradoresGestoresServer();
  const reportMes = buildGestoresProcesoReport(list, "mes", hoy);

  return (
    <GestoresProcesoClient
      initialReport={reportMes}
      initialPeriodo="mes"
      initialFecha={hoy}
      fuente={fuente}
    />
  );
}
