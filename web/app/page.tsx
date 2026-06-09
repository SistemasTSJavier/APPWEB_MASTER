import { redirect } from "next/navigation";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { AppModuleShell } from "@/components/app-module-shell";
import { HomeLocalGreeting } from "@/components/home-local-greeting";
import { HomeCelebracionesSection } from "@/components/home-celebraciones-section";
import { esRolLegalSoloLectura } from "@/lib/app-role";

export const dynamic = "force-dynamic";

function etiquetaMesActualMx(): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      month: "long",
      year: "numeric",
    })
      .format(new Date())
      .toUpperCase();
  } catch {
    return "MES ACTUAL";
  }
}

export default async function Home() {
  const auth = await getAuthedUserWithRole();
  if (!auth) redirect("/login");

  const stats = await getDashboardStats();
  const mesEtiqueta = etiquetaMesActualMx();

  const fmt = (n: number) => n.toLocaleString("es-MX");

  const metricCards = stats
    ? [
        {
          title: "COLABORADORES",
          value: fmt(stats.totalColaboradores),
          subtitle: "EXPEDIENTES REGISTRADOS EN EL SISTEMA",
        },
        {
          title: "ACTIVOS",
          value: fmt(stats.activosTotal),
          subtitle: "SIN BAJA VIGENTE NI ESTATUS INACTIVO (IGUAL QUE «SOLO ACTIVOS» EN COLABORADORES)",
        },
        {
          title: "ALTAS POR MES",
          value: fmt(stats.altasEsteMes),
          subtitle: `INGRESOS CON FECHA EN ${mesEtiqueta} (CAMPO FECHA DE INGRESO)`,
        },
        {
          title: "BAJAS POR MES",
          value: fmt(stats.bajasEsteMes),
          subtitle: `BAJAS CON ULTIMO DIA LABORADO EN ${mesEtiqueta} (EXPEDIENTE CON FECHA DE BAJA)`,
        },
        {
          title: "MOPER POR MES",
          value: fmt(stats.moperEsteMes),
          subtitle: `MOVIMIENTOS CON FECHA EN ${mesEtiqueta} (ZONA CIUDAD DE MEXICO)`,
        },
        {
          title: "PUESTOS",
          value: fmt(stats.puestosUnicos),
          subtitle: "PUESTOS DISTINTOS (LINEA ACTUAL / EXPEDIENTE)",
        },
      ]
    : [];

  const email = auth.user.email ?? "—";

  return (
    <AppModuleShell role={auth.role} email={email} currentPath="/">
      <section className="relative min-w-0 overflow-x-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4 md:p-5 lg:p-6">
        <div
          className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-[0.06]"
          style={{ backgroundImage: "url('/logo.webp')", backgroundSize: "min(85vw, 520px)" }}
          aria-hidden="true"
        />

        <div className="relative rounded-2xl border border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-center shadow-lg sm:px-6 sm:py-12 md:px-8 md:py-14 lg:py-16">
          <h1 className="text-[clamp(1.25rem,5vw,2.5rem)] font-extrabold leading-tight tracking-[0.06em] text-white sm:tracking-[0.08em]">
            TACTICAL SUPPORT
          </h1>
          <p className="mt-1 text-[clamp(1rem,4vw,1.75rem)] font-semibold uppercase tracking-[0.1em] text-slate-200 sm:tracking-[0.14em]">
            INTRANET
          </p>
          <div className="mx-auto mt-5 h-px w-20 bg-slate-500/60 sm:mt-7 sm:w-28 md:mt-8" />
          <p className="mt-4 text-[clamp(1rem,4vw,1.375rem)] font-semibold leading-snug text-white sm:mt-6 md:text-2xl">
            <HomeLocalGreeting />
          </p>
          <p className="mx-auto mt-3 max-w-lg px-2 text-xs font-bold italic uppercase leading-relaxed tracking-wide text-sky-100 sm:mt-4 sm:text-sm md:text-lg md:tracking-[0.14em]">
            VIVE EL HABITO DE LA EXCELENCIA
          </p>
        </div>

        <div className="relative mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:mt-6 xl:grid-cols-3">
          {metricCards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-slate-300/90 bg-white px-5 py-4 shadow-md shadow-slate-900/[0.06] transition-transform hover:-translate-y-0.5 hover:shadow-lg sm:px-6 sm:py-5"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-800 sm:text-sm">{card.title}</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 tabular-nums sm:mt-3 sm:text-4xl">{card.value}</p>
              <p className="mt-3 text-xs font-semibold uppercase leading-snug text-slate-700 sm:text-[13px]">{card.subtitle}</p>
            </article>
          ))}
        </div>

        <HomeCelebracionesSection
          cumpleaneros={stats?.cumpleanosEsteMes ?? []}
          aniversarios={stats?.aniversariosEmpresaSemana ?? []}
          mesEtiqueta={mesEtiqueta}
        />

        <div className="relative mt-4 rounded-xl border border-dashed border-slate-400 bg-white px-4 py-5 text-center shadow-sm sm:px-5 sm:py-6">
          <p className="text-sm font-bold uppercase leading-relaxed text-slate-800 sm:text-base">
            {auth.role === "nominas" ? (
              <>
                <span className="hidden sm:inline">
                  USA <strong>COLABORADORES</strong> Y <strong>MOPER</strong> EN SOLO CONSULTA (COPIA DATOS EN COLABORADORES SI LO NECESITAS).
                </span>
                <span className="sm:hidden">COLABORADORES Y MOPER: SOLO VER.</span>
              </>
            ) : auth.role === "mejora_continua" ? (
              <>
                <span className="hidden sm:inline">USA MOPER Y BAJAS EN SOLO CONSULTA; EN COLABORADORES PUEDES EXPORTAR CSV CON FILTROS Y SELECCION.</span>
                <span className="sm:hidden">COLABORADORES: EXPORT CSV. MOPER Y BAJAS: SOLO VER.</span>
              </>
            ) : auth.role === "aux_rh" ? (
              <>
                <span className="hidden sm:inline">TIENES TODOS LOS MODULOS EXCEPTO MOPER; PUEDES REGISTRAR Y EDITAR EN ALTAS, BAJAS, COLABORADORES, ETC.</span>
                <span className="sm:hidden">SIN MOPER: REGISTRAR Y EDITAR EN EL RESTO.</span>
              </>
            ) : auth.role === "gerente_rh" ? (
              <>
                <span className="hidden sm:inline">
                  BAJAS Y COLABORADORES EN CONSULTA; EN <strong>MOPER</strong> REGISTRAS Y EDITAS MOVIMIENTOS. NO TIENES ALTAS, SERVICIOS, EXPEDIENTES LEGAL NI
                  FICHA TECNICA.
                </span>
                <span className="sm:hidden">BAJAS/COLABORADORES CONSULTA · MOPER EDICION.</span>
              </>
            ) : auth.role === "relaciones_laborales" ? (
              <>
                <span className="hidden sm:inline">
                  ACCESO EXCLUSIVO A <strong>MOPER</strong>: REGISTRA, EDITA Y GUARDA MOVIMIENTOS. LOS DEMAS MODULOS NO ESTAN DISPONIBLES PARA TU ROL.
                </span>
                <span className="sm:hidden">SOLO MOPER: REGISTRAR Y EDITAR.</span>
              </>
            ) : auth.role === "gerente_legal" ? (
              <>
                <span className="hidden sm:inline">
                  USA LA BARRA IZQUIERDA: COLABORADORES, EXPEDIENTES LEGAL Y <strong>ALERTAS CONTRATO</strong>.
                </span>
                <span className="sm:hidden">COLABORADORES · EXPEDIENTES · ALERTAS CONTRATO.</span>
              </>
            ) : esRolLegalSoloLectura(auth.role) ? (
              <>
                <span className="hidden sm:inline">USA LA BARRA IZQUIERDA: COLABORADORES Y EXPEDIENTES LEGAL (SOLO CONSULTA).</span>
                <span className="sm:hidden">USA EL MENU DE MODULOS ARRIBA.</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">SELECCIONA UN MODULO DESDE LA BARRA IZQUIERDA.</span>
                <span className="sm:hidden">DESLIZA LOS MODULOS ARRIBA O USA EL MENU.</span>
              </>
            )}
          </p>
          {stats?.fuente === "sin_datos" ? (
            <p className="mt-3 text-xs font-bold uppercase leading-relaxed text-amber-900 sm:text-sm">
              METRICAS EN CERO: CONFIGURA SUPABASE SERVICE ROLE EN EL SERVIDOR PARA DATOS EN VIVO (COMO EN COLABORADORES).
            </p>
          ) : null}
        </div>
      </section>
    </AppModuleShell>
  );
  
}
