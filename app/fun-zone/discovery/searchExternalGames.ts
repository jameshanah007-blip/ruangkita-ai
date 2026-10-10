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

async function verifyPlayableGamePage(pageUrl: string): Promise<boolean> {
  try {
    const url = new URL(pageUrl);
    // Only inspect pages on known game platforms; do not fetch arbitrary URLs
    // returned by search, which could expose internal network resources.
    if (url.protocol !== "https:" || !providerFor(url.hostname.toLowerCase())) return false;
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "user-agent": "RuangKitaGameDiscovery/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(2500),
    });
    if (response.status < 200 || response.status >= 300) return false;
    if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) return false;
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > 256_000 || !response.body) return false;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytesRead = 0;
    try {
      while (bytesRead < 256_000) {
        const { done, value } = await reader.read();
        if (done) break;
        const remaining = 256_000 - bytesRead;
        const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
        bytesRead += chunk.byteLength;
        html += decoder.decode(chunk, { stream: true });
        if (chunk.byteLength < value.byteLength) break;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    html += decoder.decode();

    // Require individual-game evidence, not just a reachable category/article page.
    const hasGameEvidence =
      /<meta[^>]+(?:property|name)=["']og:type["'][^>]+content=["'](?:game|product)["']/i.test(html) ||
      /<(?:canvas|iframe)\b/i.test(html) ||
      /\b(play game|play now|play online|mainkan sekarang|start game|launch game)\b/i.test(html) ||
      /(?:game[_-]?id|game[_-]?url|game[_-]?embed|playable[_-]?game)/i.test(html);
    const looksLikeNonGamePage = /\b(category|categories|tag|search results|game reviews|gaming news)\b/i.test(url.pathname);
    return hasGameEvidence && !looksLikeNonGamePage;
  } catch {
    return false;
  }
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

type RawSearchResult = { title?: string; url?: string; description?: string; highlights?: string[] };
type SearchAttempt = { provider: "Exa" | "Brave"; results: RawSearchResult[]; error?: string };

async function searchWithExa(prompt: string): Promise<SearchAttempt> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return { provider: "Exa", results: [], error: "EXA_API_KEY is not configured" };
  try {
    const exa = new Exa(apiKey);
    const query = \`Find specific free browser-playable 2D games that best match this user request: \${prompt}. Search broadly across the web, including reputable game portals such as Poki, CrazyGames, Games.co.id, Playhop, itch.io, Newgrounds, GamePix, Y8 and other relevant sources. Return individual game pages, not category pages, news, reviews, or articles.\`;
    const response = await exa.search(query, {
      type: "auto",
      numResults: 20,
      systemPrompt: "Prefer established game portals and official developer game pages. Return playable browser games, not articles or download mirrors. Exclude gambling, adult content, malware, and suspicious download sites.",
      contents: { highlights: { maxCharacters: 900 } },
    });
    return {
      provider: "Exa",
      results: response.results.map((item) => ({
        title: item.title,
        url: item.url,
        highlights: item.highlights || [],
      })),
    };
  } catch (error) {
    console.error("Exa game search failed:", error instanceof Error ? error.message : error);
    return { provider: "Exa", results: [], error: "Exa search failed" };
  }
}

async function searchWithBrave(prompt: string): Promise<SearchAttempt> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return { provider: "Brave", results: [], error: "BRAVE_SEARCH_API_KEY is not configured" };
  try {
    const query = \`free browser game \${prompt} playable online 2D game site:poki.com OR site:crazygames.com OR site:games.co.id OR site:playhop.com OR site:itch.io OR site:newgrounds.com OR site:gamepix.com OR site:y8.com OR site:lagged.com\`;
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query.slice(0, 600));
    url.searchParams.set("count", "20");
    url.searchParams.set("country", "ID");
    url.searchParams.set("search_lang", "en");
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-subscription-token": apiKey,
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) {
      console.error("Brave game search returned HTTP", response.status);
      return { provider: "Brave", results: [], error: \`Brave search returned HTTP \${response.status}\` };
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("web" in data)) {
      return { provider: "Brave", results: [], error: "Brave response had no web results" };
    }
    const web = (data as { web?: { results?: unknown } }).web;
    const rows = Array.isArray(web?.results) ? web.results : [];
    return {
      provider: "Brave",
      results: rows.flatMap((row): RawSearchResult[] => {
        if (!row || typeof row !== "object") return [];
        const item = row as { title?: unknown; url?: unknown; description?: unknown };
        if (typeof item.title !== "string" || typeof item.url !== "string") return [];
        return [{
          title: item.title,
          url: item.url,
          description: typeof item.description === "string" ? item.description : "",
        }];
      }),
    };
  } catch (error) {
    console.error("Brave game search failed:", error instanceof Error ? error.message : error);
    return { provider: "Brave", results: [], error: "Brave search failed" };
  }
}

function toCandidates(results: RawSearchResult[]): DiscoveredExternalGame[] {
  const seen = new Set<string>();
  const candidates: DiscoveredExternalGame[] = [];
  for (const item of results) {
    if (!item.url || !item.title) continue;
    let url: URL;
    try { url = new URL(item.url); } catch { continue; }
    const provider = providerFor(url.hostname.toLowerCase());
    // Only accepted portals can be verified or shown. This also prevents arbitrary
    // search results from consuming candidate slots or being fetched server-side.
    if (url.protocol !== "https:" || !provider) continue;
    if (/\/(?:tag|category|categories|search|2d|2-player|2-pemain)\/?(?:$|\?)/i.test(url.pathname)) continue;
    const key = url.toString().split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const description = cleanText([...(item.highlights || []), item.description || ""].join(" "));
    candidates.push({
      id: key,
      name: cleanText(item.title, 100),
      provider: provider.name,
      url: key,
      imageUrl: null,
      description: description || \`Buka halaman game ini di \${provider.name} untuk melihat detail dan cara bermain.\`,
      source: provider.domain,
    });
    if (candidates.length >= 20) break;
  }
  return candidates;
}

async function verifyAndDiversify(candidates: DiscoveredExternalGame[]): Promise<DiscoveredExternalGame[]> {
  const verified = await Promise.all(
    candidates.map(async (game) => (await verifyPlayableGamePage(game.url) ? game : null)),
  );
  const playable = verified.filter((game): game is DiscoveredExternalGame => game !== null);
  const byProvider = new Map<string, DiscoveredExternalGame[]>();
  for (const game of playable) {
    const group = byProvider.get(game.provider) ?? [];
    group.push(game);
    byProvider.set(game.provider, group);
  }
  const diversified: DiscoveredExternalGame[] = [];
  const providerQueues = [...byProvider.values()];
  while (diversified.length < 10 && providerQueues.some((queue) => queue.length > 0)) {
    for (const queue of providerQueues) {
      if (queue.length && diversified.length < 10) diversified.push(queue.shift()!);
    }
  }
  if (diversified.length > 1) {
    const rotation = Math.floor(Math.random() * diversified.length);
    diversified.push(...diversified.splice(0, rotation));
  }
  return diversified;
}

export async function searchExternalGames(prompt: string): Promise<{
  status: "live_search" | "unavailable" | "no_results";
  games: DiscoveredExternalGame[];
  sources: string[];
  message?: string;
  searchProvider?: "Exa" | "Brave" | "none";
}> {
  // Primary search uses Exa; independent Brave Search API is attempted when Exa
  // is unconfigured, errors, returns no candidates, or candidates fail page checks.
  const primary = await searchWithExa(prompt);
  let providerUsed: "Exa" | "Brave" | "none" = "none";
  let diversified: DiscoveredExternalGame[] = [];

  if (primary.results.length) {
    diversified = await verifyAndDiversify(toCandidates(primary.results));
    if (diversified.length) providerUsed = "Exa";
  }

  let fallback: SearchAttempt | null = null;
  if (!diversified.length) {
    fallback = await searchWithBrave(prompt);
    if (fallback.results.length) {
      diversified = await verifyAndDiversify(toCandidates(fallback.results));
      if (diversified.length) providerUsed = "Brave";
    }
  }

  if (!diversified.length) {
    const hasAnyConfiguredProvider = Boolean(process.env.EXA_API_KEY || process.env.BRAVE_SEARCH_API_KEY);
    if (!hasAnyConfiguredProvider) {
      return {
        status: "unavailable",
        games: [],
        sources: [],
        searchProvider: "none",
        message: "Pencarian langsung belum dikonfigurasi. Tambahkan EXA_API_KEY (utama) dan BRAVE_SEARCH_API_KEY (fallback) di environment Preview.",
      };
    }
    if (primary.error && fallback?.error) {
      return {
        status: "unavailable",
        games: [],
        sources: [],
        searchProvider: "none",
        message: "Pencarian eksternal utama dan cadangan sedang tidak tersedia. Katalog lokal dapat digunakan sementara; hasilnya bukan pencarian langsung.",
      };
    }
    return {
      status: "no_results",
      games: [],
      sources: [],
      searchProvider: providerUsed,
      message: "Kedua pencarian tidak menemukan halaman game dari portal yang diizinkan dan lolos pemeriksaan. Coba prompt lain; hasil yang tidak terverifikasi tidak ditampilkan.",
    };
  }

  const games = await Promise.all(diversified.map(async (game) => ({
    ...game,
    imageUrl: await readExternalThumbnail(game.url),
  })));
  return {
    status: "live_search",
    games,
    sources: [...new Set(games.map((game) => game.source))],
    searchProvider: providerUsed,
  };
}
