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
    "document",
    "planner",
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

  for (const capability of plan.capabilities) {
    if (capability === "calculator" && options?.enableCalculator !== false) {
      results.push({
        capability,
        status: "executed",
        text: String(calculate(extractMathExpression(request))),
      });
      continue;
    }

    if (capability === "web_search" && options?.enableResearch !== false) {
      const found = await webSearch(request);
      results.push({
        capability,
        status: "executed",
        text: found.length
          ? found.map((item, index) =>
              `SUMBER ${index + 1}: ${item.title}\nURL: ${item.url}\n${item.highlights.join(" ")}`
            ).join("\n\n")
          : "Tidak ada sumber eksternal yang lolos verifikasi relevansi.",
        citations: found.map((item) => ({ title: item.title, url: item.url })),
      });
    }

    if (capability === "planner" || capability === "document" || capability === "chat") {
      results.push({
        capability,
        status: "delegated",
        text: "Capability akan dikerjakan oleh James pada tahap final orchestration berdasarkan hasil capability sebelumnya.",
      });
    }
  }

  return results;
}
