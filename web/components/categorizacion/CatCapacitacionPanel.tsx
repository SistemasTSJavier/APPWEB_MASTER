"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatCapacitacionCurso, CatCapacitacionRegistro, CatColaboradorActivoOpcion } from "@/lib/categorizacion-types";
import { cursoDisponibleParaRegistro } from "@/lib/categorizacion-capacitacion-curso";
import {
  CatEmpleadoBuscador,
  CatFiltroPlanta,
  CatFiltroServicio,
  CatListaFiltro,
  CatResumenServicios,
  filtrarPorServicio,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg, CatPromedioBadge, CatRatingSelect } from "@/components/categorizacion/cat-form-ui";
import { fetchColaboradoresActivosCat } from "@/lib/categorizacion-colaboradores-client";
import { mesCalendarioAnteriorYm } from "@/lib/categorizacion-faltas-cuadricula";
import { etiquetaMesYm } from "@/lib/categorizacion-recompensas";
import {
  comentarioKardexVisible,
  etiquetaCursoKardexVisible,
} from "@/lib/categorizacion-kardex";
import { filtrarPorVigenciaEnMesHistorial } from "@/lib/categorizacion-tenure";

export function CatCapacitacionPanel() {
  const [activos, setActivos] = useState<CatColaboradorActivoOpcion[]>([]);
  const [cursos, setCursos] = useState<CatCapacitacionCurso[]>([]);
  const [registros, setRegistros] = useState<CatCapacitacionRegistro[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [periodMonth, setPeriodMonth] = useState(mesCalendarioAnteriorYm());

  const [regNo, setRegNo] = useState("");
  const [regCursoId, setRegCursoId] = useState("");
  const [regDesempeno, setRegDesempeno] = useState<number | "">("");
  const [regComentarios, setRegComentarios] = useState("");
  const [filtroHistorial, setFiltroHistorial] = useState("");
  const [filtroServicio, setFiltroServicio] = useState("");
  const [filtroPlanta, setFiltroPlanta] = useState("");

  const personalVisible = useMemo(
    () => filtrarPorVigenciaEnMesHistorial(
      filtrarPorServicio(activos, filtroServicio, filtroPlanta),
      periodMonth,
    ),
    [activos, filtroServicio, filtroPlanta, periodMonth],
  );

  const opcionesPersonal = useMemo(
    () => personalVisible.map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre })),
    [personalVisible],
  );

  const personalPorNo = useMemo(() => new Map(activos.map((p) => [p.noEmpleado, p])), [activos]);

  const registrosPorServicio = useMemo(() => {
    const visibles = new Set(personalVisible.map((p) => p.noEmpleado));
    return registros.filter((r) => visibles.has(r.noEmpleado));
  }, [registros, personalVisible]);

  const registrosFiltrados = useMemo(() => {
    const list = registrosPorServicio;
    const q = filtroHistorial.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const p = personalPorNo.get(r.noEmpleado);
      const nom = (p?.nombre ?? "").toLowerCase();
      const srv = (p?.servicio ?? "").toLowerCase();
      const curso = (r.cursoNombre ?? r.cursoId ?? "").toLowerCase();
      return (
        r.noEmpleado.toLowerCase().includes(q) ||
        nom.includes(q) ||
        srv.includes(q) ||
        curso.includes(q)
      );
    });
  }, [registrosPorServicio, filtroHistorial, personalPorNo]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const mesQ = encodeURIComponent(periodMonth);
      const [activosRows, rc] = await Promise.all([
        fetchColaboradoresActivosCat({ forceRefresh: true }),
        fetch(`/api/categorizacion/capacitacion?mes=${mesQ}`, { cache: "no-store" }),
      ]);
      const jc = await rc.json();
      if (!rc.ok) throw new Error(jc.error);
      if (!jc.ok) throw new Error(jc.error);
      setActivos(activosRows);
      setCursos(jc.cursos ?? []);
      const cursosRows = (jc.cursos ?? []) as CatCapacitacionCurso[];
      const nombrePorId = new Map(cursosRows.map((c) => [c.id, c.nombre.trim()]));
      setRegistros(
        ((jc.registros ?? []) as CatCapacitacionRegistro[]).map((r) => {
          const nombre =
            etiquetaCursoKardexVisible(r.cursoNombre) ||
            etiquetaCursoKardexVisible(nombrePorId.get(r.cursoId)) ||
            r.cursoNombre ||
            "Capacitación";
          return {
            ...r,
            cursoNombre: nombre,
            comentarios: comentarioKardexVisible(r.comentarios),
          };
        }),
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR.");
    } finally {
      setBusy(false);
    }
  }, [periodMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!regNo) return;
    const ok = personalVisible.some((p) => p.noEmpleado === regNo);
    if (!ok) setRegNo("");
  }, [personalVisible, regNo]);

  const cursosDisponibles = useMemo(() => cursos.filter((c) => cursoDisponibleParaRegistro(c)), [cursos]);

  async function registrarColaborador() {
    if (!regNo || !regCursoId) {
      setMsg("EMPLEADO Y CAPACITACIÓN REQUERIDOS.");
      return;
    }
    if (regDesempeno === "") {
      setMsg("CAPTURE DESEMPEÑO (1–5).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/categorizacion/capacitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_registro",
          noEmpleado: regNo,
          cursoId: regCursoId,
          desempeno: regDesempeno,
          comentarios: regComentarios,
          periodMonth,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg("REGISTRO DE CAPACITACIÓN GUARDADO.");
      setRegDesempeno("");
      setRegComentarios("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR.");
    } finally {
      setBusy(false);
    }
  }

  const promedioReg = regDesempeno !== "" ? Number(regDesempeno) : null;

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-slate-600">
        Las capacitaciones se crean en{" "}
        <Link href="/categorizacion/catalogo-capacitaciones" className="font-bold text-violet-800 underline">
          Catálogo capacitaciones
        </Link>
        . Aquí solo se asignan colaboradores a cursos <strong>activos</strong> y se califica <strong>desempeño</strong>{" "}
        del <strong>mes seleccionado</strong>.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <label className="space-y-1">
          <span className="form-label">Mes de la capacitación</span>
          <input
            className="form-control"
            type="month"
            value={periodMonth}
            onChange={(e) => {
              const m = e.target.value;
              if (!/^\d{4}-\d{2}$/.test(m)) return;
              setPeriodMonth(m);
              setMsg(null);
            }}
            disabled={busy}
          />
        </label>
        <p className="pb-1 text-[11px] font-medium text-slate-600 capitalize">
          Historial: {etiquetaMesYm(periodMonth)}. Cada mes guarda sus propios registros y promedios.
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase">Registrar colaborador a capacitación</h2>
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
              label="Empleado (activo en Colaboradores)"
              hint="Datos en vivo desde expedientes activos. Escribe N° o nombre."
              value={regNo}
              onChange={setRegNo}
              opciones={opcionesPersonal}
              listId="cat-cap-reg-empleado"
              disabled={busy || opcionesPersonal.length === 0}
            />
          </div>
          <label className="space-y-1 sm:col-span-2">
            <span className="form-label">Capacitación (activa)</span>
            <select className="form-control" value={regCursoId} onChange={(e) => setRegCursoId(e.target.value)}>
              <option value="">—</option>
              {cursosDisponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {cursosDisponibles.length === 0 ? (
              <p className="text-[11px] font-medium text-amber-800">
                No hay cursos activos. Crea o activa capacitaciones en el catálogo.
              </p>
            ) : null}
          </label>
          <CatRatingSelect label="Desempeño (1-5)" value={regDesempeno} onChange={setRegDesempeno} />
        </div>
        <label className="block space-y-1">
          <span className="form-label">Comentarios</span>
          <textarea className="form-control min-h-[60px]" value={regComentarios} onChange={(e) => setRegComentarios(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <CatPromedioBadge promedio={promedioReg} />
          <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void registrarColaborador()}>
            Registrar
          </button>
        </div>
      </section>

      <CatMsg msg={msg} />

      <section className="card overflow-hidden">
        <h2 className="mb-2 px-1 text-sm font-bold uppercase">
          Historial {etiquetaMesYm(periodMonth)} ({registrosFiltrados.length}
          {registrosPorServicio.length !== registrosFiltrados.length ? ` de ${registrosPorServicio.length}` : ""}
          {filtroServicio && registros.length !== registrosPorServicio.length ? ` · ${registros.length} total` : ""})
        </h2>
        <CatListaFiltro
          value={filtroHistorial}
          onChange={setFiltroHistorial}
          total={registrosPorServicio.length}
          filtrados={registrosFiltrados.length}
          totalCatalogo={filtroServicio ? registros.length : undefined}
        />
        <div className="max-h-[min(70vh,32rem)] overflow-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="p-2">N°</th>
                <th className="p-2">Capacitación</th>
                <th className="p-2">Desemp.</th>
                <th className="p-2">Prom.</th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2 font-mono">{r.noEmpleado}</td>
                  <td className="p-2 font-semibold uppercase">{r.cursoNombre || "—"}</td>
                  <td className="p-2">{r.desempeno ?? r.asistencia ?? "—"}</td>
                  <td className="p-2 font-bold">{r.promedio != null ? r.promedio.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
