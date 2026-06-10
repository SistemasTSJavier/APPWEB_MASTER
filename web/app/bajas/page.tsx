import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayWriteBajas } from "@/lib/app-role";
import { BajasPageClient } from "@/app/bajas/BajasPageClient";

export default async function BajasPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return (
    <BajasPageClient
      readOnly={!roleMayWriteBajas(auth.role)}
      appRole={auth.role}
    />
  );
}
