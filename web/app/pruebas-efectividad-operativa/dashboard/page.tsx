import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessPruebasEfectividad } from "@/lib/app-role";
import { PruebasEfectividadDashboardClient } from "./PruebasEfectividadDashboardClient";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ no?: string; servicio?: string }> };

export default async function PruebasEfectividadDashboardPage({ searchParams }: Props) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessPruebasEfectividad(auth.role, auth.user.email)) redirect("/");
  const sp = await searchParams;
  return (
    <PruebasEfectividadDashboardClient
      appRole={auth.role}
      email={auth.user.email ?? ""}
      initialNo={sp.no}
      initialServicio={sp.servicio}
    />
  );
}
