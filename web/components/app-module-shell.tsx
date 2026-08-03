import type { ReactNode } from "react";
import Link from "next/link";
import { APP_ROLE_LABEL, type AppRole } from "@/lib/app-role";
import { AppSidebarNav } from "./app-sidebar-nav";
import { SignOutButton } from "./sign-out-button";

export function AppModuleShell({
  role,
  email,
  currentPath,
  modulosHabilitados,
  children,
}: {
  role: AppRole;
  email: string;
  currentPath: string;
  modulosHabilitados?: readonly string[] | null;
  children: ReactNode;
}) {
  const isCuadricula = currentPath === "/cuadricula";
  const layoutWide =
    isCuadricula ||
    currentPath === "/colaboradores" ||
    currentPath === "/categorizacion" ||
    currentPath.startsWith("/categorizacion/");

  if (isCuadricula) {
    return (
      <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#f0f2f5] print:min-h-0 print:bg-white">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-950 px-2 py-1.5 text-white sm:px-3 sm:py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="shrink-0 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide text-sky-200 ring-1 ring-white/20 hover:bg-white/10 sm:text-sm"
            >
              ← Inicio
            </Link>
            <span className="text-xs font-bold uppercase tracking-wide text-white sm:text-sm">Cuadrícula</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-right text-[10px] sm:text-xs">
            <span className="hidden truncate text-slate-300 sm:inline" title={email}>
              {email}
            </span>
            <span className="font-bold uppercase text-slate-200">{APP_ROLE_LABEL[role]}</span>
            <SignOutButton
              label="Salir"
              className="font-bold text-sky-200 underline-offset-2 hover:text-white hover:underline disabled:opacity-60"
            />
          </div>
        </header>
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-100 [--sidebar-w:280px] print:min-h-0 print:bg-white">
      <div
        className={`mx-auto grid min-h-dvh w-full grid-cols-1 gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-[minmax(0,var(--sidebar-w))_minmax(0,1fr)] md:gap-5 md:p-5 lg:p-6 print:min-h-0 print:max-w-none print:grid-cols-1 print:p-2 [&>div]:min-h-0 ${
          layoutWide ? "max-w-[min(100vw-16px,2200px)]" : "max-w-[1600px]"
        }`}
      >
        <AppSidebarNav
          role={role}
          email={email}
          currentPath={currentPath}
          modulosHabilitados={modulosHabilitados}
        />
        <div className="relative flex min-h-0 min-w-0 flex-col overflow-x-auto overflow-y-auto print:overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
}
