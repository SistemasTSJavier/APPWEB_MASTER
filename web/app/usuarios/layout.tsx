import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppModuleLayout } from "@/components/app-module-layout";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessAdminUsuarios } from "@/lib/app-role";

export default async function UsuariosLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessAdminUsuarios(auth.role)) redirect("/");

  return <AppModuleLayout currentPath="/usuarios">{children}</AppModuleLayout>;
}
