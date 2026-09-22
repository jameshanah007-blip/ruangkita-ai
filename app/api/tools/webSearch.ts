import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

export async function webSearch(query: string) {
  if (!process.env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY belum dikonfigurasi.");
  }

  if (!query.trim()) {
    throw new Error("Query pencarian kosong.");
  }

  const result = await exa.search(query.trim(), {
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