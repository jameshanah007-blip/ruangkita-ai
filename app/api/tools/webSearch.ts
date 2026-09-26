import Exa from "exa-js";

let exa: Exa | null = null;

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

  return result.results.map((item) => ({
    title: item.title || "Tanpa judul",
    url: item.url,
    highlights: item.highlights || [],
  }));
}
