import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import {
  colaboradoresConsultaLimitada,
  userMayModulo,
} from "@/lib/app-role";
import { ColaboradoresPageClient } from "@/app/colaboradores/ColaboradoresPageClient";

export default async function ColaboradoresPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  const consultaLimitada = colaboradoresConsultaLimitada(auth.role, meta);
  const puedeEditarCap = userMayModulo(auth.role, meta, "/colaboradores", "editar");
  const puedeEliminarCap = userMayModulo(auth.role, meta, "/colaboradores", "eliminar");

  return (
    <ColaboradoresPageClient
      appRole={auth.role}
      consultaLimitada={consultaLimitada}
      puedeEditarCapacidad={puedeEditarCap}
      puedeEliminarCapacidad={puedeEliminarCap}
    />
  );
}
