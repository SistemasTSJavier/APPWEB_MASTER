import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import {
  defaultHomeForRole,
  modulosHabilitadosDesdeMetadata,
  roleEsClienteEnfoque,
  roleMayAccessAsistenciaServicio,
} from "@/lib/app-role";
import { AsistenciaServicioClient } from "./AsistenciaServicioClient";

export const dynamic = "force-dynamic";

export default async function AsistenciaServicioPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string; mes?: string }>;
}) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");

  const mods = modulosHabilitadosDesdeMetadata(
    (auth.user.user_metadata ?? null) as Record<string, unknown> | null,
  );

  if (!roleMayAccessAsistenciaServicio(auth.role)) {
    redirect(defaultHomeForRole(auth.role, mods));
  }

  if (roleEsClienteEnfoque(auth.role)) {
    if (!mods.includes("/asistencia-servicio")) {
      redirect(defaultHomeForRole(auth.role, mods));
    }
  }

  const sp = await searchParams;
  return (
    <AsistenciaServicioClient
      appRole={auth.role}
      email={auth.user.email ?? ""}
      modulosHabilitados={mods}
      initialServicio={sp.servicio}
      initialMes={sp.mes}
      esCliente={roleEsClienteEnfoque(auth.role)}
    />
  );
}
