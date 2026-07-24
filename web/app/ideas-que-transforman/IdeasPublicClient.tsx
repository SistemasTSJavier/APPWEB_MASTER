"use client";

import { useEffect, useState, type FormEvent } from "react";
import { TacticalSupportLogo } from "@/components/tactical-support-logo";
import { SGC_DEPARTAMENTOS } from "@/lib/sgc-calidad";

type Paso = "datos" | "idea" | "gracias";
type DepOpt = { id: string; label: string };

const inputCls =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-slate-600";
const textareaCls = `${inputCls} min-h-[110px] resize-y leading-relaxed`;

export function IdeasPublicClient() {
  const [paso, setPaso] = useState<Paso>("datos");
  const [nombre, setNombre] = useState("");
  const [departamentoAutor, setDepartamentoAutor] = useState("");
  const [problema, setProblema] = useState("");
  const [solucion, setSolucion] = useState("");
  const [beneficio, setBeneficio] = useState("");
  const [departamentoAfectado, setDepartamentoAfectado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departamentos, setDepartamentos] = useState<DepOpt[]>(
    SGC_DEPARTAMENTOS.map((d) => ({ id: d.id, label: d.label })),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/catalogos/departamentos", { cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as { departamentos?: DepOpt[] };
        if (!cancelled && r.ok && j.departamentos?.length) setDepartamentos(j.departamentos);
      } catch {
        /* builtins */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function continuarDatos(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 2) {
      setError("Indique su nombre completo.");
      return;
    }
    if (!departamentoAutor) {
      setError("Seleccione su departamento.");
      return;
    }
    setPaso("idea");
  }

  async function enviarIdea(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/ideas-que-transforman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          departamentoAutor,
          problema: problema.trim(),
          solucion: solucion.trim(),
          beneficio: beneficio.trim(),
          departamentoAfectado,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "No se pudo enviar la propuesta.");
        return;
      }
      setPaso("gracias");
    } catch {
      setError("Error de red. Intente de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 text-center">
          <TacticalSupportLogo
            className="mx-auto block h-16 w-auto max-w-[220px] object-contain sm:h-20"
            priority
          />
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">Mejora continua</p>
          <h1 className="mt-2 text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Ideas que transforman
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
            Comparte una propuesta para mejorar Tactical Support. Tu voz suma a la excelencia operativa.
          </p>
        </header>

        {paso === "datos" && (
          <form
            onSubmit={continuarDatos}
            className="rounded-2xl border border-white/10 bg-white/95 p-5 text-slate-900 shadow-xl shadow-black/30 sm:p-6"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Paso 1 de 2</p>
            <h2 className="mt-1 text-lg font-bold uppercase text-slate-900">Tus datos</h2>
            <p className="mt-1 text-sm text-slate-600">Para dar seguimiento a tu propuesta.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className={labelCls} htmlFor="idea-nombre">
                  Nombre
                </label>
                <input
                  id="idea-nombre"
                  className={inputCls}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre completo"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="idea-depto">
                  Departamento
                </label>
                <select
                  id="idea-depto"
                  className={inputCls}
                  value={departamentoAutor}
                  onChange={(e) => setDepartamentoAutor(e.target.value)}
                  required
                >
                  <option value="">Seleccione…</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-slate-800"
            >
              Continuar
            </button>
          </form>
        )}

        {paso === "idea" && (
          <form
            onSubmit={enviarIdea}
            className="rounded-2xl border border-white/10 bg-white/95 p-5 text-slate-900 shadow-xl shadow-black/30 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Paso 2 de 2</p>
                <h2 className="mt-1 text-lg font-bold uppercase text-slate-900">Tu propuesta</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {nombre.trim()} ·{" "}
                  {departamentos.find((d) => d.id === departamentoAutor)?.label ?? departamentoAutor}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPaso("datos");
                }}
                className="shrink-0 text-[11px] font-bold uppercase text-sky-800 underline-offset-2 hover:underline"
              >
                Editar datos
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className={labelCls} htmlFor="idea-problema">
                  1. Problema
                </label>
                <textarea
                  id="idea-problema"
                  className={textareaCls}
                  value={problema}
                  onChange={(e) => setProblema(e.target.value)}
                  placeholder="¿Qué situación detectaste que se puede mejorar?"
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="idea-solucion">
                  2. Solución
                </label>
                <textarea
                  id="idea-solucion"
                  className={textareaCls}
                  value={solucion}
                  onChange={(e) => setSolucion(e.target.value)}
                  placeholder="¿Qué propuesta concreta ofreces?"
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="idea-beneficio">
                  3. Beneficio
                </label>
                <textarea
                  id="idea-beneficio"
                  className={textareaCls}
                  value={beneficio}
                  onChange={(e) => setBeneficio(e.target.value)}
                  placeholder="¿Qué gana la empresa o el equipo con esta mejora?"
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="idea-afectado">
                  4. Departamento afectado
                </label>
                <select
                  id="idea-afectado"
                  className={inputCls}
                  value={departamentoAfectado}
                  onChange={(e) => setDepartamentoAfectado(e.target.value)}
                  required
                >
                  <option value="">Seleccione…</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="mt-6 w-full rounded-lg bg-sky-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-sky-600 disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Enviar propuesta"}
            </button>
          </form>
        )}

        {paso === "gracias" && (
          <div className="rounded-2xl border border-white/10 bg-white/95 p-6 text-center text-slate-900 shadow-xl shadow-black/30 sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-800">Propuesta recibida</p>
            <h2 className="mt-3 text-xl font-bold uppercase leading-snug text-slate-900 sm:text-2xl">
              Gracias por ayudar a Tactical Support
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
              Gracias por esta mejora. Te mantendremos informado en cuanto alguna mejora se esté realizando.
            </p>
            <div className="mt-8 border-t border-slate-200 pt-6">
              <TacticalSupportLogo className="mx-auto block h-14 w-auto max-w-[200px] object-contain" />
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-800">
                Vive el hábito de la excelencia
              </p>
            </div>
          </div>
        )}

        <p className="mt-auto pt-10 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Tactical Support · Confidencial
        </p>
      </div>
    </div>
  );
}
