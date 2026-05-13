import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { ColaboradoresPageClient } from "@/app/colaboradores/ColaboradoresPageClient";

export default async function ColaboradoresPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return <ColaboradoresPageClient appRole={auth.role} />;
}
