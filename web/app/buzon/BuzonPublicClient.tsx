"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { TacticalSupportLogo } from "@/components/tactical-support-logo";
import { SGC_DEPARTAMENTOS } from "@/lib/sgc-calidad";
import {
  BUZON_APROBACION_LABEL,
  fechaBuzonMx,
  type BuzonVerificacionPublica,
} from "@/lib/buzon";

type Vista = "menu" | "crear" | "exito" | "verificar";
type DepOpt = { id: string; label: string };

const inputCls =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-slate-600";
const textareaCls = `${inputCls} min-h-[110px] resize-y leading-relaxed`;

export function BuzonPublicClient() {
  const [vista, setVista] = useState<Vista>("menu");
  const [departamento, setDepartamento] = useState("");
  const [nombreColaborador, setNombreColaborador] = useState("");
  const [quejaRequerimiento, setQuejaRequerimiento] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [evidenciaBlob, setEvidenciaBlob] = useState<Blob | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigoOk, setCodigoOk] = useState<string | null>(null);
  const [codigoConsulta, setCodigoConsulta] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState<BuzonVerificacionPublica | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [departamentos, setDepartamentos] = useState<DepOpt[]>(
    SGC_DEPARTAMENTOS.map((d) => ({ id: d.id, label: d.label })),
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const detenerCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamaraActiva(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetCrear() {
    setDepartamento("");
    setNombreColaborador("");
    setQuejaRequerimiento("");
    setEvidenciaBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    detenerCamara();
  }

  async function iniciarCamara() {
    setError(null);
    detenerCamara();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCamaraActiva(true);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setError(
        "No se pudo acceder a la cámara. Permita el acceso o use «Tomar foto» del dispositivo.",
      );
      fileInputRef.current?.click();
    }
  }

  function capturarFoto() {
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      setError("Active la cámara primero.");
      return;
    }
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("No se pudo capturar la imagen.");
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("No se pudo generar la evidencia.");
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setEvidenciaBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        detenerCamara();
      },
      "image/jpeg",
      0.88,
    );
  }

  function onFileCapture(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Seleccione una imagen válida.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setEvidenciaBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    detenerCamara();
    setError(null);
  }

  async function enviarRegistro(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!evidenciaBlob) {
      setError("Tome la evidencia fotográfica al momento del registro.");
      return;
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("departamento", departamento);
      fd.set("nombreColaborador", nombreColaborador.trim());
      fd.set("quejaRequerimiento", quejaRequerimiento.trim());
      fd.set("evidencia", evidenciaBlob, "evidencia.jpg");

      const res = await fetch("/api/buzon", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        codigoSeguimiento?: string;
      };
      if (!res.ok) {
        setError(j.error ?? "No se pudo registrar.");
        return;
      }
      const codigo = j.codigoSeguimiento ?? "";
      setCodigoOk(codigo);
      window.alert(
        `Registro exitoso.\n\nSu código de seguimiento es:\n${codigo}\n\nGuárdelo para consultar el estatus.`,
      );
      setVista("exito");
      resetCrear();
    } catch {
      setError("Error de red. Intente de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function consultarCodigo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResultado(null);
    setVerificando(true);
    try {
      const res = await fetch(
        `/api/buzon/verificar?codigo=${encodeURIComponent(codigoConsulta.trim())}`,
      );
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        registro?: BuzonVerificacionPublica;
      };
      if (!res.ok) {
        setError(j.error ?? "No se pudo verificar.");
        return;
      }
      setResultado(j.registro ?? null);
    } catch {
      setError("Error de red al verificar.");
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 text-center">
          <TacticalSupportLogo
            className="mx-auto block h-16 w-auto max-w-[220px] object-contain sm:h-20"
            priority
          />
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">
            Atención interna
          </p>
          <h1 className="mt-2 text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Buzón
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
            Registre una queja o requerimiento con evidencia fotográfica, o consulte el avance con su
            código de seguimiento.
          </p>
        </header>

        {vista === "menu" && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/95 p-5 text-slate-900 shadow-xl shadow-black/30 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Paso 1</p>
            <h2 className="mt-1 text-lg font-bold uppercase text-slate-900">¿Qué desea hacer?</h2>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-slate-800"
              onClick={() => {
                setError(null);
                setVista("crear");
              }}
            >
              Crear registro
            </button>
            <button
              type="button"
              className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-4 text-sm font-bold uppercase tracking-wide text-slate-800 transition hover:border-slate-400"
              onClick={() => {
                setError(null);
                setResultado(null);
                setVista("verificar");
              }}
            >
              Verificar registro
            </button>
          </div>
        )}

        {vista === "crear" && (
          <form
            onSubmit={enviarRegistro}
            className="rounded-2xl border border-white/10 bg-white/95 p-5 text-slate-900 shadow-xl shadow-black/30 sm:p-6"
          >
            <button
              type="button"
              className="text-xs font-semibold text-sky-700 underline-offset-2 hover:underline"
              onClick={() => {
                resetCrear();
                setVista("menu");
              }}
            >
              ← Volver
            </button>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-sky-800">
              Nuevo registro
            </p>
            <h2 className="mt-1 text-lg font-bold uppercase text-slate-900">Datos y evidencia</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className={labelCls} htmlFor="buzon-depto">
                  Departamento
                </label>
                <select
                  id="buzon-depto"
                  className={inputCls}
                  required
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                >
                  <option value="">Seleccione…</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="buzon-nombre">
                  Nombre colaborador
                </label>
                <input
                  id="buzon-nombre"
                  className={inputCls}
                  required
                  minLength={2}
                  maxLength={120}
                  value={nombreColaborador}
                  onChange={(e) => setNombreColaborador(e.target.value)}
                  placeholder="Nombre completo"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="buzon-queja">
                  Queja o requerimiento
                </label>
                <textarea
                  id="buzon-queja"
                  className={textareaCls}
                  required
                  minLength={10}
                  maxLength={4000}
                  value={quejaRequerimiento}
                  onChange={(e) => setQuejaRequerimiento(e.target.value)}
                  placeholder="Describa con claridad…"
                />
              </div>

              <div>
                <p className={labelCls}>Evidencia fotográfica (al momento)</p>
                <p className="mt-1 text-xs text-slate-500">
                  Debe tomarse ahora con la cámara. No use fotos de la galería salvo que la cámara no
                  esté disponible.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white"
                    onClick={() => void iniciarCamara()}
                  >
                    Abrir cámara
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-800"
                    onClick={capturarFoto}
                    disabled={!camaraActiva}
                  >
                    Capturar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-800"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Cámara del dispositivo
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onFileCapture(e.target.files?.[0] ?? null)}
                />

                {camaraActiva ? (
                  <video
                    ref={videoRef}
                    className="mt-3 aspect-[4/3] w-full rounded-lg bg-black object-cover"
                    playsInline
                    muted
                    autoPlay
                  />
                ) : null}

                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Evidencia capturada"
                    className="mt-3 aspect-[4/3] w-full rounded-lg object-cover ring-2 ring-emerald-500/40"
                  />
                ) : null}
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={enviando}
              className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {enviando ? "Registrando…" : "Registrar"}
            </button>
          </form>
        )}

        {vista === "exito" && codigoOk && (
          <div className="rounded-2xl border border-white/10 bg-white/95 p-5 text-slate-900 shadow-xl sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Listo</p>
            <h2 className="mt-1 text-lg font-bold uppercase text-slate-900">Registro exitoso</h2>
            <p className="mt-3 text-sm text-slate-600">
              Guarde su código de seguimiento. Lo necesitará para consultar el estatus.
            </p>
            <p className="mt-4 rounded-xl bg-slate-900 px-4 py-4 text-center font-mono text-xl font-bold tracking-wider text-white">
              {codigoOk}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold uppercase text-white"
                onClick={() => {
                  setCodigoConsulta(codigoOk);
                  setVista("verificar");
                }}
              >
                Verificar ahora
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase text-slate-800"
                onClick={() => {
                  setCodigoOk(null);
                  setVista("menu");
                }}
              >
                Menú
              </button>
            </div>
          </div>
        )}

        {vista === "verificar" && (
          <div className="rounded-2xl border border-white/10 bg-white/95 p-5 text-slate-900 shadow-xl sm:p-6">
            <button
              type="button"
              className="text-xs font-semibold text-sky-700 underline-offset-2 hover:underline"
              onClick={() => {
                setError(null);
                setResultado(null);
                setVista("menu");
              }}
            >
              ← Volver
            </button>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-sky-800">
              Consulta
            </p>
            <h2 className="mt-1 text-lg font-bold uppercase text-slate-900">Verificar registro</h2>

            <form onSubmit={consultarCodigo} className="mt-5 space-y-4">
              <div>
                <label className={labelCls} htmlFor="buzon-codigo">
                  Código de seguimiento
                </label>
                <input
                  id="buzon-codigo"
                  className={`${inputCls} font-mono uppercase`}
                  required
                  value={codigoConsulta}
                  onChange={(e) => setCodigoConsulta(e.target.value.toUpperCase())}
                  placeholder="BZ-20260904-XXXX"
                  autoComplete="off"
                />
              </div>
              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={verificando}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-60"
              >
                {verificando ? "Consultando…" : "Consultar estatus"}
              </button>
            </form>

            {resultado ? (
              <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
                <p className="text-xs font-bold uppercase text-slate-500">Aprobación</p>
                <p
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${
                    resultado.aprobacion === "aprobado"
                      ? "bg-emerald-100 text-emerald-900"
                      : resultado.aprobacion === "no_aprobado"
                        ? "bg-red-100 text-red-900"
                        : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {resultado.aprobacionLabel || BUZON_APROBACION_LABEL[resultado.aprobacion]}
                </p>

                {resultado.aprobacion === "aprobado" && resultado.estatusLabel ? (
                  <>
                    <p className="pt-2 text-xs font-bold uppercase text-slate-500">Estatus</p>
                    <p className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-900">
                      {resultado.estatusLabel}
                    </p>
                  </>
                ) : null}

                {resultado.aprobacion === "no_aprobado" ? (
                  <p className="text-sm text-red-700">
                    Este registro no fue aprobado; no hay seguimiento de estatus.
                  </p>
                ) : null}

                {resultado.aprobacion === "pendiente" ? (
                  <p className="text-sm text-amber-800">
                    Su registro está en espera de aprobación. Cuando se apruebe, verá el estatus aquí.
                  </p>
                ) : null}

                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-slate-500">Código</dt>
                    <dd className="font-mono font-semibold">{resultado.codigoSeguimiento}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-slate-500">Colaborador</dt>
                    <dd>{resultado.nombreColaborador}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-slate-500">Departamento</dt>
                    <dd>{resultado.departamentoLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-slate-500">
                      Queja / requerimiento
                    </dt>
                    <dd className="whitespace-pre-wrap">{resultado.quejaRequerimiento}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-slate-500">Registrado</dt>
                    <dd>{fechaBuzonMx(resultado.createdAt)}</dd>
                  </div>
                </dl>
                {resultado.evidenciaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resultado.evidenciaUrl}
                    alt="Evidencia"
                    className="mt-2 aspect-[4/3] w-full rounded-lg object-cover"
                  />
                ) : null}
                {resultado.notas.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Historial</p>
                    <ul className="mt-2 space-y-2">
                      {resultado.notas.map((n, i) => (
                        <li
                          key={`${n.at}-${i}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <p className="font-semibold text-slate-800">
                            {n.label} · {fechaBuzonMx(n.at)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-600">{n.nota}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Aún no hay notas de seguimiento.</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
