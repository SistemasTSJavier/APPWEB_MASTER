import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { modulosHabilitadosDesdeMetadata, roleMayAccessCategorizacion } from "@/lib/app-role";
import { CatDashboardClient } from "@/app/categorizacion/dashboard/CatDashboardClient";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ no?: string; servicio?: string }> };

export default async function CategorizacionDashboardPage({ searchParams }: Props) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessCategorizacion(auth.role, auth.user.email)) redirect("/");

  const sp = await searchParams;
  const modulos = modulosHabilitadosDesdeMetadata(
    (auth.user.user_metadata ?? null) as Record<string, unknown> | null,
  );

  return (
    <CatDashboardClient
      appRole={auth.role}
      email={auth.user.email ?? ""}
      initialNo={sp.no}
      initialServicio={sp.servicio}
      modulosHabilitados={modulos}
    />
  );
}
