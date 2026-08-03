"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatColaboradorActivoOpcion } from "@/lib/categorizacion-types";
import {
  CatEmpleadoBuscador,
  CatFiltroPlanta,
  CatFiltroServicio,
  CatResumenServicios,
  filtrarPorServicio,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";
import { fetchColaboradoresActivosCat } from "@/lib/categorizacion-colaboradores-client";
import { mesCalendarioAnteriorYm } from "@/lib/categorizacion-faltas-cuadricula";
import { etiquetaMesYm } from "@/lib/categorizacion-recompensas";
import { filtrarPorVigenciaEnMesHistorial } from "@/lib/categorizacion-tenure";
import { rolOperacionesDesdePuesto } from "@/lib/categorizacion-operaciones-roles";

type PromVals = {
  rh: string;
  capacitacion: string;
  operaciones: string;
  enfoque: string;
};

const EMPTY: PromVals = { rh: "", capacitacion: "", operaciones: "", enfoque: "" };

function fmtNum(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(Math.round(v * 100) / 100);
}

export function CatPromediosRapidosPanel() {
  const [activos, setActivos] = useState<CatColaboradorActivoOpcion[]>([]);
  const [periodMonth, setPeriodMonth] = useState(mesCalendarioAnteriorYm());
  const [filtroServicio, setFiltroServicio] = useState("");
  const [filtroPlanta, setFiltroPlanta] = useState("");
  const [noSel, setNoSel] = useState("");
  const [vals, setVals] = useState<PromVals>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const personalVisible = useMemo(
    () => filtrarPorVigenciaEnMesHistorial(
      filtrarPorServicio(activos, filtroServicio, filtroPlanta),
      periodMonth,
    ),
    [activos, filtroServicio, filtroPlanta, periodMonth],
  );
  const opciones = useMemo(
    () => personalVisible.map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre })),
    [personalVisible],
  );
  const seleccionado = useMemo(
    () => activos.find((a) => a.noEmpleado.trim().toUpperCase() === noSel.trim().toUpperCase()) ?? null,
    [activos, noSel],
  );
  const rolOp = rolOperacionesDesdePuesto(seleccionado?.puesto ?? "");

  const loadActivos = useCallback(async () => {
    try {
      const rows = await fetchColaboradoresActivosCat({ forceRefresh: true });
      setActivos(rows);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR PERSONAL.");
    }
  }, []);

  useEffect(() => {
    void loadActivos();
  }, [loadActivos]);

  const cargarPromedios = useCallback(async (no: string, mes: string, puesto: string) => {
    if (!no) {
      setVals(EMPTY);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const q = new URLSearchParams({
        no_empleado: no,
        mes,
        puesto,
      });
      const r = await fetch(`/api/categorizacion/promedios-rapidos?${q}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setVals({
        rh: fmtNum(j.rh),
        capacitacion: fmtNum(j.capacitacion),
        operaciones: fmtNum(j.operaciones),
        enfoque: fmtNum(j.enfoque),
      });
    } catch (e) {
      setVals(EMPTY);
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL LEER PROMEDIOS.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!noSel) {
      setVals(EMPTY);
      return;
    }
    const ok = personalVisible.some((p) => p.noEmpleado.trim().toUpperCase() === noSel.trim().toUpperCase());
    if (!ok) {
      setNoSel("");
      setVals(EMPTY);
      return;
    }
    void cargarPromedios(noSel, periodMonth, seleccionado?.puesto ?? "");
  }, [noSel, periodMonth, seleccionado?.puesto, personalVisible, cargarPromedios]);

  async function guardar() {
    if (!noSel) {
      setMsg("SELECCIONE UN COLABORADOR.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/promedios-rapidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noEmpleado: noSel,
          periodMonth,
          puesto: seleccionado?.puesto ?? "",
          fechaIngreso: seleccionado?.fechaIngreso ?? "",
          rh: vals.rh === "" ? null : Number(vals.rh.replace(",", ".")),
          capacitacion: vals.capacitacion === "" ? null : Number(vals.capacitacion.replace(",", ".")),
          operaciones: vals.operaciones === "" ? null : Number(vals.operaciones.replace(",", ".")),
          enfoque: vals.enfoque === "" ? null : Number(vals.enfoque.replace(",", ".")),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const mods = Array.isArray(j.guardados) ? j.guardados.join(", ") : "";
      setMsg(`GUARDADO (${etiquetaMesYm(periodMonth).toUpperCase()}): ${mods || "OK"}.`);
      setVals({
        rh: fmtNum(j.promedios?.rh),
        capacitacion: fmtNum(j.promedios?.capacitacion),
        operaciones: fmtNum(j.promedios?.operaciones),
        enfoque: fmtNum(j.promedios?.enfoque),
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL GUARDAR.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-slate-600">
        Captura el promedio (1–5) de cada módulo sin llenar criterio por criterio. Solo se guardan los campos
        que completes. Solo aparecen colaboradores vigentes según su fecha de ingreso en el mes elegido.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <label className="space-y-1">
          <span className="form-label">Mes del historial</span>
          <input
            className="form-control"
            type="month"
            value={periodMonth}
            onChange={(e) => {
              const m = e.target.value;
              if (!/^\d{4}-\d{2}$/.test(m)) return;
              setPeriodMonth(m);
            }}
            disabled={busy}
          />
        </label>
        <p className="pb-1 text-[11px] font-medium capitalize text-slate-600">
          {etiquetaMesYm(periodMonth)}
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase">Colaborador</h2>
        <CatResumenServicios personal={activos} servicioFiltro={filtroServicio} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CatFiltroServicio
            value={filtroServicio}
            onChange={(v) => {
              setFiltroServicio(v);
              setFiltroPlanta("");
            }}
            personal={activos}
          />
          <CatFiltroPlanta
            servicioFiltro={filtroServicio}
            value={filtroPlanta}
            onChange={setFiltroPlanta}
            personal={activos}
          />
          <div className="sm:col-span-2">
            <CatEmpleadoBuscador
              label="Empleado"
              hint="Escribe N° o nombre."
              value={noSel}
              onChange={setNoSel}
              opciones={opciones}
              listId="cat-prom-rapidos-empleado"
              disabled={busy || opciones.length === 0}
            />
          </div>
        </div>
        {seleccionado ? (
          <p className="text-[11px] font-medium text-slate-600">
            {seleccionado.puesto || "Sin puesto"} · Operaciones como{" "}
            <strong>{rolOp === "jefe_turno" ? "JT / JS" : "Oficial"}</strong>
          </p>
        ) : null}
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase">Promedios (1–5)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PromedioInput
            label="Recursos humanos"
            value={vals.rh}
            onChange={(v) => setVals((s) => ({ ...s, rh: v }))}
            disabled={busy || !noSel}
          />
          <PromedioInput
            label="Capacitación"
            value={vals.capacitacion}
            onChange={(v) => setVals((s) => ({ ...s, capacitacion: v }))}
            disabled={busy || !noSel}
          />
          <PromedioInput
            label={rolOp === "jefe_turno" ? "Operaciones (JT/JS)" : "Operaciones (oficial)"}
            value={vals.operaciones}
            onChange={(v) => setVals((s) => ({ ...s, operaciones: v }))}
            disabled={busy || !noSel}
          />
          <PromedioInput
            label="Enfoque al cliente"
            value={vals.enfoque}
            onChange={(v) => setVals((s) => ({ ...s, enfoque: v }))}
            disabled={busy || !noSel}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary uppercase" disabled={busy || !noSel} onClick={() => void guardar()}>
            Guardar promedios
          </button>
          <button
            type="button"
            className="btn-secondary uppercase"
            disabled={busy || !noSel}
            onClick={() => void cargarPromedios(noSel, periodMonth, seleccionado?.puesto ?? "")}
          >
            Recargar
          </button>
        </div>
      </section>

      <CatMsg msg={msg} />
    </div>
  );
}

function PromedioInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="form-label">{label}</span>
      <input
        className="form-control"
        type="number"
        min={1}
        max={5}
        step={0.1}
        inputMode="decimal"
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
