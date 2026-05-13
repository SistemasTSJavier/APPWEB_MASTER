import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function BajasLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/bajas">{children}</AppModuleLayout>;
}
