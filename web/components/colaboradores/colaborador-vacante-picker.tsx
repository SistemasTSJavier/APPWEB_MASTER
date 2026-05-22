"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  datosAltaDesdeVacante,
  listarPlantasVacantesPorServicio,
  listarServiciosDesdeVacantes,
  listarVacantesPorServicioYPlanta,
} from "@/lib/altas-vacantes";
import {
  loadVacantesCatalogo,
  VACANTES_CATALOG_UPDATED_EVENT,
  type VacanteRegistro,
} from "@/lib/vacantes-catalog";

export type VacantePickerValores = {
  servicio: string;
  noServicio: string;
  planta: string;
  posicion: string;
  puesto: string;
};

type Props = {
  valores: VacantePickerValores;
  onChange: (v: VacantePickerValores, vacanteId: string) => void;
};

export function ColaboradorVacantePicker({ valores, onChange }: Props) {
  const [catalogo, setCatalogo] = useState<VacanteRegistro[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [claveServicio, setClaveServicio] = useState("");
  const [vacanteId, setVacanteId] = useState("");

  useEffect(() => {
    const recargar = () => setCatalogo(loadVacantesCatalogo());
    recargar();
    setHydrated(true);
    window.addEventListener(VACANTES_CATALOG_UPDATED_EVENT, recargar);
    return () => window.removeEventListener(VACANTES_CATALOG_UPDATED_EVENT, recargar);
  }, []);

  const servicios = useMemo(() => listarServiciosDesdeVacantes(catalogo), [catalogo]);
  const plantas = useMemo(
    () => listarPlantasVacantesPorServicio(claveServicio, catalogo),
    [claveServicio, catalogo],
  );
  const vacantesPlanta = useMemo(
    () => listarVacantesPorServicioYPlanta(claveServicio, valores.planta, catalogo),
    [claveServicio, valores.planta, catalogo],
  );

  const hayCatalogo = catalogo.length > 0;

  if (!hydrated) {
    return <p className="text-xs font-medium text-slate-600">Cargando vacantes…</p>;
  }

  if (!hayCatalogo) {
    return (
      <p className="text-xs font-semibold text-amber-900">
        Sin vacantes en catálogo. Importe en{" "}
        <Link href="/cuadricula" className="underline">
          Cuadrícula → Vacantes
        </Link>
        . Puede editar servicio y posición en los campos del expediente.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <label className="space-y-1">
        <span className="form-label uppercase">Servicio (vacante)</span>
        <select
          className="form-control"
          value={claveServicio}
          onChange={(e) => {
            const clave = e.target.value;
            const opt = servicios.find((s) => s.clave === clave);
            setClaveServicio(clave);
            setVacanteId("");
            onChange(
              {
                servicio: opt?.servicioLinea ?? "",
                noServicio: opt?.rowServiceNo ?? "",
                planta: "",
                posicion: "",
                puesto: valores.puesto,
              },
              "",
            );
          }}
        >
          <option value="">Seleccione…</option>
          {servicios.map((s) => (
            <option key={s.clave} value={s.clave}>
              {s.servicioLinea}
              {s.rowServiceNo ? ` (${s.rowServiceNo})` : ""} — {s.vacantes}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="form-label uppercase">Planta</span>
        <select
          className="form-control"
          value={valores.planta}
          disabled={!claveServicio}
          onChange={(e) => {
            setVacanteId("");
            onChange({ ...valores, planta: e.target.value, posicion: "" }, "");
          }}
        >
          <option value="">{!claveServicio ? "Primero servicio…" : "Seleccione…"}</option>
          {plantas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="form-label uppercase">Posición</span>
        <select
          className="form-control"
          value={vacanteId}
          disabled={!claveServicio || !valores.planta}
          onChange={(e) => {
            const id = e.target.value;
            const v = vacantesPlanta.find((x) => x.id === id);
            if (!v) {
              setVacanteId("");
              onChange({ ...valores, posicion: "" }, "");
              return;
            }
            const d = datosAltaDesdeVacante(v);
            setVacanteId(id);
            setClaveServicio(d.claveServicio);
            onChange(
              {
                servicio: d.servicio,
                noServicio: d.noServicio,
                planta: d.planta,
                posicion: d.posicion,
                puesto: d.puesto || valores.puesto,
              },
              id,
            );
          }}
        >
          <option value="">{!valores.planta ? "Primero planta…" : "Seleccione…"}</option>
          {vacantesPlanta.map((v) => (
            <option key={v.id} value={v.id}>
              {v.posicion}
              {v.puesto ? ` — ${v.puesto}` : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
