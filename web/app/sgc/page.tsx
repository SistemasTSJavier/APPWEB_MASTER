import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessSgc } from "@/lib/app-role";
import { SgcHomeClient } from "./SgcHomeClient";

export default async function SgcHomePage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessSgc(auth.role)) redirect("/");

  return <SgcHomeClient appRole={auth.role} userMetadata={auth.user.user_metadata} />;
}
