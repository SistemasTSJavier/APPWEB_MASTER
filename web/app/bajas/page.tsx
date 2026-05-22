import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayEditColaboradoresLegacyRh } from "@/lib/app-role";
import { BajasPageClient } from "@/app/bajas/BajasPageClient";

export default async function BajasPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return (
    <BajasPageClient
      readOnly={!roleMayEditColaboradoresLegacyRh(auth.role)}
      appRole={auth.role}
    />
  );
}
