import { CuadriculaClient } from "@/app/cuadricula/CuadriculaClient";

export default function CuadriculaPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f0f2f5] shadow-sm">
      <CuadriculaClient />
    </div>
  );
}
