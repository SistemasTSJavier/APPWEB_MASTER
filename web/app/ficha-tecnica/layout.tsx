import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function FichaTecnicaLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/ficha-tecnica">{children}</AppModuleLayout>;
}
