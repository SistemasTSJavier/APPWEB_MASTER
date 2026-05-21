import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessSgc } from "@/lib/app-role";
import { SGC_CATEGORIAS } from "@/lib/sgc-calidad";

export default async function SgcHomePage() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");
  if (!roleMayAccessSgc(auth.role)) redirect("/");

  return (
    <div className="min-w-0 space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7 sm:py-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-800">Calidad</p>
        <h1 className="mt-2 text-xl font-extrabold uppercase tracking-wide text-slate-900 sm:text-2xl">
          Sistemas de gestión de calidad
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Documentación por tipo y por departamento. Seleccione una subcarpeta para ver o cargar los archivos de su
          área.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SGC_CATEGORIAS.map((cat) => (
          <Link
            key={cat.id}
            href={`/sgc/${cat.id}`}
            className="group rounded-xl border border-slate-300/90 bg-white px-5 py-5 shadow-md shadow-slate-900/[0.06] transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg"
          >
            <p className="text-sm font-extrabold uppercase tracking-wide text-slate-900 group-hover:text-sky-900">
              {cat.label}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Ver archivos por departamento →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
