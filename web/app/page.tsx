import Link from "next/link";
import Image from "next/image";

function getGreetingByHour(hour: number): string {
  if (hour < 12) return "BUENOS DIAS";
  if (hour < 19) return "BUENAS TARDES";
  return "BUENAS NOCHES";
}

export default function Home() {
  const currentHour = new Date().getHours();
  const greeting = getGreetingByHour(currentHour);
  const metricCards = [
    {
      title: "COLABORADORES",
      value: "0",
      subtitle: "TOTAL DE COLABORADORES ACTIVOS",
    },
    {
      title: "BAJAS POR MES",
      value: "0",
      subtitle: "REGISTROS DEL MES ACTUAL",
    },
    {
      title: "PUESTOS",
      value: "0",
      subtitle: "TOTAL DE PUESTOS REGISTRADOS",
    },
    {
      title: "SERVICIOS",
      value: "0",
      subtitle: "TOTAL DE SERVICIOS REGISTRADOS",
    },
  ];

  const sidebarLink =
    "block rounded-lg px-3 py-2.5 text-lg font-semibold uppercase tracking-tight text-slate-100 transition-colors hover:bg-white/10 hover:text-white";

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen w-full grid-cols-1 gap-4 p-3 md:grid-cols-[280px_minmax(0,1fr)] md:gap-6 md:p-6">
        <aside className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950 p-5 text-white shadow-xl md:min-h-[calc(100vh-48px)]">
          <Image src="/logo.webp" alt="Logo" width={132} height={132} className="mx-auto mb-6 h-auto w-auto" priority />

          <nav className="space-y-2">
            <Link href="/altas" className={sidebarLink}>
              Altas
            </Link>
            <Link href="/bajas" className={sidebarLink}>
              Bajas
            </Link>
            <Link href="/colaboradores" className={sidebarLink}>
              Colaboradores
            </Link>
            <Link href="/moper" className={sidebarLink}>
              Moper
            </Link>
            <Link href="/contabilidad" className={sidebarLink}>
              Contabilidad
            </Link>
          </nav>
        </aside>

        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm md:p-6">
          <div
            className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-[0.06]"
            style={{ backgroundImage: "url('/logo.webp')", backgroundSize: "min(55vw, 620px)" }}
            aria-hidden="true"
          />

          <div className="relative rounded-2xl border border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 px-6 py-16 text-center shadow-lg">
            <h1 className="text-4xl font-extrabold tracking-[0.08em] text-white sm:text-5xl">TACTICAL SUPPORT</h1>
            <p className="mt-2 text-2xl font-semibold uppercase tracking-[0.14em] text-slate-200 sm:text-3xl">MASTER</p>
            <div className="mx-auto mt-8 h-px w-28 bg-slate-500/60" />
            <p className="mt-6 text-xl font-semibold text-white sm:text-2xl">{greeting}</p>
            <p className="mt-4 text-sm font-semibold italic uppercase tracking-[0.2em] text-blue-200 sm:text-base">
              VIVE EL HABITO DE LA EXCELENCIA
            </p>
          </div>

          <div className="relative mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((card) => (
              <article
                key={card.title}
                className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow"
              >
                <p className="text-xs font-semibold tracking-[0.1em] text-slate-500">{card.title}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{card.value}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{card.subtitle}</p>
              </article>
            ))}
          </div>

          <div className="relative mt-4 rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-center">
            <p className="text-sm font-medium uppercase text-slate-500">SELECCIONA UN MODULO DESDE LA BARRA IZQUIERDA.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
