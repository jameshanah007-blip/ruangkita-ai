import Exa from "exa-js";

let exa: Exa | null = null;

function searchTerms(query: string) {
  return [...new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3)
  )].slice(0, 20);
}

function relevanceScore(query: string, title: string, highlights: string[]) {
  const terms = searchTerms(query);
  if (!terms.length) return 0;

  const haystack = [title, ...highlights].join(" ").toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term)).length;

  return matched / terms.length;
}

function getExaClient() {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!exa) {
    exa = new Exa(apiKey);
  }

  return exa;
}

async function runSearch(exaClient: Exa, query: string) {
  const result = await exaClient.search(query.trim(), {
    type: "auto",
    numResults: 8,
    contents: {
      highlights: {
        maxCharacters: 1500,
      },
    },
  });

  return result.results
    .map((item) => {
      const title = item.title || "Tanpa judul";
      const highlights = item.highlights || [];
      const relevance = relevanceScore(query, title, highlights);
      const hostname = item.url ? new URL(item.url).hostname.toLowerCase() : "";
      const official = ["nextjs.org", "vercel.com", "react.dev", "nodejs.org", "typescriptlang.org", "github.com", "supabase.com", "openai.com", "ai.google.dev"].some((domain) => hostname === domain || hostname.endsWith("." + domain));
      const score = relevance * 0.7 + (official ? 0.3 : 0);

      return {
        title,
        url: item.url,
        highlights,
        relevance,
        official,
        score,
      };
    })
    .filter((item) => item.url && item.relevance >= 0.10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export type WebSearchResult = {
  title: string;
  url: string;
  highlights: string[];
  relevance: number;
  official: boolean;
  score: number;
};

export type WebSearchResponse = {
  status: "verified" | "unavailable" | "no_relevant_results";
  query: string;
  attemptedQueries: string[];
  results: WebSearchResult[];
  reason?: string;
};

export async function webSearch(query: string): Promise<WebSearchResponse> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("Query pencarian kosong.");
  }

  const exaClient = getExaClient();

  if (!exaClient) {
    return {
      status: "unavailable",
      query: normalizedQuery,
      attemptedQueries: [],
      results: [],
      reason: "EXA_API_KEY tidak tersedia di runtime.",
    };
  }

  const attemptedQueries = [
    normalizedQuery,
    `${normalizedQuery} official documentation`,
    `${normalizedQuery} official source`,
  ];

  let hadResponse = false;
  const collected = new Map<string, WebSearchResult>();

  for (const candidateQuery of attemptedQueries) {
    try {
      const results = await runSearch(exaClient, candidateQuery);
      hadResponse = true;

      for (const result of results) {
        if (!result.url) continue;
        const existing = collected.get(result.url);
        if (!existing || result.score > existing.score) {
          collected.set(result.url, result);
        }
      }
    } catch (error) {
      console.error("Exa research error:", error);
    }
  }

  const results = [...collected.values()].sort((a, b) => b.score - a.score).slice(0, 8);

  if (results.length > 0) {
    return { status: "verified", query: normalizedQuery, attemptedQueries, results };
  }

  return {
    status: hadResponse ? "no_relevant_results" : "unavailable",
    query: normalizedQuery,
    attemptedQueries,
    results: [],
    reason: hadResponse
      ? "Exa mengembalikan respons tetapi tidak ada hasil yang lolos verifikasi relevansi."
      : "Exa tidak memberikan respons yang dapat digunakan.",
  };
}
