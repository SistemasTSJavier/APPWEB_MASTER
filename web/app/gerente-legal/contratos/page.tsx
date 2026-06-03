import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { canAccessPath } from "@/lib/app-role";
import { GerenteLegalContratosClient } from "@/app/gerente-legal/contratos/GerenteLegalContratosClient";

export const dynamic = "force-dynamic";

export default async function GerenteLegalContratosPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!canAccessPath(auth.role, "/gerente-legal")) redirect("/");

  return (
    <GerenteLegalContratosClient
      appRole={auth.role}
      email={auth.user.email ?? "—"}
    />
  );
}
