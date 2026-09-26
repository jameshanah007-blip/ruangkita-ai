import { calculate } from "./calculator";
import { webSearch } from "./webSearch";

export type JamesCapability =
  | "chat"
  | "calculator"
  | "web_search"
  | "document"
  | "planner";

export type JamesIntelligencePlan = {
  capabilities: JamesCapability[];
  primary: JamesCapability;
  researchQuery: string;
  needsResearch: boolean;
  needsMemory: boolean;
  needsExperience: boolean;
  reason: string;
};

export type JamesCapabilityResult = {
  capability: JamesCapability;
  text: string;
  status: "executed" | "delegated";
  citations?: Array<{ title: string; url: string }>;
};

function normalize(text: string) {
  return text.toLowerCase().trim();
}


function extractResearchQuery(request: string) {
  const cleaned = request
    .replace(/[“”"]/g, "")
    .replace(/s+/g, " ")
    .trim();

  const topicMatch = cleaned.match(
    /(?:tentang|mengenai|soal|mencari informasi tentang|cari informasi tentang)\s+(.+?)(?=\s+(?:lalu|kemudian|setelah itu|dan)\s+(?:buat|buatkan|susun|rangkum|tampilkan)|$)/i
  );

  const topic = (topicMatch?.[1] || cleaned)
    .replace(/^(?:tolong\s+)?(?:carikan|cari|cek)\s+(?:informasi|info|data)?\s*/i, "")
    .replace(/\b(?:terbaru|terkini|hari ini|sekarang|saat ini)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!topic) {
    return cleaned;
  }

  return `${topic} latest official documentation release`;
}

export function planJamesIntelligence(request: string): JamesIntelligencePlan {
  const text = normalize(request);
  const capabilities = new Set<JamesCapability>();

  if (
    /\d+\s*[+\-*/x×÷%]\s*\d+/.test(text) ||
    /\b(berapa hasil|hitung|berapakah|kalkulator)\b/.test(text)
  ) capabilities.add("calculator");

  if (
    /\bcarikan\b/.test(text) ||
    /\bcari(?:kan)?\b.*\b(internet|web|online|sumber|referensi|informasi|berita|lomba|beasiswa|lowongan)\b/.test(text) ||
    /\btolong\b.*\bcari\b/.test(text) ||
    /\bcek\b.*\b(terbaru|sekarang|hari ini|online|internet|web)\b/.test(text) ||
    (/\b(terbaru|terkini|hari ini|sekarang|saat ini|minggu ini|bulan ini)\b/.test(text) &&
      /\b(versi|rilis|harga|jadwal|berita|event|lomba|beasiswa|lowongan|teknologi|ai|software|aplikasi)\b/.test(text))
  ) capabilities.add("web_search");

  if (
    /\b(buatkan|buat)\b.*\b(surat|proposal|laporan|dokumen)\b/.test(text) ||
    /\bsurat (resmi|izin|undangan)\b/.test(text)
  ) capabilities.add("document");

  if (/\b(buat rencana|rencana belajar|jadwal belajar|buat jadwal|planning|rencanakan|strategi belajar)\b/.test(text)) {
    capabilities.add("planner");
  }

  if (!capabilities.size) capabilities.add("chat");

  const ordered: JamesCapability[] = [
    "calculator",
    "web_search",
    "planner",
    "document",
    "chat",
  ];
  const selected = ordered.filter((item) => capabilities.has(item));

  const reasons: string[] = [];
  if (capabilities.has("calculator")) reasons.push("perhitungan");
  if (capabilities.has("web_search")) reasons.push("informasi eksternal/terkini");
  if (capabilities.has("document")) reasons.push("pembuatan dokumen");
  if (capabilities.has("planner")) reasons.push("perencanaan");
  if (capabilities.has("chat")) reasons.push("percakapan");

  return {
    capabilities: selected,
    primary: selected[0],
    researchQuery: capabilities.has("web_search") ? extractResearchQuery(request) : "",
    needsResearch: capabilities.has("web_search"),
    needsMemory: !capabilities.has("calculator"),
    needsExperience: !capabilities.has("calculator"),
    reason: `Membutuhkan: ${reasons.join(", ")}.`,
  };
}

function extractMathExpression(request: string) {
  const expression = request
    .replace(/berapakah/gi, "")
    .replace(/berapa/gi, "")
    .replace(/hasilnya/gi, "")
    .replace(/hasil/gi, "")
    .replace(/hitung/gi, "")
    .replace(/kalkulator/gi, "")
    .replace(/sama dengan/gi, "")
    .replace(/=/g, "")
    .replace(/×/g, "*")
    .replace(/x/gi, "*")
    .replace(/÷/g, "/");

  const match = expression.match(/[\d\s+\-*/().%]+/);
  if (!match) throw new Error("Ekspresi matematika tidak ditemukan.");
  return match[0].trim();
}

export async function executeJamesCapabilities(
  plan: JamesIntelligencePlan,
  request: string,
  options?: {
    enableResearch?: boolean;
    enableCalculator?: boolean;
  }
): Promise<JamesCapabilityResult[]> {
  const results: JamesCapabilityResult[] = [];
  let accumulatedContext = "";

  for (const capability of plan.capabilities) {
    const upstreamContext = accumulatedContext
      ? `\n\nHASIL LANGKAH SEBELUMNYA:\n${accumulatedContext}`
      : "";

    if (capability === "calculator" && options?.enableCalculator !== false) {
      const text = String(calculate(extractMathExpression(request)));
      results.push({
        capability,
        status: "executed",
        text,
      });
      accumulatedContext += `\n[calculator]\n${text}`;
      continue;
    }

    if (capability === "web_search" && options?.enableResearch !== false) {
      const found = await webSearch(plan.researchQuery || request);
      const text = found.length
        ? found.map((item, index) =>
            `SUMBER ${index + 1}: ${item.title}\nURL: ${item.url}\n${item.highlights.join(" ")}`
          ).join("\n\n")
        : "Tidak ada sumber eksternal yang lolos verifikasi relevansi.";

      results.push({
        capability,
        status: "executed",
        text,
        citations: found.map((item) => ({ title: item.title, url: item.url })),
      });
      accumulatedContext += `\n[web_search]\n${text}`;
      continue;
    }

    if (capability === "planner") {
      const text = [
        "Planner execution context:",
        "Susun hasil menjadi rencana yang memiliki tujuan, langkah, prioritas, urutan kerja, dan hasil yang diharapkan.",
        `Permintaan pengguna: ${request}`,
        upstreamContext,
      ].join("\n");

      results.push({
        capability,
        status: "executed",
        text,
      });
      accumulatedContext += `\n[planner]\n${text}`;
      continue;
    }

    if (capability === "document") {
      const text = [
        "Document execution context:",
        "Siapkan dokumen siap pakai berdasarkan permintaan pengguna. Gunakan struktur yang sesuai, bahasa natural, placeholder untuk data yang belum tersedia, dan jangan mengarang data pribadi.",
        `Permintaan pengguna: ${request}`,
        upstreamContext,
      ].join("\n");

      results.push({
        capability,
        status: "executed",
        text,
      });
      accumulatedContext += `\n[document]\n${text}`;
      continue;
    }

    if (capability === "chat") {
      const text = [
        "Final conversational response should be produced by James using the available context.",
        upstreamContext,
      ].join("\n");

      results.push({
        capability,
        status: "executed",
        text,
      });
      accumulatedContext += `\n[chat]\n${text}`;
    }
  }

  return results;
}
