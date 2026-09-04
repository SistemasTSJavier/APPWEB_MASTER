import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppModuleLayout } from "@/components/app-module-layout";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { userMayAccessBuzon } from "@/lib/app-role";
import { BUZON_PANEL_PATH } from "@/lib/buzon-public-paths";

export default async function BuzonPanelLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayAccessBuzon(auth.role, meta)) redirect("/");

  return <AppModuleLayout currentPath={BUZON_PANEL_PATH}>{children}</AppModuleLayout>;
}
