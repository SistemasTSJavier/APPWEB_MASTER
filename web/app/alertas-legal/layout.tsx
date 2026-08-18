import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppModuleLayout } from "@/components/app-module-layout";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { userMayAccessAlertasLegal } from "@/lib/app-role";

export default async function AlertasLegalLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!userMayAccessAlertasLegal(auth.role, (auth.user.user_metadata ?? null) as Record<string, unknown> | null)) {
    redirect("/");
  }

  return <AppModuleLayout currentPath="/alertas-legal">{children}</AppModuleLayout>;
}
