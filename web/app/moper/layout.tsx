import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function MoperLayout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/moper">{children}</AppModuleLayout>;
}
