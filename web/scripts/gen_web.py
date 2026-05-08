from pathlib import Path
import textwrap

root = Path('.')
(root / 'app' / 'empleados').mkdir(parents=True, exist_ok=True)
(root / 'app' / 'empleados' / '[id]').mkdir(parents=True, exist_ok=True)
(root / 'app' / 'catalogos' / 'puestos').mkdir(parents=True, exist_ok=True)
(root / 'app' / 'catalogos' / 'sueldos').mkdir(parents=True, exist_ok=True)
(root / 'app' / 'login').mkdir(parents=True, exist_ok=True)

def w(rel: str, content: str):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.lstrip('\n'), encoding='utf-8')

w('middleware.ts', """
import { auth } from \"@/auth\";

export default auth((req) => {
  const logged = !!req.auth;
  const isLogin = req.nextUrl.pathname.startsWith(\"/login\");
  if (!logged && !isLogin) {
    return Response.redirect(new URL(\"/login\", req.nextUrl));
  }
  if (logged && isLogin) {
    return Response.redirect(new URL(\"/empleados\", req.nextUrl));
  }
});

export const config = {
  matcher: [\"/((?!api|_next/static|_next/image|favicon.ico).*)\",],
};
""")

w('app/providers.tsx', """
\"use client\";

import { SessionProvider } from \"next-auth/react\";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
""")

w('app/login/page.tsx', """
\"use client\";

import { signIn } from \"next-auth/react\";
import { useState } from \"react\";
import { useRouter } from \"next/navigation\";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const username = (form.elements.namedItem(\"username\") as HTMLInputElement).value;
    const password = (form.elements.namedItem(\"password\") as HTMLInputElement).value;
    const res = await signIn(\"credentials\", { username, password, redirect: false });
    setPending(false);
    if (res?.error) {
      setError(\"Credenciales inválidas\");
      return;
    }
    router.push(\"/empleados\");
    router.refresh();
  }

  return (
    <div className=\"mx-auto flex min-h-screen max-w-md flex-col justify-center px-4\">
      <h1 className=\"mb-6 text-2xl font-semibold tracking-tight\">Tactical Support Master</h1>
      <form onSubmit={onSubmit} className=\"flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-950/40 p-6\">
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Usuario</span>
          <input name=\"username\" autoComplete=\"username\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" required />
        </label>
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Contraseña</span>
          <input name=\"password\" type=\"password\" autoComplete=\"current-password\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" required />
        </label>
        {error ? <p className=\"text-sm text-red-400\">{error}</p> : null}
        <button type=\"submit\" disabled={pending} className=\"rounded bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50\">
          {pending ? \"Entrando…\" : \"Entrar\"}
        </button>
      </form>
    </div>
  );
}
""")

w('app/page.tsx', """
import Link from \"next/link\";
import { auth } from \"@/auth\";
import { redirect } from \"next/navigation\";

export default async function Home() {
  const session = await auth();
  if (!session) redirect(\"/login\");

  return (
    <div className=\"mx-auto max-w-3xl px-4 py-10\">
      <h1 className=\"text-2xl font-semibold\">Inicio</h1>
      <p className=\"mt-2 text-neutral-400\">Plataforma master de colaboradores.</p>
      <ul className=\"mt-6 space-y-3 text-sm\">
        <li>
          <Link className=\"text-blue-400 underline\" href=\"/empleados\">Colaboradores</Link>
        </li>
        <li>
          <Link className=\"text-blue-400 underline\" href=\"/catalogos/puestos\">Catálogo de puestos</Link>
        </li>
        <li>
          <Link className=\"text-blue-400 underline\" href=\"/catalogos/sueldos\">Sueldos por servicio</Link>
        </li>
      </ul>
    </div>
  );
}
""")

w('app/empleados/page.tsx', """
import Link from \"next/link\";
import { prisma } from \"@/lib/prisma\";

export default async function EmpleadosPage() {
  const rows = await prisma.empleado.findMany({
    orderBy: { noEmpleado: \"asc\" },
    include: { master: true },
  });

  return (
    <div className=\"mx-auto max-w-6xl px-4 py-8\">
      <div className=\"mb-6 flex items-center justify-between gap-4\">
        <h1 className=\"text-2xl font-semibold\">Colaboradores</h1>
        <Link href=\"/empleados/nuevo\" className=\"rounded bg-white px-3 py-2 text-sm font-medium text-black\">
          Nuevo
        </Link>
      </div>
      <div className=\"overflow-x-auto rounded-lg border border-neutral-800\">
        <table className=\"min-w-full text-left text-sm\">
          <thead className=\"bg-neutral-900/80 text-neutral-300\">
            <tr>
              <th className=\"px-3 py-2\">No.</th>
              <th className=\"px-3 py-2\">Nombre</th>
              <th className=\"px-3 py-2\">Estatus</th>
              <th className=\"px-3 py-2\">Servicio</th>
              <th className=\"px-3 py-2\"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className=\"border-t border-neutral-800\">
                <td className=\"px-3 py-2 font-mono\">{e.noEmpleado}</td>
                <td className=\"px-3 py-2\">{e.master?.nombreCompleto ?? \"—\"}</td>
                <td className=\"px-3 py-2\">{e.master?.estatusEmpleado ?? \"—\"}</td>
                <td className=\"px-3 py-2\">{e.master?.servicio ?? \"—\"}</td>
                <td className=\"px-3 py-2 text-right\">
                  <Link href={`/empleados/${e.id}`} className=\"text-blue-400 underline\">
                    Ver / editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className=\"p-4 text-neutral-500\">Sin registros. Crea el primero.</p> : null}
      </div>
    </div>
  );
}
""")

w('app/empleados/nuevo/page.tsx', """
import { createEmpleado } from \"../actions\";

export default function NuevoEmpleadoPage() {
  return (
    <div className=\"mx-auto max-w-xl px-4 py-8\">
      <h1 className=\"mb-6 text-2xl font-semibold\">Nuevo colaborador</h1>
      <form action={createEmpleado} className=\"flex flex-col gap-4\">
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>No. empleado *</span>
          <input name=\"noEmpleado\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" required />
        </label>
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Nombre completo *</span>
          <input name=\"nombreCompleto\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" required />
        </label>
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Estatus</span>
          <select name=\"estatusEmpleado\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\">
            <option value=\"ACTIVO\">ACTIVO</option>
            <option value=\"INACTIVO\">INACTIVO</option>
          </select>
        </label>
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Fecha de ingreso</span>
          <input name=\"fechaIngreso\" type=\"date\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" />
        </label>
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Puesto</span>
          <input name=\"puesto\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" />
        </label>
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Servicio (cliente / lugar)</span>
          <input name=\"servicio\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" />
        </label>
        <button type=\"submit\" className=\"mt-2 rounded bg-white px-3 py-2 text-sm font-medium text-black\">
          Guardar
        </button>
      </form>
    </div>
  );
}
""")

print('phase1 ok')
