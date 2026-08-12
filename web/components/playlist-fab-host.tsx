"use client";

import { usePathname } from "next/navigation";
import { GlobalPlaylistFab } from "@/components/global-playlist-fab";

/**
 * Host del reproductor en el layout raíz: no se desmonta al cambiar de módulo.
 */
export function PlaylistFabHost() {
  const path = (usePathname() || "/").replace(/\/$/, "") || "/";

  // Sin sesión / vistas públicas: no mostrar
  if (
    path === "/login" ||
    path.startsWith("/auth") ||
    path === "/ideas-que-transforman" ||
    path.startsWith("/moper/firma")
  ) {
    return null;
  }

  return <GlobalPlaylistFab />;
}
