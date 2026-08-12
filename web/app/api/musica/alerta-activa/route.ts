import { NextResponse } from "next/server";
import { playlistActivaDelDia } from "@/lib/musica-playlist-server";

export const dynamic = "force-dynamic";

/** Playlist activa del día (aprobadas con fecha de hoy, o fallback PoC). */
export async function GET() {
  const alert = await playlistActivaDelDia();
  if (!alert) {
    return NextResponse.json({ alert: null });
  }
  return NextResponse.json({ alert });
}
