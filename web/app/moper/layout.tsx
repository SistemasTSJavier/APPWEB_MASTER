import type { ReactNode } from "react";

/** Layout raiz MOPER: las rutas hijas definen su propio shell (interno con sesion o firma publica). */
export default function MoperRootLayout({ children }: { children: ReactNode }) {
  return children;
}
