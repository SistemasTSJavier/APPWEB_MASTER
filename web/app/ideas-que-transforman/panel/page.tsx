import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessIdeasQueTransforman } from "@/lib/app-role";
import { IdeasPanelClient } from "./IdeasPanelClient";

export const dynamic = "force-dynamic";

export default async function IdeasQueTransformanPanelPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessIdeasQueTransforman(auth.role)) redirect("/");

  return <IdeasPanelClient />;
}
