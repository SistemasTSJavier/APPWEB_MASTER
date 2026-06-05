import { MoperFirmaPublicPageClient } from "@/app/moper/firma/MoperFirmaPublicPageClient";

export const dynamic = "force-dynamic";

/** Pagina publica: oficial firma MOPER con codigo (sin autenticacion). */
export default function MoperFirmaPublicPage() {
  return <MoperFirmaPublicPageClient />;
}
