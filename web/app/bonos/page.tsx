import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessBonos } from "@/lib/app-role";
import { BonosPageClient } from "./BonosPageClient";

export default async function BonosPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessBonos(auth.role)) redirect("/");

  return <BonosPageClient appRole={auth.role} email={auth.user.email ?? ""} />;
}
