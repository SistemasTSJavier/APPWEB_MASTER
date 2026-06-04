import type { ReactNode } from "react";
import { AppModuleLayout } from "@/components/app-module-layout";

export default function Ds3Layout({ children }: { children: ReactNode }) {
  return <AppModuleLayout currentPath="/ds3">{children}</AppModuleLayout>;
}
