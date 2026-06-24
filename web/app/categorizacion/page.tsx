import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleEsClienteEnfoque, roleMayAccessCategorizacion } from "@/lib/app-role";
import { CategorizacionHomeClient } from "@/app/categorizacion/CategorizacionHomeClient";

export const dynamic = "force-dynamic";

export default async function CategorizacionPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessCategorizacion(auth.role, auth.user.email)) redirect("/");
  if (roleEsClienteEnfoque(auth.role)) redirect("/categorizacion/dashboard");

  return <CategorizacionHomeClient appRole={auth.role} email={auth.user.email ?? ""} />;
}
