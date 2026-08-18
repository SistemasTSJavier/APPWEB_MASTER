import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import {
  userMayAccessAlertasLegal,
  userMayAgregarAlertasLegal,
  userMayCancelarAlertasLegal,
  userMayConfigurarAlertasLegal,
  userMayMarcarAlertaLegalLlegada,
} from "@/lib/app-role";
import { AlertasLegalClient } from "./AlertasLegalClient";

export const metadata = { title: "Alertas Legal" };

export default async function AlertasLegalPage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayAccessAlertasLegal(auth.role, meta)) redirect("/");

  return (
    <AlertasLegalClient
      appRole={auth.role}
      email={auth.user.email ?? ""}
      puedeGestionar={userMayAgregarAlertasLegal(auth.role, meta)}
      puedeCancelar={userMayCancelarAlertasLegal(auth.role, meta)}
      puedeMarcarLlegada={userMayMarcarAlertaLegalLlegada(auth.role, meta)}
      puedeConfigurar={userMayConfigurarAlertasLegal(auth.role)}
    />
  );
}
