import { redirect, notFound } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import {
  modulosHabilitadosDesdeMetadata,
  roleEsClienteEnfoque,
  roleMayAccessCategorizacion,
} from "@/lib/app-role";
import { isCategorizacionModuloId, categorizacionModuloEsAdminOnly } from "@/lib/categorizacion-modulos";
import { CategorizacionModuloClient } from "@/app/categorizacion/CategorizacionModuloClient";

type Props = { params: Promise<{ modulo: string }> };

export const dynamic = "force-dynamic";

export default async function CategorizacionModuloPage({ params }: Props) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessCategorizacion(auth.role, auth.user.email)) redirect("/");

  const { modulo: moduloRaw } = await params;
  if (!isCategorizacionModuloId(moduloRaw)) notFound();
  if (roleEsClienteEnfoque(auth.role) && moduloRaw !== "dashboard") {
    redirect("/categorizacion/dashboard");
  }
  if (categorizacionModuloEsAdminOnly(moduloRaw) && auth.role !== "admin") {
    redirect("/categorizacion");
  }

  const modulos = modulosHabilitadosDesdeMetadata(
    (auth.user.user_metadata ?? null) as Record<string, unknown> | null,
  );

  return (
    <CategorizacionModuloClient
      appRole={auth.role}
      email={auth.user.email ?? ""}
      moduloId={moduloRaw}
      modulosHabilitados={modulos}
    />
  );
}
