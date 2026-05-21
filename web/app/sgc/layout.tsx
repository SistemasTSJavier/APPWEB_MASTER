import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function SgcLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/sgc">{children}</AppModuleLayout>;
}
