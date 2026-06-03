"use client";

import { useState } from "react";
import { BRAND_LOGO_FALLBACKS } from "@/lib/brand-logo";

type Props = {
  className?: string;
  priority?: boolean;
  /** Por defecto logo.webp; el dashboard de categorización pasa CAT_DASHBOARD_LOGO_FALLBACKS (logo.png). */
  fallbacks?: readonly string[];
};

export function TacticalSupportLogo({
  className = "mx-auto block h-20 w-auto max-w-[min(90vw,280px)] object-contain sm:h-24 md:h-28",
  priority = false,
  fallbacks = BRAND_LOGO_FALLBACKS,
}: Props) {
  const chain = fallbacks as readonly string[];
  const [idx, setIdx] = useState(0);
  const src = chain[Math.min(idx, chain.length - 1)];

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
        onError={() => setIdx((i) => Math.min(i + 1, chain.length - 1))}
      />
    </div>
  );
}
