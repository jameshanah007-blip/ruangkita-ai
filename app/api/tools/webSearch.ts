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

export async function webSearch(query: string) {
  if (!query.trim()) {
    throw new Error("Query pencarian kosong.");
  }

  const exaClient = getExaClient();

  if (!exaClient) {
    return [];
  }

  const result = await exaClient.search(query.trim(), {
    type: "auto",
    numResults: 5,
    contents: {
      highlights: {
        maxCharacters: 1500,
      },
    },
  });

  const candidates = result.results
    .map((item) => {
      const title = item.title || "Tanpa judul";
      const highlights = item.highlights || [];
      const relevance = relevanceScore(query, title, highlights);

      return {
        title,
        url: item.url,
        highlights,
        relevance,
      };
    })
    .filter((item) => item.url && item.relevance >= 0.10)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);

  return candidates;
}
