import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function ExpedientesLegalLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/expedientes-legal">{children}</AppModuleLayout>;
}
