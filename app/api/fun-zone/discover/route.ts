import { NextResponse } from "next/server";
import { resolveGameDiscovery } from "../../../fun-zone/discovery/gameCatalog";
import { searchExternalGames } from "../../../fun-zone/discovery/searchExternalGames";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const prompt =
      body && typeof body === "object" && "prompt" in body &&
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Ceritakan game yang ingin kamu mainkan." },
        { status: 400 },
      );
    }

    if (prompt.length > 500) {
      return NextResponse.json(
        { success: false, error: "Permintaan terlalu panjang. Maksimum 500 karakter." },
        { status: 413 },
      );
    }

    // The local catalog is only a fallback/portal hint. Live results are retrieved
    // from approved external game platforms for each prompt, not selected solely
    // from a fixed genre list.
    const [catalogHint, liveSearch] = await Promise.all([
      Promise.resolve(resolveGameDiscovery(prompt)),
      searchExternalGames(prompt),
    ]);

    return NextResponse.json({
      success: true,
      discovery: {
        ...catalogHint,
        games: liveSearch.games,
        searchStatus: liveSearch.status,
        sources: liveSearch.sources,
        message: liveSearch.message,
      },
      mode: liveSearch.status === "live_search" ? "dynamic-external-search" : "safe-fallback",
      note: "Game dan gambar tetap disediakan oleh platform eksternal. Hanya halaman HTTPS dari sumber game yang diizinkan yang ditampilkan.",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Permintaan pencarian game tidak dapat diproses." },
      { status: 400 },
    );
  }
}
