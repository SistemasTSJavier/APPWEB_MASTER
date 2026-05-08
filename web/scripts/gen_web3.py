from pathlib import Path
root = Path('.')

def w(rel: str, content: str):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.lstrip("\n"), encoding="utf-8")

w("app/sign-out-button.tsx", r"""
\"use client\";

import { signOut } from \"next-auth/react\";

export function SignOutButton() {
  return (
    <button
      type=\"button\"
      onClick={() => signOut({ callbackUrl: \"/login\" })}
      className=\"rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900\"
    >
      Salir
    </button>
  );
}
""")

layout = Path("app/layout.tsx").read_text(encoding="utf-8")
layout = layout.replace("import Link from \"next/link\";", "import Link from \"next/link\";\nimport { SignOutButton } from \"./sign-out-button\";")
layout = layout.replace(
    """          <form action="/api/auth/signout" method="post">
            <button type="submit" className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900">
              Salir
            </button>
          </form>""",
    "          <SignOutButton />",
)
Path("app/layout.tsx").write_text(layout, encoding="utf-8")

w("app/catalogos/puestos/page.tsx", r"""
import { prisma } from \"@/lib/prisma\";
import { createPuesto, deletePuesto } from \"@/app/empleados/actions\";

export default async function PuestosPage() {
  const puestos = await prisma.puesto.findMany({ orderBy: { nombre: \"asc\" } });

  return (
    <div className=\"mx-auto max-w-3xl px-4 py-8\">
      <h1 className=\"mb-6 text-2xl font-semibold\">Catálogo de puestos</h1>
      <form action={createPuesto} className=\"mb-8 flex flex-wrap items-end gap-3\">
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Nuevo puesto</span>
          <input name=\"nombre\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" required />
        </label>
        <button type=\"submit\" className=\"rounded bg-white px-3 py-2 text-sm font-medium text-black\">
          Agregar
        </button>
      </form>
      <ul className=\"divide-y divide-neutral-800 rounded-lg border border-neutral-800\">
        {puestos.map((p) => (
          <li key={p.id} className=\"flex items-center justify-between gap-3 px-3 py-2 text-sm\">
            <span>{p.nombre}</span>
            <form action={deletePuesto.bind(null, p.id)}>
              <button type=\"submit\" className=\"text-red-400 hover:underline\">
                Eliminar
              </button>
            </form>
          </li>
        ))}
      </ul>
      {puestos.length === 0 ? <p className=\"text-neutral-500\">Sin puestos.</p> : null}
    </div>
  );
}
""")

w("app/catalogos/sueldos/page.tsx", r"""
import { prisma } from \"@/lib/prisma\";
import { createSueldoServicio, deleteSueldoServicio } from \"@/app/empleados/actions\";

function d(v: Date) {
  return new Date(v).toISOString().slice(0, 10);
}

export default async function SueldosPage() {
  const rows = await prisma.sueldoServicio.findMany({ orderBy: { fechaUltimaActualizacion: \"desc\" } });

  return (
    <div className=\"mx-auto max-w-5xl px-4 py-8\">
      <h1 className=\"mb-6 text-2xl font-semibold\">Sueldos por servicio</h1>
      <form action={createSueldoServicio} className=\"mb-8 grid gap-3 rounded-lg border border-neutral-800 p-4 md:grid-cols-4\">
        <label className=\"flex flex-col gap-1 text-sm md:col-span-2\">
          <span>Servicio</span>
          <input name=\"servicio\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" required />
        </label>
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Puesto</span>
          <input name=\"puesto\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" required />
        </label>
        <label className=\"flex flex-col gap-1 text-sm\">
          <span>Sueldo</span>
          <input name=\"sueldo\" type=\"number\" step=\"0.01\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" required />
        </label>
        <label className=\"flex flex-col gap-1 text-sm md:col-span-2\">
          <span>Fecha última actualización</span>
          <input name=\"fechaUltimaActualizacion\" type=\"date\" className=\"rounded border border-neutral-700 bg-neutral-900 px-3 py-2\" />
        </label>
        <div className=\"flex items-end\">
          <button type=\"submit\" className=\"rounded bg-white px-3 py-2 text-sm font-medium text-black\">
            Agregar
          </button>
        </div>
      </form>
      <div className=\"overflow-x-auto rounded-lg border border-neutral-800\">
        <table className=\"min-w-full text-left text-sm\">
          <thead className=\"bg-neutral-900/80 text-neutral-300\">
            <tr>
              <th className=\"px-3 py-2\">Servicio</th>
              <th className=\"px-3 py-2\">Puesto</th>
              <th className=\"px-3 py-2\">Sueldo</th>
              <th className=\"px-3 py-2\">Actualización</th>
              <th className=\"px-3 py-2\"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className=\"border-t border-neutral-800\">
                <td className=\"px-3 py-2\">{r.servicio}</td>
                <td className=\"px-3 py-2\">{r.puesto}</td>
                <td className=\"px-3 py-2\">{String(r.sueldo)}</td>
                <td className=\"px-3 py-2\">{d(r.fechaUltimaActualizacion)}</td>
                <td className=\"px-3 py-2 text-right\">
                  <form action={deleteSueldoServicio.bind(null, r.id)}>
                    <button type=\"submit\" className=\"text-red-400 hover:underline\">
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className=\"p-4 text-neutral-500\">Sin registros.</p> : null}
      </div>
    </div>
  );
}
""")

print("catalog + signout ok")
