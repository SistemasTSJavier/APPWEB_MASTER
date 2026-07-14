import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import {
  roleEsClienteEnfoque,
  roleMayAccessPruebasEfectividad,
} from "@/lib/app-role";
import { PruebasEfectividadClient } from "./PruebasEfectividadClient";

export const dynamic = "force-dynamic";

export default async function PruebasEfectividadPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessPruebasEfectividad(auth.role, auth.user.email)) redirect("/");
  if (roleEsClienteEnfoque(auth.role)) redirect("/pruebas-efectividad-operativa/dashboard");

  return <PruebasEfectividadClient appRole={auth.role} email={auth.user.email ?? ""} />;
}
