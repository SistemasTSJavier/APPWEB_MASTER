import Link from "next/link";
import Image from "next/image";
import { APP_ROLE_LABEL, homeSidebarLinks, type AppRole } from "@/lib/app-role";

function normPath(p: string): string {
  const x = (p || "/").replace(/\/$/, "") || "/";
  return x;
}

function linkClass(active: boolean): string {
  const base =
    "inline-flex shrink-0 items-center rounded-xl px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white ring-1 ring-white/20 transition-colors hover:bg-white/15 hover:ring-white/30 md:block md:px-4 md:py-3 md:text-base";
  return active ? `${base} bg-white/20 ring-sky-400/80` : base;
}

export function AppSidebarNav({
  role,
  email,
  currentPath,
}: {
  role: AppRole;
  email: string;
  currentPath: string;
}) {
  const cur = normPath(currentPath);
  const modules = homeSidebarLinks(role, email);
  const navItems = [{ href: "/", label: "Inicio" }, ...modules];

  return (
    <aside className="print:hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 p-3 text-white shadow-xl sm:p-4 md:sticky md:top-4 md:z-10 md:flex md:h-fit md:max-h-[calc(100dvh-2rem)] md:flex-col md:overflow-y-auto md:self-start md:p-5">
      <div className="flex items-center gap-3 md:flex-col md:gap-0">
        <Image
          src="/logo-tactical-support.png"
          alt="Logo"
          width={132}
          height={132}
          className="h-12 w-auto shrink-0 object-contain sm:h-16 md:mx-auto md:mb-5 md:h-auto md:w-[min(132px,40vw)]"
          priority
          unoptimized
        />
        <p className="min-w-0 flex-1 text-xs font-bold uppercase leading-snug tracking-wide text-slate-200 md:hidden">
          Tactical Support Master
        </p>
      </div>

      <nav
        aria-label="Módulos"
        className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mt-4 md:flex md:flex-col md:gap-2 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden md:[scrollbar-width:auto] md:[&::-webkit-scrollbar]:auto"
      >
        {navItems.map((item) => {
          const active =
            normPath(item.href) === cur ||
            (item.href !== "/" && cur.startsWith(`${normPath(item.href)}/`));
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={linkClass(active)}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-white/15 pt-3 text-sm md:mt-auto md:flex-shrink-0 md:pt-4">
        <p className="truncate font-semibold text-white md:break-all md:whitespace-normal" title={email}>
          {email}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-200">{APP_ROLE_LABEL[role]}</p>
        <form action="/auth/signout" method="post" className="mt-2 md:mt-3">
          <button
            type="submit"
            className="text-sm font-bold text-sky-200 underline-offset-2 hover:text-white hover:underline"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
