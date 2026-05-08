import Link from "next/link";

export type ServicioOption = { id: string; nombre: string };

export function ServicioFilterForm({
  actionPath,
  servicios,
  value,
  variant = "default",
}: {
  actionPath: string;
  servicios: ServicioOption[];
  value: string | null;
  /** `centered`: sin borde inferior, controles alineados al centro (p. ej. Contabilidad). */
  variant?: "default" | "centered";
}) {
  const hasFilter = Boolean(value);
  const wrap =
    variant === "centered"
      ? "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center"
      : "mb-8 flex flex-col gap-3 border-b border-slate-200/90 pb-6 sm:flex-row sm:flex-wrap sm:items-end";

  return (
    <div className={wrap}>
      <form
        method="get"
        action={actionPath}
        className={
          variant === "centered"
            ? "flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center"
            : "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        }
      >
        <label className="flex min-w-[240px] flex-col gap-1.5 text-sm">
          <span className="form-label">Desglosar por servicio</span>
          <select name="servicio" defaultValue={value ?? ""} className="form-control">
            <option value="">Todos los servicios</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary w-fit">
          Aplicar filtro
        </button>
      </form>
      {hasFilter ? (
        <Link href={actionPath} className="btn-secondary w-fit text-sm no-underline sm:ml-0">
          Quitar filtro
        </Link>
      ) : null}
    </div>
  );
}
