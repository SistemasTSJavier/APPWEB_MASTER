import { NextResponse } from "next/server";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import { serviciosLiteralesUnicosDesdeExpedientes } from "@/lib/servicios-desde-colaboradores";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditServiciosCatalogo } from "@/lib/app-role";

export const dynamic = "force-dynamic";

/** POST — inserta en `catalogo_servicios` cada servicio literal distinta que aparece en expedientes (sin borrar catalogo previo). */
export async function POST() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditServiciosCatalogo(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  let lista: ColaboradorCompleto[];
  try {
    lista = await fetchAllColaboradoresCompletos(admin);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al leer colaboradores" },
      { status: 500 },
    );
  }

  const candidatos = serviciosLiteralesUnicosDesdeExpedientes(lista);
  let inserted = 0;
  let duplicated = 0;

  for (const nombre of candidatos) {
    const { error } = await admin.from("catalogo_servicios").insert({ nombre, updated_at: new Date().toISOString() });
    if (error) {
      if (/duplicate key|unique constraint/i.test(error.message)) duplicated++;
      else if (/relation ["']public.catalogo_servicios["'] does not exist/i.test(error.message)) {
        return NextResponse.json(
          {
            error: "Tabla catalogo_servicios no existe",
            hint: "Ejecuta web/supabase/migrations/004_catalogo_servicios.sql",
          },
          { status: 503 },
        );
      } else {
        return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
      }
    } else inserted++;
  }

  return NextResponse.json({
    inserted,
    duplicated,
    totalCandidates: candidatos.length,
    expedientes: lista.length,
  });
}
