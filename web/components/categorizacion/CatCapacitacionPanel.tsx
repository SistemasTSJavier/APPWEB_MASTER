"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatCapacitacionCurso, CatCapacitacionRegistro, CatPersonalRow } from "@/lib/categorizacion-types";
import { cursoDisponibleParaRegistro } from "@/lib/categorizacion-capacitacion-curso";
import { CatEmpleadoBuscador, CatListaFiltro } from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg, CatPromedioBadge, CatRatingSelect } from "@/components/categorizacion/cat-form-ui";

export function CatCapacitacionPanel() {
  const [personal, setPersonal] = useState<CatPersonalRow[]>([]);
  const [cursos, setCursos] = useState<CatCapacitacionCurso[]>([]);
  const [registros, setRegistros] = useState<CatCapacitacionRegistro[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [regNo, setRegNo] = useState("");
  const [regCursoId, setRegCursoId] = useState("");
  const [regAsistencia, setRegAsistencia] = useState<number | "">("");
  const [regDesempeno, setRegDesempeno] = useState<number | "">("");
  const [regComentarios, setRegComentarios] = useState("");
  const [filtroHistorial, setFiltroHistorial] = useState("");

  const opcionesPersonal = useMemo(
    () => personal.map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre })),
    [personal],
  );

  const registrosFiltrados = useMemo(() => {
    const q = filtroHistorial.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter((r) => {
      const p = personal.find((x) => x.noEmpleado === r.noEmpleado);
      const nom = (p?.nombre ?? "").toLowerCase();
      const curso = (r.cursoNombre ?? r.cursoId ?? "").toLowerCase();
      return r.noEmpleado.toLowerCase().includes(q) || nom.includes(q) || curso.includes(q);
    });
  }, [registros, filtroHistorial, personal]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [rp, rc] = await Promise.all([
        fetch("/api/categorizacion/personal", { cache: "no-store" }),
        fetch("/api/categorizacion/capacitacion", { cache: "no-store" }),
      ]);
      const jp = await rp.json();
      const jc = await rc.json();
      if (!rp.ok) throw new Error(jp.error);
      if (!jc.ok) throw new Error(jc.error);
      setPersonal(jp.rows ?? []);
      setCursos(jc.cursos ?? []);
      setRegistros(jc.registros ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cursosDisponibles = useMemo(() => cursos.filter((c) => cursoDisponibleParaRegistro(c)), [cursos]);

  async function registrarColaborador() {
    if (!regNo || !regCursoId) {
      setMsg("EMPLEADO Y CAPACITACIÓN REQUERIDOS.");
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
          asistencia: regAsistencia === "" ? null : regAsistencia,
          desempeno: regDesempeno === "" ? null : regDesempeno,
          comentarios: regComentarios,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg("REGISTRO DE CAPACITACIÓN GUARDADO.");
      setRegAsistencia("");
      setRegDesempeno("");
      setRegComentarios("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR.");
    } finally {
      setBusy(false);
    }
  }

  const promedioReg =
    regAsistencia !== "" && regDesempeno !== ""
      ? Math.round(((Number(regAsistencia) + Number(regDesempeno)) / 2) * 100) / 100
      : regAsistencia !== ""
        ? Number(regAsistencia)
        : regDesempeno !== ""
          ? Number(regDesempeno)
          : null;

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-slate-600">
        Las capacitaciones se crean en{" "}
        <Link href="/categorizacion/catalogo-capacitaciones" className="font-bold text-violet-800 underline">
          Catálogo capacitaciones
        </Link>
        . Aquí solo se asignan colaboradores a cursos <strong>vigentes</strong>.
      </p>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase">Registrar colaborador a capacitación</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <CatEmpleadoBuscador
              label="Empleado"
              value={regNo}
              onChange={setRegNo}
              opciones={opcionesPersonal}
              listId="cat-cap-reg-empleado"
              disabled={busy || opcionesPersonal.length === 0}
            />
          </div>
          <label className="space-y-1">
            <span className="form-label">Capacitación (vigente)</span>
            <select className="form-control" value={regCursoId} onChange={(e) => setRegCursoId(e.target.value)}>
              <option value="">—</option>
              {cursosDisponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.fechaInicio ? ` (inicio ${c.fechaInicio})` : ""} — vence {c.fechaVencimiento}
                </option>
              ))}
            </select>
            {cursosDisponibles.length === 0 ? (
              <p className="text-[11px] font-medium text-amber-800">
                No hay cursos vigentes. Crea o activa capacitaciones en el catálogo.
              </p>
            ) : null}
          </label>
          <CatRatingSelect label="Asistencia (1-5)" value={regAsistencia} onChange={setRegAsistencia} />
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

      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-bold uppercase">Historial ({registros.length})</h2>
        <CatListaFiltro
          value={filtroHistorial}
          onChange={setFiltroHistorial}
          total={registros.length}
          filtrados={registrosFiltrados.length}
        />
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b text-[10px] font-bold uppercase text-slate-600">
              <th className="p-2">N°</th>
              <th className="p-2">Capacitación</th>
              <th className="p-2">Asist.</th>
              <th className="p-2">Desemp.</th>
              <th className="p-2">Prom.</th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2 font-mono">{r.noEmpleado}</td>
                <td className="p-2">{r.cursoNombre ?? r.cursoId}</td>
                <td className="p-2">{r.asistencia ?? "—"}</td>
                <td className="p-2">{r.desempeno ?? "—"}</td>
                <td className="p-2 font-bold">{r.promedio != null ? r.promedio.toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
