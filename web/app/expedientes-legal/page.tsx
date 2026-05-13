import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { ExpedientesLegalPageClient } from "@/app/expedientes-legal/ExpedientesLegalPageClient";

export default async function ExpedientesLegalPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return <ExpedientesLegalPageClient appRole={auth.role} />;
}
