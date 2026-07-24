import { redirect, notFound } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessSgc } from "@/lib/app-role";
import { isSgcCategoriaId } from "@/lib/sgc-calidad";
import { SgcCategoriaPageClient } from "../SgcCategoriaPageClient";

type Props = { params: Promise<{ categoria: string }> };

export default async function SgcCategoriaPage({ params }: Props) {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessSgc(auth.role)) redirect("/");

  const { categoria: catRaw } = await params;
  if (!isSgcCategoriaId(catRaw)) notFound();

  return <SgcCategoriaPageClient categoria={catRaw} appRole={auth.role} userMetadata={auth.user.user_metadata} />;
}
