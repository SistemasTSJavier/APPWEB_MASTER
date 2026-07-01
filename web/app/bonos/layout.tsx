import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppModuleLayout } from "@/components/app-module-layout";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessBonos } from "@/lib/app-role";

export default async function BonosLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessBonos(auth.role)) redirect("/");

  return <AppModuleLayout currentPath="/bonos">{children}</AppModuleLayout>;
}
