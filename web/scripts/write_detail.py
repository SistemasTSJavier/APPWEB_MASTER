from pathlib import Path

def d(v):
    if v is None:
        return ""
    return v.isoformat()[:10] if hasattr(v, "isoformat") else str(v)[:10]

content = '''
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  updateMaster,
  upsertIdentidad,
  upsertSalud,
  upsertNomina,
  addFamiliar,
  deleteFamiliar,
  addHistorialMoper,
} from "../actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EmpleadoDetailPage(props: PageProps) {
  const { id } = await props.params;
  const e = await prisma.empleado.findUnique({
    where: { id },
    include: {
      master: true,
      identidad: true,
      salud: true,
      nomina: true,
      familiares: { orderBy: { nombre: "asc" } },
      historialMoper: { orderBy: { fechaMovimiento: "desc" } },
    },
  });
  if (!e || !e.master) notFound();

  const m = e.master;
  const i = e.identidad;
  const s = e.salud;
  const n = e.nomina;

  function df(v: Date | null | undefined) {
    if (!v) return "";
    return new Date(v).toISOString().slice(0, 10);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">No. {e.noEmpleado}</p>
          <h1 className="text-2xl font-semibold">{m.nombreCompleto}</h1>
        </div>
        <Link href="/empleados" className="text-sm text-blue-400 underline">
          Volver al listado
        </Link>
      </div>

      <section className="mb-10 rounded-lg border border-neutral-800 p-4">
        <h2 className="mb-4 text-lg font-medium">DB Master</h2>
        <form action={updateMaster.bind(null, e.id)} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Nombre completo</span>
            <input name="nombreCompleto" defaultValue={m.nombreCompleto} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Estatus</span>
            <select name="estatusEmpleado" defaultValue={m.estatusEmpleado} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2">
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Local / foráneo</span>
            <select name="localForaneo" defaultValue={m.localForaneo ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2">
              <option value="">—</option>
              <option value="LOCAL">LOCAL</option>
              <option value="FORANEO">FORANEO</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Fecha ingreso</span>
            <input name="fechaIngreso" type="date" defaultValue={df(m.fechaIngreso)} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Fecha baja</span>
            <input name="fechaBaja" type="date" defaultValue={df(m.fechaBaja)} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Envío</span>
            <input name="envio" defaultValue={m.envio ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Reyna</span>
            <input name="reyna" defaultValue={m.reyna ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Reingreso</span>
            <input name="reingreso" type="date" defaultValue={df(m.reingreso)} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Puesto</span>
            <input name="puesto" defaultValue={m.puesto ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Puesto final</span>
            <input name="puestoFinal" defaultValue={m.puestoFinal ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Servicio</span>
            <input name="servicio" defaultValue={m.servicio ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Servicio final</span>
            <input name="servicioFinal" defaultValue={m.servicioFinal ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Posición</span>
            <input name="posicion" defaultValue={m.posicion ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Número de folio</span>
            <input name="numeroFolio" defaultValue={m.numeroFolio ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded bg-white px-3 py-2 text-sm font-medium text-black">
              Guardar master
            </button>
          </div>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-neutral-800 p-4">
        <h2 className="mb-4 text-lg font-medium">Identidad</h2>
        <form action={upsertIdentidad.bind(null, e.id)} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Apellido paterno</span>
            <input name="apellidoPaterno" defaultValue={i?.apellidoPaterno ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Apellido materno</span>
            <input name="apellidoMaterno" defaultValue={i?.apellidoMaterno ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Nombre(s)</span>
            <input name="nombres" defaultValue={i?.nombres ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Fecha nacimiento</span>
            <input name="fechaNacimiento" type="date" defaultValue={df(i?.fechaNacimiento)} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Edad</span>
            <input name="edad" type="number" defaultValue={i?.edad ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>CURP</span>
            <input name="curp" defaultValue={i?.curp ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>RFC</span>
            <input name="rfc" defaultValue={i?.rfc ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>IMSS</span>
            <input name="imss" defaultValue={i?.imss ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Código postal</span>
            <input name="codigoPostal" defaultValue={i?.codigoPostal ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Estado natal</span>
            <input name="estadoNatal" defaultValue={i?.estadoNatal ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Estado / municipio / colonia / calle y número</span>
            <textarea name="domicilio" rows={2} defaultValue={i?.domicilio ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Teléfono</span>
            <input name="telefono" defaultValue={i?.telefono ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Escolaridad</span>
            <input name="escolaridad" defaultValue={i?.escolaridad ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded bg-white px-3 py-2 text-sm font-medium text-black">
              Guardar identidad
            </button>
          </div>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-neutral-800 p-4">
        <h2 className="mb-4 text-lg font-medium">Salud</h2>
        <form action={upsertSalud.bind(null, e.id)} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Estatura / peso</span>
            <input name="estaturaPeso" defaultValue={s?.estaturaPeso ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Tipo de sangre</span>
            <input name="tipoSangre" defaultValue={s?.tipoSangre ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Alérgico a</span>
            <textarea name="alergicoA" rows={2} defaultValue={s?.alergicoA ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Enfermedad / tratamiento</span>
            <textarea name="enfermedadTratamiento" rows={2} defaultValue={s?.enfermedadTratamiento ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Diabético</span>
            <select name="diabetico" defaultValue={s?.diabetico ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2">
              <option value="">—</option>
              <option value="SI">SÍ</option>
              <option value="NO">NO</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Hipertenso</span>
            <select name="hipertenso" defaultValue={s?.hipertenso ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2">
              <option value="">—</option>
              <option value="SI">SÍ</option>
              <option value="NO">NO</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Emergencia: llamar a</span>
            <input name="emergenciaNombre" defaultValue={s?.emergenciaNombre ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Teléfono emergencia</span>
            <input name="emergenciaTelefono" defaultValue={s?.emergenciaTelefono ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded bg-white px-3 py-2 text-sm font-medium text-black">
              Guardar salud
            </button>
          </div>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-neutral-800 p-4">
        <h2 className="mb-4 text-lg font-medium">Nómina y reclutamiento</h2>
        <form action={upsertNomina.bind(null, e.id)} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Banco</span>
            <input name="banco" defaultValue={n?.banco ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>No. cuenta</span>
            <input name="numeroCuenta" defaultValue={n?.numeroCuenta ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>CLABE interbancaria</span>
            <input name="clabeInterbancaria" defaultValue={n?.clabeInterbancaria ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Sueldo mensual</span>
            <input name="sueldoMensual" type="number" step="0.01" defaultValue={n?.sueldoMensual != null ? String(n.sueldoMensual) : ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Fuente reclutamiento</span>
            <input name="fuenteReclutamiento" defaultValue={n?.fuenteReclutamiento ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Gestor del proceso</span>
            <input name="gestorProceso" defaultValue={n?.gestorProceso ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Estudio socioeconómico</span>
            <input name="estudioSocioeconomico" defaultValue={n?.estudioSocioeconomico ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Documentación original</span>
            <input name="documentacionOriginal" defaultValue={n?.documentacionOriginal ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded bg-white px-3 py-2 text-sm font-medium text-black">
              Guardar nómina
            </button>
          </div>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-neutral-800 p-4">
        <h2 className="mb-4 text-lg font-medium">Familiares</h2>
        <ul className="mb-4 space-y-2 text-sm">
          {e.familiares.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-800 px-3 py-2">
              <span>
                {f.nombre}
                {f.parentesco ? ` — ${f.parentesco}` : ""}
                {f.beneficiarioBancario ? " (benef. bancario)" : ""}
              </span>
              <form action={deleteFamiliar.bind(null, f.id, e.id)}>
                <button type="submit" className="text-red-400 hover:underline">
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addFamiliar.bind(null, e.id)} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Nombre del familiar</span>
            <input name="nombreFamiliar" className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Parentesco</span>
            <input name="parentesco" className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Fecha nacimiento</span>
            <input name="fechaNacimientoFamiliar" type="date" className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="beneficiarioBancario" className="rounded border-neutral-600" />
            Beneficiario bancario
          </label>
          <button type="submit" className="rounded bg-white px-3 py-2 text-sm font-medium text-black md:col-span-2">
            Agregar familiar
          </button>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-neutral-800 p-4">
        <h2 className="mb-4 text-lg font-medium">Historial MOPER</h2>
        <div className="mb-4 overflow-x-auto rounded border border-neutral-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-900/80 text-neutral-300">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Origen</th>
                <th className="px-3 py-2">Destino</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Folio</th>
              </tr>
            </thead>
            <tbody>
              {e.historialMoper.map((h) => (
                <tr key={h.id} className="border-t border-neutral-800">
                  <td className="px-3 py-2">{df(h.fechaMovimiento)}</td>
                  <td className="px-3 py-2">{h.servicioOrigen ?? "—"}</td>
                  <td className="px-3 py-2">{h.servicioDestino}</td>
                  <td className="px-3 py-2">{h.motivo ?? "—"}</td>
                  <td className="px-3 py-2">{h.folioReferencia ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {e.historialMoper.length === 0 ? <p className="p-3 text-neutral-500">Sin movimientos registrados.</p> : null}
        </div>
        <form action={addHistorialMoper.bind(null, e.id)} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Fecha movimiento</span>
            <input name="fechaMovimiento" type="date" className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Servicio origen</span>
            <input name="servicioOrigen" defaultValue={m.servicio ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Servicio destino *</span>
            <input name="servicioDestino" className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" required />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Motivo</span>
            <textarea name="motivoMoper" rows={2} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Folio referencia</span>
            <input name="folioReferencia" className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded bg-white px-3 py-2 text-sm font-medium text-black">
              Registrar movimiento
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
'''

Path("app/empleados/[id]/page.tsx").write_text(content.lstrip("\n"), encoding="utf-8")
print("detail page ok")
