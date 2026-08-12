import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppModuleLayout } from "@/components/app-module-layout";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessMusica } from "@/lib/app-role";

export default async function MusicaLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessMusica(auth.role)) redirect("/");

  return <AppModuleLayout currentPath="/musica">{children}</AppModuleLayout>;
}
