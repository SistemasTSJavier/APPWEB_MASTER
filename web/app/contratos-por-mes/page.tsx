import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { userMayAccessContratosPorMes } from "@/lib/app-role";
import { mesActualMx } from "@/lib/contratos-por-mes";
import { ContratosPorMesClient } from "./ContratosPorMesClient";

export default async function ContratosPorMesPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!userMayAccessContratosPorMes(auth.role, (auth.user.user_metadata ?? null) as Record<string, unknown> | null)) redirect("/");

  return <ContratosPorMesClient mesInicial={mesActualMx()} fuente="supabase" />;
}
