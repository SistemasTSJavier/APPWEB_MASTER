"use client";

import { useMoperWorkflow } from "./MoperWorkflowContext";

export function MoperWorkflowHeader() {
  const { user } = useMoperWorkflow();
  return (
    <div className="border-b-2 border-oxford-300 bg-white shrink-0 rounded-t-xl">
      <div className="px-3 sm:px-4 py-3 flex flex-wrap items-center justify-center sm:justify-between gap-2">
        <span className="text-base sm:text-lg font-bold text-black tracking-wide">TACTICAL</span>
        <img
          src="/image.png"
          alt="Logo Tactical Support"
          className="h-8 sm:h-10 w-auto object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="text-base sm:text-lg font-bold text-black tracking-wide">SUPPORT</span>
        <span className="w-full sm:w-auto text-center sm:text-right text-sm text-oxford-600">
          {user.nombre} ({user.rol})
        </span>
      </div>
    </div>
  );
}
