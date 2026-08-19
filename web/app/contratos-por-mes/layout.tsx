import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppModuleLayout } from "@/components/app-module-layout";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { userMayAccessContratosPorMes } from "@/lib/app-role";

export default async function ContratosPorMesLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!userMayAccessContratosPorMes(auth.role, (auth.user.user_metadata ?? null) as Record<string, unknown> | null)) redirect("/");

  return <AppModuleLayout currentPath="/contratos-por-mes">{children}</AppModuleLayout>;
}
