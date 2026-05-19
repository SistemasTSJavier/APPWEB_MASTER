import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayEditColaboradores } from "@/lib/app-role";
import { BajasPageClient } from "@/app/bajas/BajasPageClient";

export default async function BajasPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return (
    <BajasPageClient
      readOnly={!roleMayEditColaboradores(auth.role)}
      appRole={auth.role}
    />
  );
}
