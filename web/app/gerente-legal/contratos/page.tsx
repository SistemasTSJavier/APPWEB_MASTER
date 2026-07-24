import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { canAccessPath, modulosHabilitadosDesdeMetadata } from "@/lib/app-role";
import { GerenteLegalContratosClient } from "@/app/gerente-legal/contratos/GerenteLegalContratosClient";

export const dynamic = "force-dynamic";

export default async function GerenteLegalContratosPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  const modulos = modulosHabilitadosDesdeMetadata(auth.user.user_metadata);
  if (!canAccessPath(auth.role, "/gerente-legal", auth.user.email, modulos)) redirect("/");

  return (
    <GerenteLegalContratosClient
      appRole={auth.role}
      email={auth.user.email ?? "—"}
      modulosHabilitados={modulos}
    />
  );
}
