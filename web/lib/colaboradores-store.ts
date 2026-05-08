export type ColaboradorSnapshot = {
  noEmpleado: string;
  nombreCompleto: string;
  fechaIngreso: string;
  servicioAsignado: string;
  ultimoServicio: string;
  nss: string;
  posicion: string;
  puesto: string;
};

export type FamiliarGuardado = {
  nombreFamiliar: string;
  parentesco: string;
  fechaNacimiento: string;
  beneficiarioBancario: string;
};

/** Servicio/puesto vigentes después de alta o último MOPER (base para siguiente movimiento). */
export type MoperEstadoLinea = {
  servicio: string;
  puesto: string;
};

export type ColaboradorCompleto = ColaboradorSnapshot & {
  registeredAt: string;
  form: Record<string, string>;
  familiares: FamiliarGuardado[];
  moperActual?: MoperEstadoLinea;
};

const STORAGE_KEY = "tactical_master_colaboradores";

function normalizeNo(no: string): string {
  return no.trim().toUpperCase();
}

/** Compatibilidad con registros antiguos que solo tenían `servicio`. */
function normalizeSnapshot(raw: unknown): ColaboradorSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const no = typeof r.noEmpleado === "string" ? r.noEmpleado : "";
  if (!no) return null;
  const legacyServicio = typeof r.servicio === "string" ? r.servicio : "";
  return {
    noEmpleado: no,
    nombreCompleto: typeof r.nombreCompleto === "string" ? r.nombreCompleto : "",
    fechaIngreso: typeof r.fechaIngreso === "string" ? r.fechaIngreso : "",
    servicioAsignado:
      typeof r.servicioAsignado === "string" ? r.servicioAsignado : legacyServicio,
    ultimoServicio: typeof r.ultimoServicio === "string" ? r.ultimoServicio : "",
    nss: typeof r.nss === "string" ? r.nss : "",
    posicion: typeof r.posicion === "string" ? r.posicion : "",
    puesto: typeof r.puesto === "string" ? r.puesto : "",
  };
}

function normalizeToCompleto(raw: unknown): ColaboradorCompleto | null {
  const snap = normalizeSnapshot(raw);
  if (!snap) return null;
  const r = raw as Record<string, unknown>;
  let form: Record<string, string> = {};
  if (r.form && typeof r.form === "object" && !Array.isArray(r.form)) {
    form = Object.fromEntries(
      Object.entries(r.form as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
    );
  }
  let familiares: FamiliarGuardado[] = [];
  if (Array.isArray(r.familiares)) {
    familiares = r.familiares.map((item) => {
      const f = item as Record<string, unknown>;
      return {
        nombreFamiliar: String(f.nombreFamiliar ?? ""),
        parentesco: String(f.parentesco ?? ""),
        fechaNacimiento: String(f.fechaNacimiento ?? ""),
        beneficiarioBancario: String(f.beneficiarioBancario ?? ""),
      };
    });
  }
  let moperActual: MoperEstadoLinea | undefined;
  const ma = r.moperActual;
  if (ma && typeof ma === "object" && !Array.isArray(ma)) {
    const o = ma as Record<string, unknown>;
    moperActual = {
      servicio: String(o.servicio ?? ""),
      puesto: String(o.puesto ?? ""),
    };
  }

  return {
    ...snap,
    registeredAt: typeof r.registeredAt === "string" ? r.registeredAt : new Date().toISOString(),
    form,
    familiares,
    moperActual,
  };
}

function loadRawMap(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveRawMap(map: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function listColaboradoresCompletos(): ColaboradorCompleto[] {
  const map = loadRawMap();
  const list: ColaboradorCompleto[] = [];
  for (const v of Object.values(map)) {
    const c = normalizeToCompleto(v);
    if (c) list.push(c);
  }
  list.sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es"));
  return list;
}

export function findColaboradorCompletoByNo(noEmpleado: string): ColaboradorCompleto | null {
  const key = normalizeNo(noEmpleado);
  if (!key) return null;
  const map = loadRawMap();
  return normalizeToCompleto(map[key]) ?? null;
}

export function findColaboradorByNo(noEmpleado: string): ColaboradorSnapshot | null {
  const c = findColaboradorCompletoByNo(noEmpleado);
  if (!c) return null;
  return {
    noEmpleado: c.noEmpleado,
    nombreCompleto: c.nombreCompleto,
    fechaIngreso: c.fechaIngreso,
    servicioAsignado: c.servicioAsignado,
    ultimoServicio: c.ultimoServicio,
    nss: c.nss,
    posicion: c.posicion,
    puesto: c.puesto,
  };
}

export function upsertColaboradorCompleto(data: ColaboradorCompleto): void {
  const key = normalizeNo(data.noEmpleado);
  if (!key) return;
  const map = loadRawMap();
  const payload: ColaboradorCompleto = {
    ...data,
    noEmpleado: key,
    nombreCompleto: data.nombreCompleto.trim(),
    servicioAsignado: data.servicioAsignado.trim(),
    ultimoServicio: data.ultimoServicio.trim(),
    nss: data.nss.trim(),
    posicion: data.posicion.trim(),
    puesto: data.puesto.trim(),
    form: data.form,
    familiares: data.familiares,
    registeredAt: data.registeredAt,
    ...(data.moperActual
      ? {
          moperActual: {
            servicio: data.moperActual.servicio.trim(),
            puesto: data.moperActual.puesto.trim(),
          },
        }
      : {}),
  };
  map[key] = payload as unknown as Record<string, unknown>;
  saveRawMap(map);
}

/** @deprecated Usar upsertColaboradorCompleto; mantenido por compatibilidad con imports antiguos. */
export function upsertColaborador(snapshot: ColaboradorSnapshot): void {
  const existing = findColaboradorCompletoByNo(snapshot.noEmpleado);
  upsertColaboradorCompleto({
    ...snapshot,
    noEmpleado: snapshot.noEmpleado,
    nombreCompleto: snapshot.nombreCompleto,
    fechaIngreso: snapshot.fechaIngreso,
    servicioAsignado: snapshot.servicioAsignado,
    ultimoServicio: snapshot.ultimoServicio,
    nss: snapshot.nss,
    posicion: snapshot.posicion,
    puesto: snapshot.puesto ?? "",
    registeredAt: existing?.registeredAt ?? new Date().toISOString(),
    form: existing?.form ?? {},
    familiares: existing?.familiares ?? [],
    moperActual: existing?.moperActual,
  });
}

/** Valores mostrados como SERVICIO INICIAL / PUESTO INICIAL en MOPER (alta + últimos movimientos). */
export function getMoperInicialesParaFormulario(c: ColaboradorCompleto): MoperEstadoLinea {
  if (c.moperActual) {
    return {
      servicio:
        (
          c.moperActual.servicio.trim() ||
          c.ultimoServicio.trim() ||
          c.servicioAsignado.trim()
        ) || "",
      puesto: (c.moperActual.puesto.trim() || c.puesto.trim()) || "",
    };
  }
  return {
    servicio: (c.ultimoServicio.trim() || c.servicioAsignado.trim()) || "",
    puesto: c.puesto.trim(),
  };
}

/** Tras registrar un movimiento MOPER actualiza último servicio, puesto y línea vigente. */
export function aplicarMoperMovimiento(
  noEmpleado: string,
  cambio: {
    servicioFinal: string;
    puestoFinal: string;
  },
): ColaboradorCompleto | null {
  const c = findColaboradorCompletoByNo(noEmpleado);
  if (!c) return null;
  const servicioFi = cambio.servicioFinal.trim();
  const puestoFi = cambio.puestoFinal.trim();
  const siguiente: ColaboradorCompleto = {
    ...c,
    ultimoServicio: servicioFi || c.ultimoServicio,
    puesto: puestoFi || c.puesto,
    moperActual: {
      servicio: servicioFi || c.moperActual?.servicio || c.servicioAsignado,
      puesto: puestoFi || c.moperActual?.puesto || c.puesto,
    },
  };
  upsertColaboradorCompleto(siguiente);
  return siguiente;
}
