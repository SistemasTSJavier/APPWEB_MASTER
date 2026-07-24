import { redirect } from "next/navigation";
import { canAccessPath, modulosHabilitadosDesdeMetadata } from "@/lib/app-role";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { Ds3PageClient } from "@/app/ds3/Ds3PageClient";

export const dynamic = "force-dynamic";

export default async function Ds3Page() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  const modulos = modulosHabilitadosDesdeMetadata(auth.user.user_metadata);
  if (!canAccessPath(auth.role, "/ds3", auth.user.email, modulos)) redirect("/");

  return <Ds3PageClient appRole={auth.role} />;
}
