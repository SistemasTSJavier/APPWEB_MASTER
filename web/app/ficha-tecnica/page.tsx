"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { listColaboradoresCompletos } from "@/lib/colaboradores-store";
import type { AppRole } from "@/lib/app-role";
import { FICHA_FOTO_FORM_KEY } from "@/lib/ficha-tecnica-keys";
import { FichaTecnicaVista } from "@/app/ficha-tecnica/FichaTecnicaVista";

const MAX_SUGERENCIAS = 60;

function coincideBusqueda(c: ColaboradorCompleto, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const no = c.noEmpleado.toLowerCase();
  const nom = (c.nombreCompleto ?? "").toLowerCase();
  const nss = (c.nss ?? "").toLowerCase();
  return no.includes(n) || nom.includes(n) || nss.includes(n);
}

export default function FichaTecnicaPage() {
  const [rows, setRows] = useState<ColaboradorCompleto[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sel, setSel] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selRef = useRef("");
  const seleccionadoRef = useRef<ColaboradorCompleto | null>(null);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [meErr, setMeErr] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j = (await r.json()) as { role: AppRole | null };
        if (!c) {
          if (j.role) setAppRole(j.role);
          else setMeErr(true);
        }
      } catch {
        if (!c) setMeErr(true);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadErr(null);
      try {
        const list = await listColaboradoresCompletos();
        if (!cancel) setRows(list);
      } catch (e) {
        if (!cancel) {
          setRows([]);
          setLoadErr(e instanceof Error ? e.message : "ERROR AL CARGAR.");
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const opciones = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true, sensitivity: "base" }),
      ),
    [rows],
  );

  const sugerencias = useMemo(() => {
    const filtradas = opciones.filter((c) => coincideBusqueda(c, busqueda));
    return filtradas.slice(0, MAX_SUGERENCIAS);
  }, [opciones, busqueda]);

  const seleccionado = useMemo(() => rows.find((r) => r.noEmpleado === sel) ?? null, [rows, sel]);

  useEffect(() => {
    selRef.current = sel;
    seleccionadoRef.current = seleccionado;
  }, [sel, seleccionado]);

  /** Si el expediente se recarga (ej. foto), mantener la etiqueta del buscador alineada al seleccionado */
  useEffect(() => {
    if (!seleccionado) return;
    setBusqueda(`${seleccionado.noEmpleado} — ${seleccionado.nombreCompleto || "(SIN NOMBRE)"}`);
  }, [seleccionado?.noEmpleado, seleccionado?.nombreCompleto]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function limpiarSeleccion() {
    setSel("");
    setBusqueda("");
    setListaAbierta(false);
    setUploadMsg(null);
  }

  function elegirColaborador(c: ColaboradorCompleto) {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setSel(c.noEmpleado);
    setBusqueda(`${c.noEmpleado} — ${c.nombreCompleto || "(SIN NOMBRE)"}`);
    setListaAbierta(false);
    setUploadMsg(null);
  }

  const ocultarNomina = appRole === "mejora_continua";
  const puedeFoto =
    appRole === "admin" || appRole === "rh" || appRole === "gerente_rh";

  async function onFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !sel || !puedeFoto) return;
    setUploadMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("no_empleado", sel);
      fd.set("file", file);
      const r = await fetch("/api/colaboradores/foto", { method: "POST", body: fd });
      const t = await r.text();
      if (!r.ok) {
        let msg = t;
        try {
          msg = JSON.parse(t).error ?? t;
        } catch {
          /* */
        }
        setUploadMsg(typeof msg === "string" ? msg : "ERROR AL SUBIR.");
        return;
      }
      const list = await listColaboradoresCompletos();
      setRows(list);
      setUploadMsg("Foto actualizada.");
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : "ERROR AL SUBIR.");
    } finally {
      setUploading(false);
    }
  }

  function imprimir() {
    const no = selRef.current;
    const col = seleccionadoRef.current;
    const fotoUrl = String(col?.form?.[FICHA_FOTO_FORM_KEY] ?? "").trim();
    const hadFoto = Boolean(fotoUrl);

    const onAfterPrint = () => {
      window.removeEventListener("afterprint", onAfterPrint);
      if (!hadFoto || !no) return;
      void (async () => {
        try {
          const r = await fetch(`/api/colaboradores/foto?${new URLSearchParams({ no_empleado: no })}`, {
            method: "DELETE",
          });
          if (!r.ok) {
            const t = await r.text();
            let msg = t;
            try {
              msg = JSON.parse(t).error ?? t;
            } catch {
              /* */
            }
            setUploadMsg(typeof msg === "string" ? msg : "No se pudo eliminar la foto del almacen.");
            return;
          }
          const list = await listColaboradoresCompletos();
          setRows(list);
          setUploadMsg("Foto eliminada del servidor (solo se conservaba para imprimir / PDF).");
          setTimeout(() => setUploadMsg(null), 5000);
        } catch (e) {
          setUploadMsg(e instanceof Error ? e.message : "Error al eliminar la foto.");
        }
      })();
    };

    window.addEventListener("afterprint", onAfterPrint);
    window.print();
  }

  return (
    <div className="w-full print:min-h-0 print:bg-white">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Recursos humanos</p>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">Ficha técnica</h1>
            <p className="mt-1 max-w-xl text-base font-medium leading-relaxed text-slate-800">
              Documento de referencia con los datos del expediente. Puedes subir una foto solo para imprimir o guardar PDF (JPEG, PNG o WebP, max. 2 MB): al cerrar el cuadro de impresion, la imagen se elimina del servidor y del expediente.
            </p>
          </div>
        </div>

        {meErr ? (
          <div className="card mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 print:hidden">
            No se pudo leer tu perfil. Recarga la pagina o vuelve a iniciar sesion.
          </div>
        ) : null}

        {loadErr ? (
          <div className="card mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold uppercase text-red-900 print:hidden">
            {loadErr}
          </div>
        ) : null}

        <div className="card mb-4 space-y-3 print:hidden">
          <div className="relative space-y-1">
            <span className="form-label uppercase">Buscar colaborador</span>
            <p className="text-[11px] text-slate-500">Escribe numero de empleado, nombre o NSS; elige de la lista.</p>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type="search"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="EJ. 9117 O JUAN PEREZ…"
                  className="form-control uppercase"
                  value={busqueda}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBusqueda(v);
                    setListaAbierta(true);
                    if (sel) {
                      const actual = seleccionado;
                      const etiqueta = actual
                        ? `${actual.noEmpleado} — ${actual.nombreCompleto || "(SIN NOMBRE)"}`
                        : "";
                      if (v.trim().toUpperCase() !== etiqueta.trim().toUpperCase()) {
                        setSel("");
                      }
                    }
                    setUploadMsg(null);
                  }}
                  onFocus={() => setListaAbierta(true)}
                  onBlur={() => {
                    blurTimer.current = setTimeout(() => setListaAbierta(false), 180);
                  }}
                  aria-autocomplete="list"
                  aria-expanded={listaAbierta && sugerencias.length > 0}
                  aria-controls="ficha-sugerencias"
                />
                {listaAbierta && sugerencias.length > 0 ? (
                  <ul
                    id="ficha-sugerencias"
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    {sugerencias.map((r) => (
                      <li key={r.noEmpleado} role="option">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm uppercase hover:bg-slate-100"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => elegirColaborador(r)}
                        >
                          <span className="font-mono font-semibold text-slate-900">{r.noEmpleado}</span>
                          <span className="text-slate-600"> — {r.nombreCompleto || "(SIN NOMBRE)"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {listaAbierta && busqueda.trim() && sugerencias.length === 0 ? (
                  <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-lg">
                    Sin coincidencias.
                  </p>
                ) : null}
              </div>
              <button type="button" className="btn-secondary shrink-0 self-end uppercase text-xs" onClick={limpiarSeleccion}>
                Limpiar
              </button>
            </div>
            {opciones.length > MAX_SUGERENCIAS && !busqueda.trim() ? (
              <p className="text-[11px] text-slate-500">
                Mostrando los primeros {MAX_SUGERENCIAS} por orden de numero. Escribe para acotar.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary uppercase" disabled={!seleccionado} onClick={imprimir}>
              Imprimir / PDF
            </button>
            {puedeFoto && seleccionado ? (
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold uppercase text-slate-800 hover:bg-slate-50">
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={onFile} />
                {uploading ? "Subiendo…" : "Subir foto"}
              </label>
            ) : null}
            {!puedeFoto ? (
              <span className="text-xs text-slate-500">La foto solo la actualizan perfiles con permiso de edicion de expediente.</span>
            ) : null}
          </div>
          {uploadMsg ? (
            <p className={`text-sm font-medium ${uploadMsg.includes("ERROR") || uploadMsg.includes("No existe") ? "text-red-700" : "text-green-800"}`}>
              {uploadMsg}
            </p>
          ) : null}
        </div>

        {seleccionado ? (
          <FichaTecnicaVista colaborador={seleccionado} ocultarNomina={ocultarNomina} />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 print:hidden">
            Selecciona un colaborador para generar la ficha.
          </p>
        )}
    </div>
  );
}
