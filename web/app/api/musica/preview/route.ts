import { NextResponse } from "next/server";
import { youtubeVideoIdFrom, youtubeWatchUrl } from "@/lib/musica-playlist";
import { fetchYoutubeOEmbed } from "@/lib/musica-playlist-server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessMusica } from "@/lib/app-role";

export const dynamic = "force-dynamic";

/** Vista previa del título al pegar un URL de YouTube. */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessMusica(auth.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(req.url).searchParams.get("url")?.trim() ?? "";
  const id = youtubeVideoIdFrom(url);
  if (!id) {
    return NextResponse.json({ error: "URL de YouTube no válida." }, { status: 400 });
  }

  const watch = youtubeWatchUrl(id);
  const meta = await fetchYoutubeOEmbed(watch);
  return NextResponse.json({
    youtubeVideoId: id,
    youtubeUrl: watch,
    titulo: meta?.titulo ?? "",
    artista: meta?.autor ?? "",
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  });
}
