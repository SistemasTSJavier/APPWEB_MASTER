import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { userMayAccessBuzon } from "@/lib/app-role";
import { BuzonPanelClient } from "./BuzonPanelClient";

export const dynamic = "force-dynamic";

export default async function BuzonPanelPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayAccessBuzon(auth.role, meta)) redirect("/");

  return <BuzonPanelClient />;
}
