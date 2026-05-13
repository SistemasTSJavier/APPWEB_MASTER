import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function ColaboradoresLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/colaboradores">{children}</AppModuleLayout>;
}
