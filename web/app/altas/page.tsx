import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { AltasPageClient } from "@/app/altas/AltasPageClient";

export default async function AltasPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return <AltasPageClient appRole={auth.role} />;
}
