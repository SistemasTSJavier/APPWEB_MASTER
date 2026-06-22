import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { RegistroMoper } from "./types";

export function MoperRegistroAbiertoBanner({ registro }: { registro: RegistroMoper }) {
  const folio = registro.folio?.trim() || `Registro #${registro.id}`;
  const oficial = registro.oficial_nombre?.trim() || "Sin nombre";
  const movimiento = [
    registro.servicio_actual_nombre?.trim(),
    registro.servicio_nuevo_nombre?.trim(),
  ]
    .filter(Boolean)
    .join(" → ");
  const puesto = [registro.puesto_actual_nombre?.trim(), registro.puesto_nuevo_nombre?.trim()]
    .filter(Boolean)
    .join(" → ");

  const estado = registro.completado
    ? "Completado"
    : registro.firma_conformidad_at
      ? "En firmas internas"
      : "Pendiente firma oficial";

  return (
    <div className="mb-4 rounded-xl border-2 border-sky-400 bg-gradient-to-r from-sky-50 to-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800">MOPER seleccionado — revise antes de firmar</p>
      <p className="mt-1 font-mono text-lg font-bold text-slate-900">{folio}</p>
      <p className="text-base font-semibold uppercase text-slate-900">{oficial}</p>
      {movimiento ? (
        <p className="mt-1 text-sm text-slate-700">
          <span className="font-medium text-slate-600">Servicio:</span> {movimiento}
        </p>
      ) : null}
      {puesto ? (
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-600">Puesto:</span> {puesto}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-900">{estado}</span>
        {registro.created_at ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
            {format(new Date(registro.created_at), "d MMM yyyy", { locale: es })}
          </span>
        ) : null}
        {registro.curp ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono normal-case text-slate-700">
            CURP: {registro.curp}
          </span>
        ) : null}
      </div>
    </div>
  );
}
