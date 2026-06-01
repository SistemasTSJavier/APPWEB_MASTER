import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppModuleLayout } from "@/components/app-module-layout";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessGestoresProceso } from "@/lib/app-role";

export default async function GestoresProcesoLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessGestoresProceso(auth.role)) redirect("/");

  return <AppModuleLayout currentPath="/gestores-proceso">{children}</AppModuleLayout>;
}
