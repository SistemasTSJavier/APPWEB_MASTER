from pathlib import Path

root = Path('.')

def w(rel: str, content: str):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.lstrip('\n'), encoding='utf-8')

w('middleware.ts', r"""
import { auth } from "@/auth";

export default auth((req) => {
  const logged = !!req.auth;
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  if (!logged && !isLogin) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (logged && isLogin) {
    return Response.redirect(new URL("/empleados", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
""")

w('app/layout.tsx', r"""
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tactical Support Master",
  description: "Master de colaboradores",
};

async function Nav() {
  const session = await auth();
  if (!session) return null;
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold tracking-tight">
          Master
        </Link>
        <nav className="flex flex-wrap gap-4 text-neutral-300">
          <Link href="/empleados" className="hover:text-white">
            Colaboradores
          </Link>
          <Link href="/catalogos/puestos" className="hover:text-white">
            Puestos
          </Link>
          <Link href="/catalogos/sueldos" className="hover:text-white">
            Sueldos / servicio
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-neutral-500">{session.user?.name ?? session.user?.email}</span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
""")

actions = r""""use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstatusEmpleado } from "@prisma/client";
import { LocalForaneo, SiNo } from "@prisma/client";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseSiNo(v: FormDataEntryValue | null): SiNo | null {
  const s = v == null || v === "" ? "" : String(v);
  if (s === "SI") return SiNo.SI;
  if (s === "NO") return SiNo.NO;
  return null;
}

function parseLocal(v: FormDataEntryValue | null): LocalForaneo | null {
  const s = v == null || v === "" ? "" : String(v);
  if (s === "LOCAL") return LocalForaneo.LOCAL;
  if (s === "FORANEO") return LocalForaneo.FORANEO;
  return null;
}

export async function createEmpleado(formData: FormData) {
  await requireSession();
  const noEmpleado = String(formData.get("noEmpleado") ?? "").trim();
  const nombreCompleto = String(formData.get("nombreCompleto") ?? "").trim();
  if (!noEmpleado || !nombreCompleto) throw new Error("Número de empleado y nombre son obligatorios");

  const estatus = String(formData.get("estatusEmpleado") ?? "ACTIVO") as EstatusEmpleado;

  await prisma.$transaction(async (tx) => {
    const e = await tx.empleado.create({ data: { noEmpleado } });
    await tx.empleadoMaster.create({
      data: {
        empleadoId: e.id,
        estatusEmpleado: estatus,
        nombreCompleto,
        fechaIngreso: parseDate(formData.get("fechaIngreso")),
        servicio: String(formData.get("servicio") ?? "") || null,
        puesto: String(formData.get("puesto") ?? "") || null,
      },
    });
  });

  revalidatePath("/empleados");
  redirect("/empleados");
}

export async function updateMaster(empleadoId: string, formData: FormData) {
  await requireSession();
  const master = await prisma.empleadoMaster.findUnique({ where: { empleadoId } });
  if (!master) throw new Error("Sin ficha master");

  await prisma.empleadoMaster.update({
    where: { empleadoId },
    data: {
      estatusEmpleado: String(formData.get("estatusEmpleado") ?? master.estatusEmpleado) as EstatusEmpleado,
      fechaIngreso: parseDate(formData.get("fechaIngreso")),
      fechaBaja: parseDate(formData.get("fechaBaja")),
      envio: String(formData.get("envio") ?? "") || null,
      reyna: String(formData.get("reyna") ?? "") || null,
      reingreso: parseDate(formData.get("reingreso")),
      nombreCompleto: String(formData.get("nombreCompleto") ?? "").trim() || master.nombreCompleto,
      puesto: String(formData.get("puesto") ?? "") || null,
      puestoFinal: String(formData.get("puestoFinal") ?? "") || null,
      servicio: String(formData.get("servicio") ?? "") || null,
      servicioFinal: String(formData.get("servicioFinal") ?? "") || null,
      posicion: String(formData.get("posicion") ?? "") || null,
      localForaneo: parseLocal(formData.get("localForaneo")),
      numeroFolio: String(formData.get("numeroFolio") ?? "") || null,
    },
  });

  revalidatePath(`/empleados/${empleadoId}`);
  revalidatePath("/empleados");
}

export async function upsertIdentidad(empleadoId: string, formData: FormData) {
  await requireSession();
  let edad = formData.get("edad") ? parseInt(String(formData.get("edad")), 10) : null;
  if (edad !== null && Number.isNaN(edad)) edad = null;
  const data = {
    apellidoPaterno: String(formData.get("apellidoPaterno") ?? "") || null,
    apellidoMaterno: String(formData.get("apellidoMaterno") ?? "") || null,
    nombres: String(formData.get("nombres") ?? "") || null,
    fechaNacimiento: parseDate(formData.get("fechaNacimiento")),
    edad,
    curp: String(formData.get("curp") ?? "") || null,
    rfc: String(formData.get("rfc") ?? "") || null,
    imss: String(formData.get("imss") ?? "") || null,
    codigoPostal: String(formData.get("codigoPostal") ?? "") || null,
    estadoNatal: String(formData.get("estadoNatal") ?? "") || null,
    domicilio: String(formData.get("domicilio") ?? "") || null,
    telefono: String(formData.get("telefono") ?? "") || null,
    escolaridad: String(formData.get("escolaridad") ?? "") || null,
  };

  await prisma.empleadoIdentidad.upsert({
    where: { empleadoId },
    create: { empleadoId, ...data },
    update: data,
  });

  revalidatePath(`/empleados/${empleadoId}`);
}

export async function upsertSalud(empleadoId: string, formData: FormData) {
  await requireSession();
  const data = {
    estaturaPeso: String(formData.get("estaturaPeso") ?? "") || null,
    tipoSangre: String(formData.get("tipoSangre") ?? "") || null,
    alergicoA: String(formData.get("alergicoA") ?? "") || null,
    enfermedadTratamiento: String(formData.get("enfermedadTratamiento") ?? "") || null,
    diabetico: parseSiNo(formData.get("diabetico")),
    hipertenso: parseSiNo(formData.get("hipertenso")),
    emergenciaNombre: String(formData.get("emergenciaNombre") ?? "") || null,
    emergenciaTelefono: String(formData.get("emergenciaTelefono") ?? "") || null,
  };

  await prisma.empleadoSalud.upsert({
    where: { empleadoId },
    create: { empleadoId, ...data },
    update: data,
  });

  revalidatePath(`/empleados/${empleadoId}`);
}

export async function upsertNomina(empleadoId: string, formData: FormData) {
  await requireSession();
  const sueldoRaw = String(formData.get("sueldoMensual") ?? "").trim();
  const sueldoMensual = sueldoRaw === "" ? null : parseFloat(sueldoRaw);
  const data = {
    banco: String(formData.get("banco") ?? "") || null,
    numeroCuenta: String(formData.get("numeroCuenta") ?? "") || null,
    clabeInterbancaria: String(formData.get("clabeInterbancaria") ?? "") || null,
    sueldoMensual: sueldoMensual != null && !Number.isNaN(sueldoMensual) ? sueldoMensual : null,
    fuenteReclutamiento: String(formData.get("fuenteReclutamiento") ?? "") || null,
    gestorProceso: String(formData.get("gestorProceso") ?? "") || null,
    estudioSocioeconomico: String(formData.get("estudioSocioeconomico") ?? "") || null,
    documentacionOriginal: String(formData.get("documentacionOriginal") ?? "") || null,
  };

  await prisma.empleadoNominaReclutamiento.upsert({
    where: { empleadoId },
    create: { empleadoId, ...data },
    update: data,
  });

  revalidatePath(`/empleados/${empleadoId}`);
}

export async function addFamiliar(empleadoId: string, formData: FormData) {
  await requireSession();
  const nombre = String(formData.get("nombreFamiliar") ?? "").trim();
  if (!nombre) throw new Error("Nombre del familiar obligatorio");

  await prisma.familiar.create({
    data: {
      empleadoId,
      nombre,
      parentesco: String(formData.get("parentesco") ?? "") || null,
      fechaNacimiento: parseDate(formData.get("fechaNacimientoFamiliar")),
      beneficiarioBancario: String(formData.get("beneficiarioBancario") ?? "") === "on",
    },
  });

  revalidatePath(`/empleados/${empleadoId}`);
}

export async function deleteFamiliar(familiarId: string, empleadoId: string) {
  await requireSession();
  await prisma.familiar.delete({ where: { id: familiarId } });
  revalidatePath(`/empleados/${empleadoId}`);
}

export async function addHistorialMoper(empleadoId: string, formData: FormData) {
  await requireSession();
  const servicioDestino = String(formData.get("servicioDestino") ?? "").trim();
  if (!servicioDestino) throw new Error("Servicio destino obligatorio");

  const fechaMovimiento = parseDate(formData.get("fechaMovimiento")) ?? new Date();
  const servicioOrigen = String(formData.get("servicioOrigen") ?? "") || null;
  const motivo = String(formData.get("motivoMoper") ?? "") || null;
  const folioReferencia = String(formData.get("folioReferencia") ?? "") || null;
  const session = await auth();
  const registradoPor = session?.user?.name ?? session?.user?.email ?? "sistema";

  await prisma.$transaction(async (tx) => {
    await tx.historialMoper.create({
      data: {
        empleadoId,
        fechaMovimiento,
        servicioOrigen,
        servicioDestino,
        motivo,
        folioReferencia,
        registradoPor,
      },
    });
    await tx.empleadoMaster.update({
      where: { empleadoId },
      data: {
        servicio: servicioDestino,
        servicioFinal: servicioDestino,
      },
    });
  });

  revalidatePath(`/empleados/${empleadoId}`);
  revalidatePath("/empleados");
}

export async function createPuesto(formData: FormData) {
  await requireSession();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Nombre de puesto obligatorio");
  await prisma.puesto.create({ data: { nombre } });
  revalidatePath("/catalogos/puestos");
}

export async function deletePuesto(id: string) {
  await requireSession();
  await prisma.puesto.delete({ where: { id } });
  revalidatePath("/catalogos/puestos");
}

export async function createSueldoServicio(formData: FormData) {
  await requireSession();
  const servicio = String(formData.get("servicio") ?? "").trim();
  const puesto = String(formData.get("puesto") ?? "").trim();
  const sueldo = parseFloat(String(formData.get("sueldo") ?? "0"));
  if (!servicio || !puesto || Number.isNaN(sueldo)) throw new Error("Datos inválidos");

  await prisma.sueldoServicio.create({
    data: {
      servicio,
      puesto,
      sueldo,
      fechaUltimaActualizacion: parseDate(formData.get("fechaUltimaActualizacion")) ?? new Date(),
    },
  });
  revalidatePath("/catalogos/sueldos");
}

export async function deleteSueldoServicio(id: string) {
  await requireSession();
  await prisma.sueldoServicio.delete({ where: { id } });
  revalidatePath("/catalogos/sueldos");
}
"""
w('app/empleados/actions.ts', actions)

print('phase2 core ok')
