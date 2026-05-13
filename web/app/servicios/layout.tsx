import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function ServiciosLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/servicios">{children}</AppModuleLayout>;
}
