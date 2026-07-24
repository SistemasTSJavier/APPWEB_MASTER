"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Cierra sesión en el cliente y fuerza navegación completa a /login
 * (evita 404 / cookies a medias con form POST en local).
 */
export function SignOutButton({
  className,
  label = "Cerrar sesión",
}: {
  className?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  async function cerrarSesion() {
    if (pending) return;
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      /* igual redirigimos */
    }
    // Fallback servidor por si quedan cookies httpOnly.
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
    } catch {
      /* ignore */
    }
    window.location.assign("/login?logged_out=1");
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void cerrarSesion()}
      className={className}
    >
      {pending ? "Saliendo…" : label}
    </button>
  );
}
