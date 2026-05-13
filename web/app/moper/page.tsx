import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayWriteMoperHistorial } from "@/lib/app-role";
import { MoperPageClient } from "@/app/moper/MoperPageClient";

export default async function MoperPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return <MoperPageClient puedeEscribir={roleMayWriteMoperHistorial(auth.role)} />;
}
