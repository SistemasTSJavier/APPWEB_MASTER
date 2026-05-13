import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function AltasLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/altas">{children}</AppModuleLayout>;
}
