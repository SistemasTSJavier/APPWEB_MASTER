import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppModuleLayout } from "@/components/app-module-layout";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessIdeasQueTransforman } from "@/lib/app-role";
import { IDEAS_PANEL_PATH } from "@/lib/ideas-que-transforman-public-paths";

export default async function IdeasPanelLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessIdeasQueTransforman(auth.role)) redirect("/");

  return <AppModuleLayout currentPath={IDEAS_PANEL_PATH}>{children}</AppModuleLayout>;
}
