import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayEditServiciosCatalogo } from "@/lib/app-role";
import { ServiciosPageClient } from "@/app/servicios/ServiciosPageClient";

export default async function ServiciosPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return <ServiciosPageClient puedeEditarCatalogo={roleMayEditServiciosCatalogo(auth.role)} />;
}
