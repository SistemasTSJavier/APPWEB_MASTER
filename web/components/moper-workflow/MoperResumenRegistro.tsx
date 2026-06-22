import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { RegistroMoper } from "./types";

function fmtFecha(val: string | null | undefined): string {
  if (!val?.trim()) return "—";
  const s = val.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    try {
      return format(new Date(`${s}T12:00:00`), "d 'de' MMMM yyyy", { locale: es });
    } catch {
      return s;
    }
  }
  try {
    return format(new Date(val), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return val;
  }
}

function fmtSueldo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$ ${Number(n).toLocaleString("es-MX")}`;
}

export function MoperResumenRegistro({
  registro,
  compact = false,
}: {
  registro: RegistroMoper;
  compact?: boolean;
}) {
  return (
    <div className={`space-y-4 ${compact ? "text-sm" : ""}`}>
      <section className="rounded-lg border border-oxford-200 bg-oxford-50/50 p-3 sm:p-4">
        <h3 className="mb-3 border-b border-oxford-200 pb-2 text-sm font-bold uppercase text-oxford-800">
          A. Datos generales
        </h3>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-oxford-600">Nombre del oficial</dt>
            <dd className="font-semibold text-black">{registro.oficial_nombre || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-oxford-600">CURP</dt>
            <dd className="text-black">{registro.curp || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-oxford-600">Fecha de ingreso</dt>
            <dd className="text-black">{fmtFecha(registro.fecha_ingreso)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-oxford-600">Fecha inicio efectiva</dt>
            <dd className="text-black">{fmtFecha(registro.fecha_inicio_efectiva)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-oxford-600">Creado por</dt>
            <dd className="text-black">{registro.creado_por || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-oxford-600">Solicitado por</dt>
            <dd className="text-black">{registro.solicitado_por || "—"}</dd>
          </div>
          {registro.created_at ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-oxford-600">Fecha de llenado</dt>
              <dd className="text-black">
                {format(new Date(registro.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-lg border border-oxford-200 bg-white p-3 sm:p-4">
        <h3 className="mb-3 border-b border-oxford-200 pb-2 text-sm font-bold uppercase text-oxford-800">
          B. Comparativa de movimiento
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-oxford-300 bg-oxford-100">
                <th className="border border-oxford-200 px-2 py-1.5 text-left font-bold">Campo</th>
                <th className="border border-oxford-200 px-2 py-1.5 text-left font-bold">Actual</th>
                <th className="border border-oxford-200 px-2 py-1.5 text-left font-bold">Nuevo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-oxford-200 px-2 py-1.5 font-medium">Servicio</td>
                <td className="border border-oxford-200 bg-oxford-50 px-2 py-1.5">
                  {registro.servicio_actual_nombre || "—"}
                </td>
                <td className="border border-oxford-200 px-2 py-1.5 font-medium text-black">
                  {registro.servicio_nuevo_nombre || "—"}
                </td>
              </tr>
              <tr>
                <td className="border border-oxford-200 px-2 py-1.5 font-medium">Puesto</td>
                <td className="border border-oxford-200 bg-oxford-50 px-2 py-1.5">
                  {registro.puesto_actual_nombre || "—"}
                </td>
                <td className="border border-oxford-200 px-2 py-1.5 font-medium text-black">
                  {registro.puesto_nuevo_nombre || "—"}
                </td>
              </tr>
              <tr>
                <td className="border border-oxford-200 px-2 py-1.5 font-medium">Sueldo mensual</td>
                <td className="border border-oxford-200 bg-oxford-50 px-2 py-1.5">
                  {fmtSueldo(registro.sueldo_actual)}
                </td>
                <td className="border border-oxford-200 px-2 py-1.5 font-medium text-black">
                  {fmtSueldo(registro.sueldo_nuevo)}
                </td>
              </tr>
              <tr>
                <td className="border border-oxford-200 px-2 py-1.5 font-medium">Motivo</td>
                <td className="border border-oxford-200 bg-oxford-50 px-2 py-1.5">—</td>
                <td className="border border-oxford-200 px-2 py-1.5">{registro.motivo || "—"}</td>
              </tr>
              <tr>
                <td className="border border-oxford-200 px-2 py-1.5 align-top font-medium">Razón</td>
                <td className="border border-oxford-200 bg-oxford-50 px-2 py-1.5 align-top">—</td>
                <td className="border border-oxford-200 px-2 py-1.5 whitespace-pre-wrap align-top">
                  {registro.razon || "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
