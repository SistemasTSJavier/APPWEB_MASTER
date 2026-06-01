"use client";

import type { GestorMatchTipo, GestorProcesoBucket } from "@/lib/gestores-proceso";
import { matchTipoLabel } from "@/lib/gestores-proceso";

export function GestoresHero() {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-7 shadow-xl sm:px-8 sm:py-9">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-indigo-500/25 blur-3xl"
        aria-hidden
      />
      <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300 sm:text-xs">
        Recursos humanos · Altas y reclutamiento
      </p>
      <h1 className="relative mt-2 text-xl font-extrabold uppercase tracking-wide text-white sm:text-2xl md:text-3xl">
        Gestores del proceso
      </h1>
      <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
        Solo se listan colaboradores con <strong className="text-white">fecha de ingreso en el año en curso</strong>{" "}
        (México). Compare gestores del mes o semana elegidos sin mezclar años anteriores.
      </p>
    </header>
  );
}

export function GuiaRapidaGestores({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <section className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-sky-900">
          <span className="text-lg" aria-hidden>
            💡
          </span>
          ¿Cómo leer este reporte?
        </span>
        <span className="text-xs font-bold text-sky-700">{open ? "Ocultar" : "Mostrar"}</span>
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-sky-100 px-4 pb-4 sm:grid-cols-3 sm:px-5 sm:pb-5">
          <GuiaPaso
            n={1}
            titulo="Elija el periodo"
            texto="Solo se incluyen altas del año en curso. Por mes o por semana (lunes a domingo, hora México) dentro de ese año."
          />
          <GuiaPaso
            n={2}
            titulo="Compare gestores"
            texto="Cada barra es un gestor distinto. El número es cuántos colaboradores ingresaron en el periodo con ese gestor asignado."
          />
          <GuiaPaso
            n={3}
            titulo="Revise el detalle"
            texto="Al elegir un gestor verá la lista de personas. El sistema intenta enlazar el texto con el colaborador de nombre más parecido en expediente (N.º y fecha de ingreso)."
          />
        </div>
      ) : null}
    </section>
  );
}

function GuiaPaso({ n, titulo, texto }: { n: number; titulo: string; texto: string }) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">Paso {n}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{titulo}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{texto}</p>
    </div>
  );
}

export function ConsejoCapturaGestor() {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950">
      <strong>Tip:</strong> puede usar N.º de empleado o nombre; si el nombre no es exacto, el reporte busca la{" "}
      <strong>coincidencia más parecida</strong> en el expediente (apellidos, abreviaturas y pequeñas diferencias de
      escritura).
    </p>
  );
}

const MATCH_TONE: Record<
  GestorMatchTipo,
  { ring: string; bg: string; text: string; icon: string }
> = {
  no_empleado: {
    ring: "ring-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    icon: "✓",
  },
  nombre_exacto: {
    ring: "ring-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    icon: "✓",
  },
  nombre_similar: {
    ring: "ring-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
    icon: "~",
  },
  texto_libre: {
    ring: "ring-slate-200",
    bg: "bg-slate-100",
    text: "text-slate-700",
    icon: "?",
  },
  sin_gestor: {
    ring: "ring-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-800",
    icon: "—",
  },
};

export function MatchBadge({ tipo, compact }: { tipo: GestorMatchTipo; compact?: boolean }) {
  const t = MATCH_TONE[tipo];
  const label = matchTipoLabel(tipo);
  const short =
    tipo === "no_empleado"
      ? "Por N.º empleado"
      : tipo === "nombre_exacto"
        ? "Nombre exacto"
        : tipo === "nombre_similar"
          ? "Nombre más parecido"
          : tipo === "texto_libre"
            ? "Sin vínculo"
            : "Sin gestor";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${t.ring} ${t.bg} ${t.text}`}
      title={label}
    >
      <span aria-hidden>{t.icon}</span>
      {compact ? short : label}
    </span>
  );
}

export function StatCardGestor({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "indigo" | "slate" | "amber" | "rose";
}) {
  const accentBar =
    accent === "indigo"
      ? "bg-indigo-500"
      : accent === "amber"
        ? "bg-amber-500"
        : accent === "rose"
          ? "bg-rose-500"
          : "bg-slate-400";

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className={`absolute left-0 top-0 h-full w-1 ${accentBar}`} aria-hidden />
      <p className="pl-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="pl-2 mt-1 text-2xl font-extrabold tabular-nums text-slate-950">{value}</p>
      {hint ? <p className="pl-2 mt-1 text-[10px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function PeriodoResumenBar({
  periodoLabel,
  totalEnPeriodo,
  gestoresCount,
  sinGestorEnPeriodo,
}: {
  periodoLabel: string;
  totalEnPeriodo: number;
  gestoresCount: number;
  sinGestorEnPeriodo: number;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
      <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Periodo activo
      </span>
      <span className="text-sm font-semibold text-slate-800">{periodoLabel}</span>
      <span className="hidden text-slate-400 sm:inline" aria-hidden>
        ·
      </span>
      <span className="text-xs text-slate-600">
        <strong className="text-slate-900">{totalEnPeriodo}</strong> ingreso(s) ·{" "}
        <strong className="text-slate-900">{gestoresCount}</strong> gestor(es)
        {sinGestorEnPeriodo > 0 ? (
          <>
            {" "}
            · <strong className="text-rose-700">{sinGestorEnPeriodo}</strong> sin gestor
          </>
        ) : null}
      </span>
    </div>
  );
}

export function GestorRankingCard({
  gestor,
  rank,
  maxTotal,
  totalPeriodo,
  active,
  onSelect,
}: {
  gestor: GestorProcesoBucket;
  rank: number;
  maxTotal: number;
  totalPeriodo: number;
  active: boolean;
  onSelect: () => void;
}) {
  const pctBar = Math.round((gestor.total / maxTotal) * 100);
  const pctDelTotal =
    totalPeriodo > 0 ? Math.round((gestor.total / totalPeriodo) * 100) : 0;
  const esSinGestor = gestor.matchTipo === "sin_gestor";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
        active
          ? "border-indigo-400 bg-indigo-50 shadow-md ring-2 ring-indigo-200/80"
          : esSinGestor
            ? "border-rose-200 bg-rose-50/50 hover:border-rose-300 hover:bg-rose-50"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold tabular-nums ${
            active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold text-slate-900">{gestor.gestorLabel}</span>
            <MatchBadge tipo={gestor.matchTipo} compact />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${
                  esSinGestor
                    ? "bg-rose-400"
                    : "bg-gradient-to-r from-indigo-600 to-violet-500"
                }`}
                style={{ width: `${pctBar}%` }}
              />
            </div>
            <span className="shrink-0 rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-extrabold tabular-nums text-white">
              {gestor.total}
            </span>
          </div>
          <p className="mt-1 text-[10px] font-medium text-slate-500">
            {pctDelTotal}% de las altas del periodo
            {gestor.gestorColaborador ? ` · N.º ${gestor.gestorColaborador.noEmpleado}` : ""}
          </p>
        </div>
      </div>
    </button>
  );
}

export function GestorDetallePanel({
  gestor,
  onCerrar,
}: {
  gestor: GestorProcesoBucket;
  onCerrar?: () => void;
}) {
  const vinculado = gestor.gestorColaborador != null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Detalle del gestor
            </p>
            <h2 className="mt-0.5 truncate text-base font-extrabold text-slate-900">
              {gestor.gestorLabel}
            </h2>
          </div>
          {onCerrar ? (
            <button
              type="button"
              onClick={onCerrar}
              className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              Cerrar
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MatchBadge tipo={gestor.matchTipo} />
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
            {gestor.total} colaborador{gestor.total === 1 ? "" : "es"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Texto capturado en altas:{" "}
          <span className="font-semibold text-slate-800">«{gestor.gestorTextoEjemplo}»</span>
        </p>
      </div>

      {vinculado && gestor.gestorColaborador ? (
        <div className="border-b border-emerald-100 bg-emerald-50/80 px-4 py-3 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            Ficha del gestor en expediente
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-bold uppercase text-emerald-700/80">N.º empleado</dt>
              <dd className="font-mono font-bold text-slate-900">{gestor.gestorColaborador.noEmpleado}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-[10px] font-bold uppercase text-emerald-700/80">Nombre completo</dt>
              <dd className="font-semibold text-slate-900">{gestor.gestorColaborador.nombreCompleto}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase text-emerald-700/80">Fecha de ingreso</dt>
              <dd className="font-semibold text-slate-900">{gestor.gestorColaborador.fechaIngreso}</dd>
            </div>
          </dl>
        </div>
      ) : gestor.matchTipo !== "sin_gestor" ? (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950 sm:px-5">
          <strong>No hay coincidencia en expediente.</strong> El sistema no encontró un colaborador con
          ese texto. Corrija el campo en futuras altas usando N.º de empleado o nombre completo del gestor.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <p className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600 backdrop-blur sm:px-5">
          Colaboradores que ingresaron en el periodo ({gestor.colaboradores.length})
        </p>
        {gestor.colaboradores.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Sin registros en este periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-2.5">N.º</th>
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Ingreso</th>
                  <th className="px-4 py-2.5">Servicio</th>
                  <th className="px-4 py-2.5">Planta</th>
                </tr>
              </thead>
              <tbody>
                {gestor.colaboradores.map((c, i) => (
                  <tr
                    key={`${c.noEmpleado}-${i}`}
                    className="border-b border-slate-100 even:bg-slate-50/40 hover:bg-indigo-50/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-800">
                      {c.noEmpleado}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{c.nombreCompleto}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{c.fechaIngreso}</td>
                    <td className="max-w-[140px] truncate px-4 py-2.5 text-xs text-slate-600" title={c.servicio}>
                      {c.servicio}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-2.5 text-xs text-slate-600" title={c.planta}>
                      {c.planta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyDetalleGestor() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      <span className="text-3xl opacity-60" aria-hidden>
        👆
      </span>
      <p className="mt-3 text-sm font-bold text-slate-800">Seleccione un gestor</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
        Haga clic en una fila del ranking de la izquierda para ver quiénes ingresaron con ese gestor del
        proceso.
      </p>
    </div>
  );
}

export function SkeletonGestores() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-200/80" />
      ))}
    </div>
  );
}
