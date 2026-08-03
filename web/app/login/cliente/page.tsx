import { LoginFormPage } from "@/components/login/LoginFormPage";

/** Portal de acceso para clientes temporales (misma UI que /login). */
export default function LoginClientePage() {
  return <LoginFormPage mode="cliente" defaultNext="/categorizacion/dashboard" />;
}
