"use client";

import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { FICHA_FOTO_FORM_KEY } from "@/lib/ficha-tecnica-keys";
import {
  displayOrDash,
  servicioAsignadoLinea,
  splitEstaturaPeso,
  sueldoFormateado,
  txt,
} from "@/lib/ficha-tecnica-model";
import { textoEdadDesdeExpediente } from "@/lib/edad-desde-nacimiento";

const LOGO_FICHA_SRC = "/logo_ficha_tecnica.png";

function Celda({
  label,
  value,
  fullWidth,
  className = "",
  bare = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
  className?: string;
  /** Sin borde propio (rejilla con divisores del contenedor) */
  bare?: boolean;
}) {
  const frame = bare
    ? "border-0 bg-white"
    : "border border-blue-900/25 bg-white print:border-blue-900/35";
  return (
    <div
      className={`ficha-print-celda flex h-full min-h-0 flex-col px-2 py-1.5 print:px-1.5 print:py-1 ${frame} ${fullWidth ? "md:col-span-2" : ""} ${className}`}
    >
      <p className="ficha-print-celda-label text-[9px] font-semibold uppercase leading-tight tracking-wide text-blue-900/75 print:text-[6.5px] print:leading-none">
        {label}
      </p>
      <p className="ficha-print-celda-val mt-1 min-h-[1.25rem] flex-1 break-words font-mono text-[11px] font-bold uppercase leading-snug text-blue-950 print:mt-0.5 print:min-h-0 print:text-[7.5px] print:leading-tight">
        {value?.trim() ? value.trim().toUpperCase() : "—"}
      </p>
    </div>
  );
}

function BarraSeccion({ titulo }: { titulo: string }) {
  return (
    <div className="ficha-print-barra col-span-2 border border-blue-950 bg-blue-950 px-2 py-1.5 text-center print:border-blue-950 print:bg-blue-950 print:px-1.5 print:py-0.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-white print:text-[7px] print:tracking-normal print:text-white">
        {titulo}
      </p>
    </div>
  );
}

type Props = {
  colaborador: ColaboradorCompleto;
  ocultarNomina: boolean;
};

export function FichaTecnicaVista({ colaborador: c, ocultarNomina }: Props) {
  const f = c.form ?? {};
  const fotoUrl = String(f[FICHA_FOTO_FORM_KEY] ?? "").trim();
  const { estatura, peso } = splitEstaturaPeso(txt(f.estaturaPeso));

  const lugarNac = displayOrDash(txt(f.lugarNacimiento) || txt(f.estadoNatal));
  const estadoCivil = displayOrDash(txt(f.estadoCivil));
  const idiomas = displayOrDash(txt(f.idiomas));
  const telCel = displayOrDash(txt(f.telefonoCelular) || txt(f.telefonoPersonalCasa));
  const telCasa = displayOrDash(txt(f.telefonoPersonalCasa));

  return (
    <div className="ficha-print-root mx-auto max-w-4xl border-2 border-blue-950 bg-white p-4 shadow-sm print:box-border print:max-w-none print:border print:border-blue-950 print:p-2 print:shadow-none">
      {/* Encabezado: logo + metadatos */}
      <div className="ficha-print-doc-head mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-blue-950 pb-3 print:mb-2 print:gap-2 print:pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-4 print:gap-2">
          <div className="relative h-12 w-44 shrink-0 sm:h-14 sm:w-52 print:h-10 print:w-40">
            <img
              src={LOGO_FICHA_SRC}
              alt="Tactical Support"
              className="h-full w-full object-contain object-left"
            />
          </div>
          <p className="max-w-[14rem] text-[10px] font-medium leading-snug text-blue-900/80 sm:max-w-xs print:max-w-[9rem] print:text-[6.5px] print:leading-tight">
            Ficha de empleado · Referencia expediente Altas
          </p>
        </div>
        <div className="shrink-0 text-right text-[10px] leading-relaxed text-blue-900/90 print:text-[6.5px] print:leading-tight">
          <p>
            <span className="font-semibold text-blue-950">Código:</span> F-RH-10
          </p>
          <p>
            <span className="font-semibold text-blue-950">Formato:</span> Ficha técnica
          </p>
        </div>
      </div>

      {/* Fila delgada: fecha (izq.) · título (centro) · expediente (der.) · foto centrada debajo +25% */}
      <div className="ficha-print-title-band mb-4 overflow-hidden rounded border border-blue-950 bg-white print:mb-2 print:rounded-sm print:border-blue-950">
        <div className="divide-y divide-blue-200 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:divide-x sm:divide-y-0 sm:divide-blue-200">
          <div className="bg-white px-2 py-1 text-left sm:py-1.5 sm:pl-3 print:px-1.5 print:py-0.5">
            <p className="text-[8px] font-semibold uppercase leading-none tracking-wide text-blue-900/75 print:text-[6px]">
              Fecha de ingreso
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] font-bold uppercase leading-tight text-blue-950 print:text-[7px]">
              {displayOrDash(txt(f.fechaIngreso) || txt(c.fechaIngreso))}
            </p>
          </div>
          <div className="flex items-center justify-center bg-blue-950 px-4 py-1 sm:min-w-[9.5rem] sm:px-5 sm:py-1.5 print:min-w-0 print:px-2 print:py-0.5">
            <p className="whitespace-nowrap text-center text-xs font-extrabold uppercase tracking-[0.1em] text-white sm:text-sm print:text-[7px] print:tracking-[0.04em]">
              Ficha técnica
            </p>
          </div>
          <div className="bg-white px-2 py-1 text-right sm:py-1.5 sm:pr-3 print:px-1.5 print:py-0.5">
            <p className="text-[8px] font-semibold uppercase leading-none tracking-wide text-blue-900/75 print:text-[6px]">
              Número de expediente
            </p>
            <p className="mt-0.5 break-all font-mono text-[11px] font-bold uppercase leading-tight text-blue-950 print:text-[7px]">
              {displayOrDash(txt(f.numeroFolio))}
            </p>
          </div>
        </div>
        <div className="flex justify-center border-t border-blue-200 bg-white py-2.5 sm:py-3 print:py-1.5">
          <div className="ficha-print-photo flex aspect-[3/4] w-[8.5rem] shrink-0 items-center justify-center overflow-hidden rounded border-2 border-blue-950 bg-white shadow-sm print:w-[6.6rem] print:border-blue-950">
            {fotoUrl ? (
              <img src={fotoUrl} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <span className="px-2 text-center text-[9px] font-semibold uppercase leading-tight text-blue-900/60 print:text-[6px]">
                Fotografía
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="ficha-print-grid grid grid-cols-2 gap-0 border border-blue-950 print:border-blue-950">
        <BarraSeccion titulo="Datos personales" />
        <Celda label="APELLIDO PATERNO" value={displayOrDash(txt(f.apellidoPaterno))} />
        <Celda label="APELLIDO MATERNO" value={displayOrDash(txt(f.apellidoMaterno))} />
        <Celda label="NOMBRE(S)" value={displayOrDash(txt(f.nombres) || txt(c.nombreCompleto))} />
        <Celda
          label="EDAD"
          value={textoEdadDesdeExpediente(String(f.fechaNacimiento ?? ""), String(f.edad ?? ""))}
        />
        <Celda label="ESTATURA" value={displayOrDash(estatura)} />
        <Celda label="PESO" value={displayOrDash(peso)} />
        <Celda label="ESTADO CIVIL" value={estadoCivil} />
        <Celda label="LUGAR DE NACIMIENTO" value={lugarNac} />
        <Celda label="FECHA DE NACIMIENTO" value={displayOrDash(txt(f.fechaNacimiento))} />

        <BarraSeccion titulo="Domicilio" />
        <Celda label="DOMICILIO COMPLETO" value={displayOrDash(txt(f.direccionCompleta))} fullWidth />

        <BarraSeccion titulo="Informacion de documentos" />
        <Celda label="NO. IMSS" value={displayOrDash(txt(f.imss) || c.nss)} />
        <Celda label="CURP" value={displayOrDash(txt(f.curp))} />
        <Celda label="RFC" value={displayOrDash(txt(f.rfc))} />
        <Celda label="NO. INE / IFE" value={displayOrDash(txt(f.noIfe) || txt(f.claveElectoral))} />
        <Celda label="LICENCIA DE CONDUCIR" value={displayOrDash(txt(f.licenciaConducir))} />
        {!ocultarNomina ? (
          <>
            <Celda label="BANCO" value={displayOrDash(txt(f.banco))} />
            <Celda
              label="NO. CUENTA / CLABE (referencia)"
              value={displayOrDash([txt(f.numeroCuenta), txt(f.clabeInterbancaria)].filter(Boolean).join(" / "))}
            />
          </>
        ) : (
          <>
            <Celda label="BANCO" value="—" />
            <Celda label="CUENTA / CLABE" value="—" />
          </>
        )}
        <Celda label="CARTA NO ANTECEDENTES" value={displayOrDash(txt(f.cartaNoAntecedentes))} />
        <Celda label="CREDITO INFONAVIT" value={displayOrDash(txt(f.creditoInfonavit))} />

        <BarraSeccion titulo="Telefonos de contacto" />
        <Celda label="CELULAR PERSONAL" value={telCel} />
        <Celda label="CASA / RECADOS" value={telCasa} />
        <Celda label="EN CASO DE EMERGENCIAS (NOMBRE)" value={displayOrDash(txt(f.emergenciaLlamarA))} />
        <Celda label="TELEFONO EMERGENCIA" value={displayOrDash(txt(f.telefonoEmergencia))} />

        <BarraSeccion titulo="Datos familiares" />
        <div className="ficha-print-fam col-span-2 overflow-x-auto print:max-h-[4.75rem] print:overflow-hidden">
          <table className="w-full border-collapse bg-white text-[10px] text-blue-950 print:text-[6px]">
            <thead>
              <tr className="bg-blue-950 text-white print:bg-blue-950">
                <th className="border border-blue-950 px-1 py-0.5 text-left font-bold uppercase print:px-0.5 print:py-px">
                  Parentesco
                </th>
                <th className="border border-blue-950 px-1 py-0.5 text-left font-bold uppercase print:px-0.5 print:py-px">
                  Nombre
                </th>
                <th className="border border-blue-950 px-1 py-0.5 text-left font-bold uppercase print:px-0.5 print:py-px">
                  F. nac.
                </th>
              </tr>
            </thead>
            <tbody>
              {c.familiares.length === 0 ? (
                <tr>
                  <td className="border border-blue-200 px-1 py-1 text-blue-900/70 print:py-px print:text-[6px]" colSpan={3}>
                    Sin registros
                  </td>
                </tr>
              ) : (
                c.familiares.map((fam, idx) => (
                  <tr key={idx}>
                    <td className="border border-blue-200 bg-white px-1 py-0.5 font-semibold uppercase print:px-0.5 print:py-px print:leading-tight">
                      {fam.parentesco}
                    </td>
                    <td className="border border-blue-200 bg-white px-1 py-0.5 uppercase print:px-0.5 print:py-px print:leading-tight">
                      {fam.nombreFamiliar}
                    </td>
                    <td className="border border-blue-200 bg-white px-1 py-0.5 font-mono uppercase print:px-0.5 print:py-px print:leading-tight">
                      {fam.fechaNacimiento || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <BarraSeccion titulo="Escolaridad" />
        <Celda label="ESCOLARIDAD (ULTIMO GRADO)" value={displayOrDash(txt(f.escolaridad))} />
        <Celda label="IDIOMAS EXTERNOS" value={idiomas} />

        <BarraSeccion titulo="Salud" />
        <Celda label="ALERGICO (A)" value={displayOrDash(txt(f.alergicoA))} />
        <Celda label="DIABETES" value={displayOrDash(txt(f.diabetico))} />
        <Celda label="HIPERTENSION" value={displayOrDash(txt(f.hipertenso))} />
        <Celda label="ENFERMEDAD / TRATAMIENTO" value={displayOrDash(txt(f.enfermedadTratamiento))} />
        <Celda label="TIPO DE SANGRE" value={displayOrDash(txt(f.tipoSangre))} />

        <BarraSeccion titulo="Datos del servicio asignado" />
        <Celda label="SERVICIO (LINEA VIGENTE)" value={displayOrDash(servicioAsignadoLinea(c))} />
        <Celda label="PUESTO" value={displayOrDash(txt(c.puesto) || txt(f.puesto))} />
        <Celda label="POSICION" value={displayOrDash(txt(c.posicion) || txt(f.posicion))} />
        {!ocultarNomina ? (
          <Celda label="SUELDO MENSUAL" value={sueldoFormateado(String(f.sueldoMensual ?? ""))} />
        ) : (
          <Celda label="SUELDO MENSUAL" value="—" />
        )}

        <BarraSeccion titulo="Conocimientos y senas" />
        <Celda label="CONOCIMIENTOS Y HABILIDADES" value={displayOrDash(txt(f.conocimientosHabilidades))} fullWidth />
        <Celda label="SENAS PARTICULARES" value={displayOrDash(txt(f.senasParticulares))} fullWidth />
      </div>

      <p className="ficha-print-foot mt-5 border-t border-blue-200 pt-3 text-center text-[9px] font-medium uppercase leading-relaxed text-blue-900/70 print:mt-3 print:border-0 print:pt-1 print:text-[5.5px] print:leading-tight">
        Los datos provienen del expediente en Colaboradores. Los campos vacíos indican dato no capturado.
      </p>
    </div>
  );
}
