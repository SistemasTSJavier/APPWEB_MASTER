import type { ReactNode } from "react";
import type { AppRole } from "@/lib/app-role";
import { AppSidebarNav } from "./app-sidebar-nav";

export function AppModuleShell({
  role,
  email,
  currentPath,
  children,
}: {
  role: AppRole;
  email: string;
  currentPath: string;
  children: ReactNode;
}) {
  const layoutWide = currentPath === "/cuadricula" || currentPath === "/colaboradores";
  return (
    <div className="min-h-dvh bg-slate-100 [--sidebar-w:280px] print:min-h-0 print:bg-white">
      <div
        className={`mx-auto grid min-h-dvh w-full grid-cols-1 gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-[minmax(0,var(--sidebar-w))_minmax(0,1fr)] md:gap-5 md:p-5 lg:p-6 print:min-h-0 print:max-w-none print:grid-cols-1 print:p-2 [&>div]:min-h-0 ${
          layoutWide ? "max-w-[min(100vw-16px,2200px)]" : "max-w-[1600px]"
        }`}
      >
        <AppSidebarNav role={role} email={email} currentPath={currentPath} />
        <div className="relative flex min-h-0 min-w-0 flex-col overflow-x-auto overflow-y-auto print:overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
}
