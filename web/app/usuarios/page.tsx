import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessAdminUsuarios } from "@/lib/app-role";
import { UsuariosAdminClient } from "./UsuariosAdminClient";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessAdminUsuarios(auth.role)) redirect("/");

  return <UsuariosAdminClient currentUserId={auth.user.id} />;
}
