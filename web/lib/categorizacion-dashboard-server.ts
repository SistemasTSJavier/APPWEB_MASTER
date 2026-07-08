import {
  etiquetaNivel,
  etiquetaPaquete,
  nivelDesdePromedio,
  paqueteDesdePromedio,
  promedioGeneralCategorizacion,
} from "@/lib/categorizacion-calificaciones";
import type { CatDashboardEmpleado, CatDashboardPayload } from "@/lib/categorizacion-dashboard-types";
import { parseFechaIngresoYmd, textoTiempoEnEmpresa } from "@/lib/categorizacion-tenure";
import type { CatPersonalRow } from "@/lib/categorizacion-types";
import {
  contarFaltasMesDesdeCuadricula,
  etiquetaFaltasMes,
  faltasMesParaEmpleado,
  mesCalendarioActualYm,
} from "@/lib/categorizacion-faltas-cuadricula";
import {
  activosCategorizacionDesdeColaboradores,
  buildResumenCategorizacion,
  listCatEvaluacionesModulo,
  listCatPersonal,
  loadMapasPromedioOperaciones,
  promedioOperacionesParaEmpleado,
  promediosCapacitacionPorEmpleados,
} from "@/lib/categorizacion-server";
import { listLogosServicioDashboard } from "@/lib/cat-dashboard-logo-servicio";
import { fechaIngresoNormalizadaColaborador } from "@/lib/colaboradores-baja";
import { servicioClaveFiltroCat } from "@/lib/categorizacion-filtros-servicio";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import { textoEdadDesdeExpediente } from "@/lib/edad-desde-nacimiento";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { FICHA_FOTO_FORM_KEY } from "@/lib/ficha-tecnica-keys";
import { mapaFotosStoragePorEmpleado } from "@/lib/cat-fotos-storage";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function rhDetalle(
  scores: Record<string, number>,
  faltas: { total: number; fechas: string[] },
  mesYm: string,
): CatDashboardEmpleado["rh"] {
  const pick = (key: string) => {
    const v = scores[key];
    return v != null && Number.isFinite(v) ? v : null;
  };
  return {
    faltasMesActual: faltas.total,
    faltasMesDetalle: etiquetaFaltasMes(faltas),
    faltasMesYm: mesYm,
    rotacionServicios: pick("rotacion_servicios"),
    actasAdministrativas: pick("actas_administrativas"),
  };
}

function fechaIngresoEfectiva(p: CatPersonalRow, colab: ColaboradorCompleto | undefined): string {
  const desdePersonal = parseFechaIngresoYmd(p.fechaIngreso);
  if (desdePersonal) return desdePersonal;
  if (colab) {
    const desdeColab = fechaIngresoNormalizadaColaborador(colab);
    if (desdeColab) return desdeColab;
  }
  return "";
}

function enriquecerDesdeColaborador(p: CatPersonalRow, colab: ColaboradorCompleto | undefined): CatPersonalRow {
  if (!colab) return p;
  const f = colab.form ?? {};
  return {
    ...p,
    fechaIngreso: fechaIngresoEfectiva(p, colab),
    nombre: p.nombre || String(colab.nombreCompleto ?? "").trim(),
    servicio:
      p.servicio ||
      servicioLineaColaborador(colab) ||
      String(colab.servicioAsignado ?? f.servicio ?? colab.ultimoServicio ?? "").trim(),
    puesto: p.puesto || String(colab.puesto ?? f.puesto ?? "").trim(),
    edad: p.edad || textoEdadDesdeExpediente(f.fechaNacimiento, f.edad) || String(f.edad ?? "").trim(),
    escolaridad: p.escolaridad || String(f.escolaridad ?? "").trim(),
  };
}

export async function buildCategorizacionDashboard(admin?: SupabaseClient | null): Promise<CatDashboardPayload> {
  const client =
    admin ?? (isSupabaseServerConfigured() ? createSupabaseServiceRoleClient() : null);

  if (!client) {
    return { empleados: [], servicios: [], generadoEn: new Date().toISOString(), logosServicio: {} };
  }

  const mesYm = mesCalendarioActualYm();

  const [colaboradores, rhList, faltasMes, opMapas, personalCat, enList, capProms, logosServicio] =
    await Promise.all([
    fetchAllColaboradoresCompletos(client),
    listCatEvaluacionesModulo("recursos_humanos", client),
    contarFaltasMesDesdeCuadricula(client, mesYm).catch(() => ({ mesYm, faltas: {} as Record<string, never> })),
    loadMapasPromedioOperaciones(client),
    listCatPersonal(client),
    listCatEvaluacionesModulo("enfoque_cliente", client),
    promediosCapacitacionPorEmpleados(client),
    listLogosServicioDashboard(client),
  ]);

  const activos = activosCategorizacionDesdeColaboradores(colaboradores);
  activos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const resumen = await buildResumenCategorizacion(client, {
    opMapas,
    activos,
    personalCat,
    rhList,
    enList,
    capProms,
  });

  const personal: CatPersonalRow[] = activos.map((a) => ({
    noEmpleado: a.noEmpleado,
    periodoEvaluacion: "",
    fechaIngreso: "",
    nombre: a.nombre,
    servicio: a.servicio,
    puesto: a.puesto,
    fechaNacimiento: "",
    edad: "",
    escolaridad: "",
    estatus: "ACTIVO",
    fechaBaja: "",
  }));
  const colabMap = new Map(colaboradores.map((c) => [c.noEmpleado.trim().toUpperCase(), c]));
  const activosMap = new Map(activos.map((a) => [a.noEmpleado.trim().toUpperCase(), a]));

  // Índice de fotos en Storage: respaldo para expedientes sin URL guardada.
  const fotosStorage = await mapaFotosStoragePorEmpleado(
    client,
    personal.map((p) => p.noEmpleado),
  ).catch(() => new Map<string, string>());
  const resumenMap = new Map(resumen.map((r) => [r.noEmpleado.trim().toUpperCase(), r]));
  const rhMap = new Map(rhList.map((r) => [r.noEmpleado.trim().toUpperCase(), r.scores]));

  const serviciosSet = new Set<string>();
  const empleados: CatDashboardEmpleado[] = personal.map((pRaw) => {
    const colab = colabMap.get(pRaw.noEmpleado.trim().toUpperCase());
    const p = enriquecerDesdeColaborador(pRaw, colab);
    const key = p.noEmpleado.trim().toUpperCase();
    const r = resumenMap.get(key);
    const servicio = p.servicio.trim() || "SIN SERVICIO";
    serviciosSet.add(servicioClaveFiltroCat(servicio) || servicio);
    const activo = activosMap.get(key);
    const planta = String(activo?.planta ?? colab?.form?.planta ?? "").trim();

    const fechaIngreso = fechaIngresoEfectiva(p, colab);

    const promedioRh = r?.promedioRh ?? null;
    const promedioCapacitacion = r?.promedioCapacitacion ?? null;
    const promedioOperaciones = promedioOperacionesParaEmpleado(p.noEmpleado, p.puesto, opMapas);
    const promedioEnfoque = r?.promedioEnfoque ?? null;
    const promedioGeneral = promedioGeneralCategorizacion([
      promedioRh,
      promedioCapacitacion,
      promedioOperaciones,
      promedioEnfoque,
    ]);
    const promedioGraficaModulos = promedioGeneralCategorizacion([
      promedioCapacitacion,
      promedioOperaciones,
      promedioEnfoque,
    ]);

    const faltas = faltasMesParaEmpleado(faltasMes.faltas, key);
    const fotoExpediente = colab ? String(colab.form?.[FICHA_FOTO_FORM_KEY] ?? "").trim() : "";
    const fotoUrl = fotoExpediente || fotosStorage.get(key) || null;

    return {
      noEmpleado: p.noEmpleado,
      nombre: p.nombre,
      servicio,
      planta,
      puesto: p.puesto,
      periodoEvaluacion: p.periodoEvaluacion,
      fechaIngreso,
      tiempoEnEmpresa: textoTiempoEnEmpresa(fechaIngreso),
      edad: p.edad,
      escolaridad: p.escolaridad,
      promedioRh,
      promedioCapacitacion,
      promedioOperaciones,
      promedioEnfoque,
      promedioGraficaModulos,
      promedioGeneral,
      nivel: etiquetaNivel(promedioGeneral),
      paquete: etiquetaPaquete(promedioGeneral),
      nivelId: nivelDesdePromedio(promedioGeneral),
      paqueteId: paqueteDesdePromedio(promedioGeneral),
      faltasMesActual: faltas.total,
      faltasMesDetalle: etiquetaFaltasMes(faltas),
      faltasMesYm: faltasMes.mesYm,
      rh: rhDetalle(rhMap.get(key) ?? {}, faltas, faltasMes.mesYm),
      fotoUrl,
    };
  });

  empleados.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  return {
    empleados,
    servicios: [...serviciosSet].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    generadoEn: new Date().toISOString(),
    logosServicio,
  };
}
