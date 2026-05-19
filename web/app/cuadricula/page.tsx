import { CuadriculaClient } from "@/app/cuadricula/CuadriculaClient";

export default function CuadriculaPage() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f0f2f5]">
      <CuadriculaClient />
    </div>
  );
}
