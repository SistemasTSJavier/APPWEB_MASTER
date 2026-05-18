import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function CuadriculaLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/cuadricula">{children}</AppModuleLayout>;
}
