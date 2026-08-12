import { MusicaPageClient } from "./MusicaPageClient";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAdminMusica } from "@/lib/app-role";
import { redirect } from "next/navigation";

export default async function MusicaPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");

  return (
    <MusicaPageClient
      appRole={auth.role}
      email={auth.user.email ?? ""}
      isAdmin={roleMayAdminMusica(auth.role)}
    />
  );
}
