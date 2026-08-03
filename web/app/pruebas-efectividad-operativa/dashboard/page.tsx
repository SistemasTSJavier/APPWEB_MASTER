import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import {
  modulosHabilitadosDesdeMetadata,
  roleEsClienteEnfoque,
  roleMayAccessPruebasEfectividad,
} from "@/lib/app-role";
import { resolverContextoEnfoqueCliente } from "@/lib/categorizacion-enfoque-auth";
import { PruebasEfectividadDashboardClient } from "./PruebasEfectividadDashboardClient";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ no?: string; servicio?: string }> };

export default async function PruebasEfectividadDashboardPage({ searchParams }: Props) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessPruebasEfectividad(auth.role, auth.user.email)) redirect("/");
  const sp = await searchParams;
  const modulos = modulosHabilitadosDesdeMetadata(
    (auth.user.user_metadata ?? null) as Record<string, unknown> | null,
  );

  const esCliente = roleEsClienteEnfoque(auth.role);
  let servicioCliente: string | null = null;
  if (esCliente) {
    const ctx = await resolverContextoEnfoqueCliente(auth.user);
    if (!ctx) redirect("/");
    servicioCliente = ctx.servicio;
  }

  return (
    <PruebasEfectividadDashboardClient
      appRole={auth.role}
      email={auth.user.email ?? ""}
      initialNo={sp.no}
      initialServicio={servicioCliente ?? sp.servicio}
      servicioFijo={servicioCliente}
      soloLecturaCliente={esCliente}
      modulosHabilitados={modulos}
    />
  );
}
