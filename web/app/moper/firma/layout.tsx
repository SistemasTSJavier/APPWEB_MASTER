import type { ReactNode } from "react";
import Image from "next/image";

/** Vista publica: oficial firma con codigo, sin login ni menu de la plataforma. */
export default function MoperFirmaPublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Image src="/logo.webp" alt="Tactical Support" width={48} height={48} className="h-10 w-auto" unoptimized />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Tactical Support · MOPER</p>
            <p className="text-sm font-bold uppercase text-slate-900">Firma del oficial</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
