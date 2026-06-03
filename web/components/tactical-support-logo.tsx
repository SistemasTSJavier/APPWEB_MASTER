"use client";

import { useState } from "react";
import { BRAND_LOGO_FALLBACKS, BRAND_LOGO_SRC } from "@/lib/brand-logo";

type Props = {
  className?: string;
  priority?: boolean;
};

export function TacticalSupportLogo({
  className = "mx-auto block h-20 w-auto max-w-[min(90vw,280px)] object-contain sm:h-24 md:h-28",
  priority = false,
}: Props) {
  const [idx, setIdx] = useState(0);
  const src = BRAND_LOGO_FALLBACKS[Math.min(idx, BRAND_LOGO_FALLBACKS.length - 1)];

  return (
    <div className="flex min-h-[5rem] shrink-0 items-center justify-center sm:min-h-[6rem]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Tactical Support"
        width={280}
        height={280}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className={className}
        onError={() => setIdx((i) => Math.min(i + 1, BRAND_LOGO_FALLBACKS.length - 1))}
      />
    </div>
  );
}
