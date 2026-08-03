"use client";

import { useState, FormEvent, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSafeLoginRedirect } from "@/lib/login-redirect";

export type LoginFormMode = "default" | "cliente";

function LoginFormInner({
  mode = "default",
  defaultNext,
}: {
  mode?: LoginFormMode;
  /** Tras login si no hay ?next= (p. ej. portal cliente). */
  defaultNext?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errParam = searchParams.get("error");
  const nextParam = searchParams.get("next");
  const esCliente = mode === "cliente";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    if (errParam === "sin_rol") {
      return "Tu cuenta no tiene rol asignado. Pide a un administrador que agregue app_role en Supabase (User metadata).";
    }
    if (errParam === "supabase_auth") {
      return "No se pudo conectar con Supabase para validar la sesión (red o configuración). Comprueba internet, que NEXT_PUBLIC_SUPABASE_URL y la anon key en .env.local coincidan con el proyecto (Project Settings → API), sin espacios ni comillas de más, y que el proyecto Supabase no esté pausado.";
    }
    return null;
  });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) {
        setError(signErr.message || "No se pudo iniciar sesion.");
        setPending(false);
        return;
      }
      const destino =
        (isSafeLoginRedirect(nextParam) && nextParam) ||
        (defaultNext && isSafeLoginRedirect(defaultNext) ? defaultNext : null) ||
        "/";
      router.replace(destino);
      router.refresh();
    } catch {
      setError("Error de conexion. Revisa la URL de Supabase y vuelve a intentar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 [-webkit-overflow-scrolling:touch]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-[8%] h-80 w-80 rounded-full bg-blue-500/30 blur-[100px]" />
        <div className="absolute -right-16 top-[35%] h-72 w-72 rounded-full bg-indigo-400/25 blur-[90px]" />
        <div className="absolute bottom-[5%] left-[15%] h-64 w-64 rounded-full bg-sky-400/20 blur-[80px]" />
        <div className="absolute bottom-[20%] right-[10%] h-56 w-56 rounded-full bg-white/10 blur-[70px]" />
        <div className="absolute left-[12%] top-[22%] h-3 w-3 rounded-full bg-white/40 shadow-[0_0_20px_rgba(255,255,255,0.35)]" />
        <div className="absolute right-[20%] top-[18%] h-2 w-2 rounded-full bg-blue-200/50 shadow-[0_0_16px_rgba(191,219,254,0.5)]" />
        <div className="absolute left-[8%] bottom-[35%] h-2.5 w-2.5 rounded-full bg-white/30" />
        <div className="absolute right-[28%] top-[48%] h-4 w-4 rounded-full bg-white/25 blur-[1px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-3 py-3 sm:px-5 sm:py-6 lg:py-10">
        <div className="mb-3 shrink-0 text-center sm:mb-5 [@media(max-height:680px)]:mb-2">
          <div className="relative mx-auto px-2 [--logo-max-h:clamp(6.5rem,min(26dvh,9.5rem),11rem)] sm:[--logo-max-h:clamp(7.5rem,min(28dvh,10.5rem),12rem)]">
            <div
              className="pointer-events-none absolute left-1/2 top-[55%] h-[clamp(2.5rem,min(14dvh,4rem),4.5rem)] w-[min(92vw,17rem)] -translate-x-1/2 -translate-y-1/2 rounded-[3rem] bg-gradient-to-r from-blue-400/35 via-white/25 to-indigo-400/30 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[clamp(4rem,min(14dvh,6rem),6rem)] w-[clamp(8rem,min(40vw,10rem),12rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white/10 blur-xl"
              aria-hidden="true"
            />
            <Image
              src="/logo.webp"
              alt="Tactical Support"
              width={280}
              height={280}
              className="relative mx-auto h-[var(--logo-max-h)] w-auto max-w-[min(55vw,14rem)] object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.5)] sm:max-w-none"
              priority
              sizes="(max-width: 640px) 45vw, 280px"
              unoptimized
            />
          </div>

          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-[0.08em] text-white sm:text-3xl sm:tracking-[0.1em] lg:text-4xl">
            TACTICAL SUPPORT
          </h1>
          <p className="mt-1 text-lg font-semibold uppercase tracking-[0.2em] text-slate-200 sm:text-xl sm:tracking-[0.28em] lg:text-2xl">
            {esCliente ? "PORTAL CLIENTE" : "INTRANET"}
          </p>

          <p className="mx-auto mt-2 max-w-xl px-1 text-[9px] font-semibold italic uppercase leading-snug tracking-[0.12em] text-blue-100/95 sm:mt-3 sm:text-[10px] sm:tracking-[0.2em] md:text-xs md:tracking-[0.22em]">
            VIVE EL HABITO DE LA EXCELENCIA
          </p>
          <p className="mx-auto mt-1.5 max-w-sm px-1 text-[10px] font-medium italic leading-snug text-slate-300/85 sm:text-xs md:text-sm [@media(max-height:640px)]:hidden">
            {esCliente
              ? "Acceso temporal con el correo y contraseña que le proporcionaron."
              : "Acceso seguro con tu correo institucional."}
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-3xl sm:p-6 lg:p-7">
          <h2 className="mb-0.5 text-center text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
            {esCliente ? "Acceso cliente" : "Iniciar sesión"}
          </h2>
          <p className="mb-3 text-center text-[10px] text-slate-400 sm:mb-4 sm:text-[11px]">
            {esCliente ? "Correo y contraseña del acceso temporal" : "Supabase Auth · correo y contraseña"}
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:gap-4">
            {error ? (
              <p
                className="rounded-lg border border-red-400/40 bg-red-950/50 px-2.5 py-2 text-center text-[11px] font-medium leading-snug text-red-100 sm:text-xs"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 sm:text-xs">
              Correo
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="rounded-xl border border-white/20 bg-slate-950/40 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/25 sm:px-4 sm:py-3"
                placeholder={esCliente ? "cliente@…" : "tu.correo@empresa.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 sm:text-xs">
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="rounded-xl border border-white/20 bg-slate-950/40 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/25 sm:px-4 sm:py-3"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <button
              type="submit"
              disabled={pending}
              className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-950/50 transition hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-55 sm:mt-2 sm:py-3.5"
            >
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-3 shrink-0 pb-1 text-center text-[9px] uppercase tracking-wider text-slate-500 sm:mt-5 sm:text-[10px]">
          {esCliente ? "Portal cliente · Tactical Support" : "Uso interno · Tactical Support Intranet"}
        </p>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 text-sm text-slate-400">
      Cargando…
    </div>
  );
}

export function LoginFormPage({
  mode = "default",
  defaultNext,
}: {
  mode?: LoginFormMode;
  defaultNext?: string;
}) {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginFormInner mode={mode} defaultNext={defaultNext} />
    </Suspense>
  );
}
