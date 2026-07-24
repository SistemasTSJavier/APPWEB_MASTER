import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { modulosHabilitadosDesdeMetadata } from "@/lib/app-role";
import { AppModuleShell } from "./app-module-shell";

export async function AppModuleLayout({
  children,
  currentPath,
}: {
  children: ReactNode;
  currentPath: string;
}) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  const email = auth.user.email ?? "—";
  const modulos = modulosHabilitadosDesdeMetadata(
    (auth.user.user_metadata ?? null) as Record<string, unknown> | null,
  );
  return (
    <AppModuleShell role={auth.role} email={email} currentPath={currentPath} modulosHabilitados={modulos}>
      {children}
    </AppModuleShell>
  );
}
