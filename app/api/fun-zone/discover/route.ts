import { NextResponse } from "next/server";
import { EXTERNAL_GAMES, GAME_PORTALS, resolveGameDiscovery } from "../../../fun-zone/discovery/gameCatalog";
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

    // Discovery order: Exa -> Firecrawl -> curated local catalog.
    // Failed James-generated games are intentionally excluded from this flow.
    const liveSearch = await searchExternalGames(prompt);
    const catalogDiscovery = resolveGameDiscovery(prompt);
    const localGames = EXTERNAL_GAMES
      .filter((game) => catalogDiscovery.genre === "all" || game.tags.includes(catalogDiscovery.genre))
      .map((game) => ({
        id: game.id,
        name: game.name,
        provider: game.provider,
        url: game.url,
        imageUrl: game.imageUrl,
        description: game.description,
        source: new URL(game.url).hostname.replace(/^www\\./, ""),
      }));

    // Search order: Exa -> Firecrawl -> curated external-game catalog.
    // Supplement small live result sets; failed James-generated games are never used.
    const seenUrls = new Set(liveSearch.games.map((game) => game.url));
    const catalogAdditions = localGames.filter((game) => {
      if (seenUrls.has(game.url)) return false;
      seenUrls.add(game.url);
      return true;
    });
    const useLocalCatalog = liveSearch.games.length === 0;
    const useCatalogSupplement = liveSearch.games.length > 0 && liveSearch.games.length < 6;
    const games = useLocalCatalog
      ? localGames
      : useCatalogSupplement
        ? [...liveSearch.games, ...catalogAdditions].slice(0, 10)
        : liveSearch.games;
    const usedCatalog = useLocalCatalog || games.length > liveSearch.games.length;
    const searchStatus = useLocalCatalog
      ? "local_catalog_fallback"
      : usedCatalog ? "live_search_with_catalog" : liveSearch.status;
    const sources = [...new Set(games.map((game) => game.source))];

    return NextResponse.json({
      success: true,
      discovery: {
        genre: catalogDiscovery.genre,
        label: useLocalCatalog ? "Pilihan dari katalog game lokal" : usedCatalog ? "Hasil pencarian dan katalog game" : "Hasil pencarian game",
        explanation: useLocalCatalog
          ? "Pencarian langsung tidak menghasilkan game terverifikasi. James menampilkan game dari katalog lokal yang telah dikurasi sebagai cadangan."
          : "James mencari game berdasarkan maksud prompt dan menampilkan halaman game eksternal yang lolos pemeriksaan.",
        portals: GAME_PORTALS,
        games,
        searchStatus,
        searchProvider: useLocalCatalog ? "local_catalog" : (liveSearch.searchProvider ?? "none"),
        sources,
        message: useLocalCatalog
          ? `Menampilkan ${localGames.length} game dari katalog lokal. Game ini berasal dari platform eksternal, bukan game buatan James.`
          : liveSearch.message,
      },
      mode: useLocalCatalog ? "local-catalog-fallback" : usedCatalog ? "external-search-with-catalog" : "dynamic-external-search",
      note: "Kartu katalog lokal merujuk ke game eksternal yang dikurasi. Tidak ada game buatan James yang gagal dijalankan dalam daftar fallback.",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Permintaan pencarian game tidak dapat diproses." },
      { status: 400 },
    );
  }
}
