import { BuzonPublicClient } from "./BuzonPublicClient";

export const dynamic = "force-dynamic";

/** Formulario público: crear / verificar registros del buzón (sin sesión). */
export default function BuzonPublicPage() {
  return <BuzonPublicClient />;
}
