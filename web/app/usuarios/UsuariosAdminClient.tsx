"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientesTemporalesPanel } from "@/components/admin/ClientesTemporalesPanel";
import {
  APP_MODULOS_HABILITABLES,
  APP_ROLE_LABEL,
  parseAppRole,
  type AppModuloId,
  type ModuloCapacidad,
} from "@/lib/app-role";
import {
  ADMIN_USUARIO_ROLES,
  capacidadesSugeridasParaRol,
  type AdminUsuario,
} from "@/lib/admin-usuarios";
import { ROL_CATALOGO_PREFIX, type CatalogoItem } from "@/lib/app-catalogos-shared";
import { SGC_DEPARTAMENTOS } from "@/lib/sgc-calidad";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-slate-600";

function fechaMx(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type FormState = {
  email: string;
  password: string;
  nombre: string;
  departamento: string;
  appRole: string;
  capacidades: ModuloCapacidad[];
};

type DepOpcion = { id: string; label: string; esBuiltin?: boolean };

function emptyCreate(): FormState {
  return {
    email: "",
    password: "",
    nombre: "",
    departamento: "",
    appRole: "rh",
    capacidades: capacidadesSugeridasParaRol("rh"),
  };
}

function capMap(caps: ModuloCapacidad[]): Map<AppModuloId, ModuloCapacidad> {
  return new Map(caps.map((c) => [c.modulo, c]));
}

function CapacidadesPicker({
  value,
  onChange,
  disabled,
}: {
  value: ModuloCapacidad[];
  onChange: (next: ModuloCapacidad[]) => void;
  disabled?: boolean;
}) {
  const map = useMemo(() => capMap(value), [value]);

  function setAccion(modulo: AppModuloId, accion: "ver" | "editar" | "eliminar", on: boolean) {
    if (disabled) return;
    const prev = map.get(modulo) ?? { modulo, ver: false, editar: false, eliminar: false };
    let next: ModuloCapacidad = { ...prev, [accion]: on };
    if (accion === "editar" && on) next.ver = true;
    if (accion === "eliminar" && on) next.ver = true;
    if (accion === "ver" && !on) {
      next = { modulo, ver: false, editar: false, eliminar: false };
    }
    const by = new Map(map);
    if (!next.ver && !next.editar && !next.eliminar) by.delete(modulo);
    else by.set(modulo, next);
    onChange([...by.values()]);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={labelCls}>Módulos y permisos</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            className="text-[10px] font-bold uppercase text-sky-800 underline-offset-2 hover:underline disabled:opacity-40"
            onClick={() =>
              onChange(
                APP_MODULOS_HABILITABLES.map((m) => ({
                  modulo: m.id,
                  ver: true,
                  editar: false,
                  eliminar: false,
                })),
              )
            }
          >
            Solo ver todos
          </button>
          <button
            type="button"
            disabled={disabled}
            className="text-[10px] font-bold uppercase text-slate-600 underline-offset-2 hover:underline disabled:opacity-40"
            onClick={() => onChange([])}
          >
            Ninguno
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Marque Ver / Editar / Eliminar por sección. Solo los módulos marcados aparecen en el menú (el rol ya no abre
        el resto). En <strong>Colaboradores</strong>, solo Ver = consulta de nombre y no. de empleado (sin el resto de
        datos). Tras guardar, el usuario debe cerrar sesión y volver a entrar si aún ve módulos viejos.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Módulo</th>
              <th className="px-2 py-2 text-center">Ver</th>
              <th className="px-2 py-2 text-center">Editar</th>
              <th className="px-2 py-2 text-center">Eliminar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {APP_MODULOS_HABILITABLES.map((m) => {
              const c = map.get(m.id) ?? { modulo: m.id, ver: false, editar: false, eliminar: false };
              return (
                <tr key={m.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-semibold uppercase text-slate-800">{m.label}</td>
                  {(["ver", "editar", "eliminar"] as const).map((accion) => (
                    <td key={accion} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={c[accion]}
                        disabled={disabled}
                        onChange={(e) => setAccion(m.id, accion, e.target.checked)}
                        aria-label={`${m.label} ${accion}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function resumenCapacidades(caps: ModuloCapacidad[]): string {
  if (caps.length === 0) return "Sin módulos configurados";
  return caps
    .map((c) => {
      const label = APP_MODULOS_HABILITABLES.find((m) => m.id === c.modulo)?.label ?? c.modulo;
      const bits = [
        c.ver ? "V" : null,
        c.editar ? "E" : null,
        c.eliminar ? "X" : null,
      ].filter(Boolean);
      return `${label}(${bits.join("")})`;
    })
    .join(" · ");
}

function rolBaseDesdeSelect(value: string, rolesCatalogo: CatalogoItem[]): string {
  if (value.startsWith(ROL_CATALOGO_PREFIX)) {
    const id = value.slice(ROL_CATALOGO_PREFIX.length);
    const item = rolesCatalogo.find((r) => r.id === id);
    return item?.baseRole ?? "rh";
  }
  return parseAppRole(value) ?? "rh";
}

export function UsuariosAdminClient({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<AdminUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [soloStaff, setSoloStaff] = useState(true);
  const [crear, setCrear] = useState<FormState>(emptyCreate);
  const [editando, setEditando] = useState<AdminUsuario | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyCreate);
  const [departamentos, setDepartamentos] = useState<DepOpcion[]>(
    SGC_DEPARTAMENTOS.map((d) => ({ id: d.id, label: d.label, esBuiltin: true })),
  );
  const [rolesCatalogo, setRolesCatalogo] = useState<CatalogoItem[]>([]);
  const [nuevoDepLabel, setNuevoDepLabel] = useState("");
  const [nuevoRolLabel, setNuevoRolLabel] = useState("");
  const [nuevoRolBase, setNuevoRolBase] = useState("rh");
  const [catalogoBusy, setCatalogoBusy] = useState(false);
  const [tab, setTab] = useState<"staff" | "clientes">("staff");

  const cargarCatalogos = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/catalogos", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        departamentosOpciones?: DepOpcion[];
        roles?: CatalogoItem[];
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      if (j.departamentosOpciones?.length) setDepartamentos(j.departamentosOpciones);
      setRolesCatalogo((j.roles ?? []).filter((x) => x.activo !== false));
    } catch {
      // Mantener builtins si falla (p. ej. migración pendiente).
    }
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/usuarios", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { rows?: AdminUsuario[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setRows(j.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar usuarios.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void cargar();
      void cargarCatalogos();
    }, 0);
    return () => window.clearTimeout(t);
  }, [cargar, cargarCatalogos]);

  const filtrados = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((u) => {
      if (soloStaff && u.esClienteEnfoque) return false;
      if (!n) return true;
      return (
        u.email.includes(n) ||
        u.nombre.toLowerCase().includes(n) ||
        u.appRoleLabel.toLowerCase().includes(n) ||
        u.departamentoLabel.toLowerCase().includes(n) ||
        resumenCapacidades(u.capacidades).toLowerCase().includes(n)
      );
    });
  }, [rows, q, soloStaff]);

  function cambiarRolCrear(roleRaw: string) {
    const base = rolBaseDesdeSelect(roleRaw, rolesCatalogo);
    setCrear((s) => ({
      ...s,
      appRole: roleRaw,
      capacidades: capacidadesSugeridasParaRol(parseAppRole(base) ?? "rh"),
    }));
  }

  async function agregarDepartamento() {
    const label = nuevoDepLabel.trim();
    if (label.length < 2) {
      setError("Indique el nombre del departamento.");
      return;
    }
    setCatalogoBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "departamento", label }),
      });
      const j = (await r.json().catch(() => ({}))) as { item?: CatalogoItem; error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setNuevoDepLabel("");
      setOkMsg(`Departamento «${j.item?.label ?? label}» agregado.`);
      await cargarCatalogos();
      if (j.item?.id) {
        setCrear((s) => ({ ...s, departamento: j.item!.id }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el departamento.");
    } finally {
      setCatalogoBusy(false);
    }
  }

  async function agregarRol() {
    const label = nuevoRolLabel.trim();
    if (label.length < 2) {
      setError("Indique el nombre del rol.");
      return;
    }
    setCatalogoBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "rol", label, baseRole: nuevoRolBase }),
      });
      const j = (await r.json().catch(() => ({}))) as { item?: CatalogoItem; error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setNuevoRolLabel("");
      setOkMsg(`Rol «${j.item?.label ?? label}» agregado.`);
      await cargarCatalogos();
      if (j.item?.id) {
        cambiarRolCrear(`${ROL_CATALOGO_PREFIX}${j.item.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el rol.");
    } finally {
      setCatalogoBusy(false);
    }
  }

  async function crearUsuario() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...crear,
          capacidades: crear.capacidades,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setCrear(emptyCreate());
      setOkMsg("Usuario creado.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  function abrirEditar(u: AdminUsuario) {
    const role = u.appRole ?? "rh";
    setEditando(u);
    setEditForm({
      email: u.email,
      password: "",
      nombre: u.nombre,
      departamento: u.departamento,
      appRole: u.rolSelectValue || role,
      capacidades:
        u.capacidades.length > 0 ? u.capacidades : capacidadesSugeridasParaRol(role),
    });
    setError(null);
    setOkMsg(null);
  }

  async function guardarEdicion() {
    if (!editando) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const body: Record<string, unknown> = {
        nombre: editForm.nombre,
        departamento: editForm.departamento,
        appRole: editForm.appRole,
        capacidades: editForm.capacidades,
      };
      if (editForm.password.trim()) body.password = editForm.password.trim();

      const r = await fetch(`/api/admin/usuarios/${encodeURIComponent(editando.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setEditando(null);
      setOkMsg("Usuario actualizado.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function eliminarUsuario(u: AdminUsuario) {
    if (u.id === currentUserId) {
      setError("No puede eliminar su propia cuenta.");
      return;
    }
    if (!confirm(`¿Eliminar permanentemente a ${u.nombre || u.email}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const r = await fetch(`/api/admin/usuarios/${encodeURIComponent(u.id)}`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      if (editando?.id === u.id) setEditando(null);
      setOkMsg("Usuario eliminado.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  const crearEsAdmin = crear.appRole === "admin";
  const editEsAdmin = editForm.appRole === "admin";
  const rolesActivos = rolesCatalogo.filter((r) => r.activo !== false);

  function DepartamentoSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Según rol —</option>
        {departamentos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
            {d.esBuiltin === false ? " (nuevo)" : ""}
          </option>
        ))}
      </select>
    );
  }

  function RolSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <optgroup label="Roles del sistema">
          {ADMIN_USUARIO_ROLES.map((r) => (
            <option key={r} value={r}>
              {APP_ROLE_LABEL[r]}
            </option>
          ))}
        </optgroup>
        {rolesActivos.length > 0 ? (
          <optgroup label="Roles agregados">
            {rolesActivos.map((r) => (
              <option key={r.id} value={`${ROL_CATALOGO_PREFIX}${r.id}`}>
                {r.label}
                {r.baseRole ? ` (base: ${APP_ROLE_LABEL[r.baseRole]})` : ""}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-5 py-6 text-white shadow-sm sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">Administración</p>
        <h1 className="mt-1 text-xl font-bold uppercase tracking-wide sm:text-2xl">Usuarios</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
          Personal interno (roles y permisos) y clientes temporales por servicio con módulos configurables.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase ${
              tab === "staff" ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            onClick={() => setTab("staff")}
          >
            Personal interno
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase ${
              tab === "clientes" ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            onClick={() => setTab("clientes")}
          >
            Clientes temporales
          </button>
        </div>
      </header>

      {tab === "clientes" ? <ClientesTemporalesPanel /> : null}

      {tab === "staff" ? (
      <>
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
      {okMsg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{okMsg}</p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-black uppercase text-slate-900">Agregar departamento o rol</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Los departamentos nuevos aparecen en Usuarios, SGC e Ideas. Un rol nuevo usa un <strong>rol base</strong>{" "}
          para permisos del sistema; ajuste Ver/Editar/Eliminar por módulo al asignarlo.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <p className={labelCls}>Nuevo departamento</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={`${inputCls} mt-0 min-w-[12rem] flex-1`}
                value={nuevoDepLabel}
                onChange={(e) => setNuevoDepLabel(e.target.value)}
                placeholder="Ej. Ventas"
              />
              <button
                type="button"
                disabled={catalogoBusy || busy}
                onClick={() => void agregarDepartamento()}
                className="rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <p className={labelCls}>Nuevo rol</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                className={`${inputCls} mt-0`}
                value={nuevoRolLabel}
                onChange={(e) => setNuevoRolLabel(e.target.value)}
                placeholder="Ej. Supervisor planta"
              />
              <select
                className={`${inputCls} mt-0`}
                value={nuevoRolBase}
                onChange={(e) => setNuevoRolBase(e.target.value)}
                title="Rol base"
              >
                {ADMIN_USUARIO_ROLES.filter((r) => r !== "admin").map((r) => (
                  <option key={r} value={r}>
                    Base: {APP_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={catalogoBusy || busy}
                onClick={() => void agregarRol()}
                className="rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-bold uppercase text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-black uppercase text-slate-900">Nuevo usuario</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelCls}>Nombre</span>
            <input
              className={inputCls}
              value={crear.nombre}
              onChange={(e) => setCrear((s) => ({ ...s, nombre: e.target.value }))}
              placeholder="Nombre completo"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Correo</span>
            <input
              className={inputCls}
              type="email"
              value={crear.email}
              onChange={(e) => setCrear((s) => ({ ...s, email: e.target.value }))}
              placeholder="correo@empresa.com"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Contraseña temporal</span>
            <input
              className={inputCls}
              type="text"
              value={crear.password}
              onChange={(e) => setCrear((s) => ({ ...s, password: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Departamento</span>
            <DepartamentoSelect
              value={crear.departamento}
              onChange={(departamento) => setCrear((s) => ({ ...s, departamento }))}
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className={labelCls}>Rol</span>
            <RolSelect value={crear.appRole} onChange={cambiarRolCrear} />
          </label>
        </div>
        <div className="mt-4">
          <CapacidadesPicker
            value={crear.capacidades}
            disabled={crearEsAdmin}
            onChange={(capacidades) => setCrear((s) => ({ ...s, capacidades }))}
          />
          {crearEsAdmin ? (
            <p className="mt-2 text-[11px] text-slate-500">Administrador tiene acceso total a todos los módulos.</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void crearUsuario()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Crear usuario"}
        </button>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-800">
              Cuentas {!loading ? `(${filtrados.length})` : ""}
            </p>
            <label className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
              <input type="checkbox" checked={soloStaff} onChange={(e) => setSoloStaff(e.target.checked)} />
              Ocultar accesos temporales de cliente
            </label>
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre, correo, rol…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:max-w-xs"
          />
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Sin usuarios en el filtro.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtrados.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{u.nombre || "Sin nombre"}</p>
                  <p className="truncate text-sm text-slate-600">{u.email}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {u.appRoleLabel} · {u.departamentoLabel}
                    {u.esClienteEnfoque ? " · Cliente temporal" : ""}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    {u.appRole === "admin" ? "Permisos: todos" : resumenCapacidades(u.capacidades)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    Creado {fechaMx(u.createdAt)} · Último acceso {fechaMx(u.lastSignInAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || u.esClienteEnfoque}
                    onClick={() => abrirEditar(u)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={busy || u.id === currentUserId}
                    onClick={() => void eliminarUsuario(u)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold uppercase text-rose-900 hover:bg-rose-100 disabled:opacity-40"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editando ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditando(null)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-blue-950 px-5 py-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300">Editar usuario</p>
              <h2 className="mt-1 text-lg font-bold uppercase">{editando.email}</h2>
            </div>
            <div className="space-y-3 px-5 py-5">
              <label className="block">
                <span className={labelCls}>Nombre</span>
                <input
                  className={inputCls}
                  value={editForm.nombre}
                  onChange={(e) => setEditForm((s) => ({ ...s, nombre: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Departamento</span>
                <DepartamentoSelect
                  value={editForm.departamento}
                  onChange={(departamento) => setEditForm((s) => ({ ...s, departamento }))}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Rol</span>
                <RolSelect
                  value={editForm.appRole}
                  onChange={(roleRaw) => {
                    const base = rolBaseDesdeSelect(roleRaw, rolesCatalogo);
                    setEditForm((s) => ({
                      ...s,
                      appRole: roleRaw,
                      capacidades:
                        roleRaw === "admin"
                          ? capacidadesSugeridasParaRol("admin")
                          : s.capacidades.length > 0
                            ? s.capacidades
                            : capacidadesSugeridasParaRol(parseAppRole(base) ?? "rh"),
                    }));
                  }}
                />
              </label>
              <CapacidadesPicker
                value={editForm.capacidades}
                disabled={editEsAdmin}
                onChange={(capacidades) => setEditForm((s) => ({ ...s, capacidades }))}
              />
              <label className="block">
                <span className={labelCls}>Nueva contraseña (opcional)</span>
                <input
                  className={inputCls}
                  type="text"
                  value={editForm.password}
                  onChange={(e) => setEditForm((s) => ({ ...s, password: e.target.value }))}
                  placeholder="Dejar vacío para no cambiar"
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void guardarEdicion()}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
      ) : null}
    </div>
  );
}
