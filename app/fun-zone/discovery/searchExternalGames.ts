import Exa from "exa-js";

export type DiscoveredExternalGame = {
  id: string;
  name: string;
  provider: string;
  url: string;
  imageUrl: string | null;
  description: string;
  source: string;
};

const SOURCES = [
  { domain: "poki.com", name: "Poki" },
  { domain: "crazygames.com", name: "CrazyGames" },
  { domain: "games.co.id", name: "Games.co.id" },
  { domain: "playhop.com", name: "Playhop" },
  { domain: "itch.io", name: "itch.io" },
  { domain: "newgrounds.com", name: "Newgrounds" },
  { domain: "gamepix.com", name: "GamePix" },
  { domain: "y8.com", name: "Y8" },
  { domain: "lagged.com", name: "Lagged" },
  { domain: "armorgames.com", name: "Armor Games" },
  { domain: "kongregate.com", name: "Kongregate" },
  { domain: "silvergames.com", name: "SilverGames" },
  { domain: "gameflare.com", name: "Gameflare" },
  { domain: "gamejolt.com", name: "Game Jolt" },
  { domain: "miniclip.com", name: "Miniclip" },
] as const;

function providerFor(hostname: string) {
  return SOURCES.find(({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function cleanText(value: string, max = 320) {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, max);
}

async function readExternalThumbnail(pageUrl: string): Promise<string | null> {
  try {
    const url = new URL(pageUrl);
    if (url.protocol !== "https:" || !providerFor(url.hostname.toLowerCase())) return null;
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "user-agent": "RuangKitaGameDiscovery/1.0 (+https://ruangkita.vercel.app)" },
      redirect: "manual",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return null;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 1_000_000 || !response.body) return null;

    // Do not trust Content-Length alone: some hosts omit it or stream more bytes
    // than advertised. Read at most 1 MB so metadata lookup cannot buffer an
    // arbitrarily large external page into the serverless function.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytesRead = 0;
    try {
      while (bytesRead < 1_000_000) {
        const { done, value } = await reader.read();
        if (done) break;
        const remaining = 1_000_000 - bytesRead;
        const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
        bytesRead += chunk.byteLength;
        html += decoder.decode(chunk, { stream: true });
        if (chunk.byteLength < value.byteLength) break;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    html += decoder.decode();
    const match = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    if (!match?.[1]) return null;
    const image = new URL(match[1].replace(/&amp;/g, "&"), url);
    if (image.protocol !== "https:") return null;
    return image.toString();
  } catch {
    return null;
  }
}

export async function searchExternalGames(prompt: string): Promise<{
  status: "live_search" | "unavailable" | "no_results";
  games: DiscoveredExternalGame[];
  sources: string[];
  message?: string;
}> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return {
      status: "unavailable",
      games: [],
      sources: [],
      message: "Pencarian eksternal langsung belum tersedia karena EXA_API_KEY belum dikonfigurasi.",
    };
  }

  const exa = new Exa(apiKey);
  const query = `Find specific free browser-playable 2D games that best match this user request: ${prompt}. Search broadly across the web, including reputable game portals such as Poki, CrazyGames, Games.co.id, Playhop, itch.io, Newgrounds, GamePix, Y8 and other relevant sources. Return individual game pages, not category pages, news, reviews, or articles.`;
  try {
    const response = await exa.search(query, {
      type: "auto",
      numResults: 10,
      systemPrompt: "Prefer established game portals and official developer game pages. Return playable browser games, not articles or download mirrors. Exclude gambling, adult content, malware, and suspicious download sites.",
      contents: { highlights: { maxCharacters: 900 } },
    });
    const seen = new Set<string>();
    const candidates: DiscoveredExternalGame[] = [];

    for (const item of response.results) {
      if (!item.url || !item.title) continue;
      let url: URL;
      try { url = new URL(item.url); } catch { continue; }
      const provider = providerFor(url.hostname.toLowerCase());
      if (url.protocol !== "https:") continue;
      if (/\/(?:tag|category|categories|search|2d|2-player|2-pemain)\/?(?:$|\?)/i.test(url.pathname)) continue;
      const key = url.toString().split("#")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      const description = cleanText((item.highlights || []).join(" "));
      candidates.push({
        id: key,
        name: cleanText(item.title, 100),
        provider: provider?.name ?? url.hostname.replace(/^www\./, ""),
        url: key,
        imageUrl: null,
        description: description || `Buka halaman game ini di ${provider?.name ?? url.hostname} untuk melihat detail dan cara bermain.`,
        source: provider?.domain ?? url.hostname.replace(/^www\./, ""),
      });
      if (candidates.length >= 10) break;
    }

    const games = await Promise.all(candidates.map(async (game) => ({
      ...game,
      imageUrl: await readExternalThumbnail(game.url),
    })));
    return games.length
      ? { status: "live_search", games, sources: [...new Set(games.map((game) => game.source))] }
      : { status: "no_results", games: [], sources: [], message: "Belum ada halaman game individual yang cocok dari sumber yang diizinkan. Coba jelaskan genre atau gaya game lebih spesifik." };
  } catch (error) {
    console.error("External game search failed:", error instanceof Error ? error.message : error);
    return { status: "unavailable", games: [], sources: [], message: "Pencarian eksternal sementara tidak tersedia. Coba lagi nanti." };
  }
}
