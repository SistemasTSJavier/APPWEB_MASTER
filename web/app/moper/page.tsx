import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { MoperPageClient } from "@/app/moper/MoperPageClient";

function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata ?? user.app_metadata ?? {};
  const n = String(meta.nombre ?? meta.full_name ?? meta.name ?? "").trim();
  if (n) return n;
  return (user.email ?? "").trim() || "Usuario";
}

export default async function MoperPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  return (
    <MoperPageClient
      appRole={auth.role}
      userEmail={auth.user.email ?? ""}
      userName={displayNameFromUser(auth.user)}
    />
  );
}
