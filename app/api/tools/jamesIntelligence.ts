import { calculate } from "./calculator";
import { webSearch } from "./webSearch";
import { generateWithJamesResourceManager } from "./jamesResourceManager";

export type JamesCapability =
  | "chat"
  | "calculator"
  | "web_search"
  | "document"
  | "planner";

export type JamesIntelligencePlan = {
  confidence: number;
  planningMode: "semantic" | "deterministic";
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
  const aliases: Array<[RegExp, string]> = [
    [/\b(yg)\b/gi, "yang"],
    [/\b(dgn)\b/gi, "dengan"],
    [/\b(utk)\b/gi, "untuk"],
    [/\b(krn)\b/gi, "karena"],
    [/\b(klo|kl)\b/gi, "kalau"],
    [/\b(gk|ga|gak|ngga|nggak)\b/gi, "tidak"],
    [/\b(bgt)\b/gi, "banget"],
    [/\b(blm)\b/gi, "belum"],
    [/\b(udh|udah)\b/gi, "sudah"],
    [/\b(kmu)\b/gi, "kamu"],
    [/\b(bsa)\b/gi, "bisa"],
    [/\b(bkin)\b/gi, "bikin"],
  ];

  return aliases.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text.toLowerCase().trim()
  );
}


function extractResearchQuery(request: string) {
  const cleaned = request
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
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

function buildDeterministicPlan(request: string): JamesIntelligencePlan {
  const text = normalize(request);
  const capabilities = new Set<JamesCapability>();

  if (
    /\d+\s*[+\-*/x×÷%]\s*\d+/.test(text) ||
    /\b(berapa hasil|hitung|berapakah|kalkulator)\b/.test(text)
  ) capabilities.add("calculator");

  if (
    /\bcarikan\b/.test(text) ||
    /\bcari(?:kan)?\b.*\b(internet|web|online|sumber|referensi|informasi|berita|lomba|beasiswa|lowongan|harga|jadwal)\b/.test(text) ||
    /\b(?:cari|carikan|cek|info)\b.*\b(lomba|beasiswa|lowongan|harga|jadwal|berita|event)\b/.test(text) ||
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
    confidence: 0.55,
    planningMode: "deterministic",
    capabilities: selected,
    primary: selected[0],
    researchQuery: capabilities.has("web_search") ? extractResearchQuery(request) : "",
    needsResearch: capabilities.has("web_search"),
    needsMemory: !capabilities.has("calculator"),
    needsExperience: !capabilities.has("calculator"),
    reason: `Membutuhkan: ${reasons.join(", ")}.`,
  };
}



function extractPlannerJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function validCapability(value: unknown): value is JamesCapability {
  return value === "chat" ||
    value === "calculator" ||
    value === "web_search" ||
    value === "document" ||
    value === "planner";
}

function normalizePlannerPlan(
  parsed: Record<string, unknown>,
  request: string
): JamesIntelligencePlan | null {
  const rawCapabilities = Array.isArray(parsed.capabilities)
    ? parsed.capabilities.filter(validCapability)
    : [];

  const capabilities = [...new Set(rawCapabilities)];
  if (!capabilities.length) return null;

  const primary = validCapability(parsed.primary)
    ? parsed.primary
    : capabilities[0];

  if (!capabilities.includes(primary)) {
    capabilities.unshift(primary);
  }

  const researchQuery =
    typeof parsed.researchQuery === "string"
      ? parsed.researchQuery.trim().slice(0, 500)
      : "";

  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;

  return {
    confidence,
    planningMode: "semantic",
    capabilities,
    primary,
    researchQuery: primary === "web_search" ? (researchQuery || extractResearchQuery(request)) : "",
    needsResearch: primary === "web_search" || parsed.needsResearch === true || capabilities.includes("web_search"),
    needsMemory: parsed.needsMemory !== false,
    needsExperience: parsed.needsExperience !== false,
    reason: typeof parsed.reason === "string"
      ? parsed.reason.trim().slice(0, 500)
      : "Rencana dipilih berdasarkan pemahaman semantik.",
  };
}

export async function planJamesIntelligenceWithAI(
  request: string,
  context?: string
): Promise<JamesIntelligencePlan> {
  const deterministic = buildDeterministicPlan(request);

  try {
    const result = await generateWithJamesResourceManager("planning", {
      prompt: `
Tentukan rencana eksekusi untuk James berdasarkan permintaan pengguna.

PERMINTAAN:
${request}

KONTEKS YANG RELEVAN:
${context || "(tidak ada)"}

Pilih hanya capability yang benar-benar diperlukan:
- chat: percakapan/penjelasan biasa
- calculator: perhitungan numerik yang harus akurat
- web_search: informasi eksternal, terkini, harga, jadwal, berita, atau fakta yang perlu sumber
- document: menghasilkan surat/dokumen siap pakai
- planner: membuat rencana, jadwal, strategi, atau langkah kerja

Boleh memilih beberapa capability jika tugas memang bertahap.
Jangan memilih web_search hanya karena pengguna bertanya; gunakan jika informasi eksternal/terkini diperlukan.
Jangan memilih calculator untuk hitungan yang tidak ada.
Jika pengguna hanya bercakap-cakap, pilih chat.

Keluarkan JSON SAJA:
{
  "capabilities": ["chat"],
  "primary": "chat",
  "researchQuery": "",
  "needsResearch": false,
  "needsMemory": true,
  "needsExperience": true,
  "confidence": 0.0,
  "reason": "alasan singkat"
}
`,
      systemInstruction:
        "Kamu adalah semantic task planner untuk James. Tugasmu memilih resource yang diperlukan, bukan menjawab pengguna. Jangan membuat capability baru. Output JSON valid saja.",
      temperature: 0.1,
      maxOutputTokens: 900,
    });

    const parsed = extractPlannerJson(result.text);
    const semantic = parsed ? normalizePlannerPlan(parsed, request) : null;

    if (semantic && semantic.confidence >= 0.65) {
      return semantic;
    }
  } catch (error) {
    console.warn("James semantic planner unavailable; using deterministic planner.", error);
  }

  return deterministic;
}

export function planJamesIntelligence(request: string): JamesIntelligencePlan {
  return buildDeterministicPlan(request);
}
\nfunction extractMathExpression(request: string) {
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
      const research = await webSearch(plan.researchQuery || request);
      const text = research.results.length
        ? [
            `RESEARCH_STATUS: ${research.status.toUpperCase()}`,
            `RESEARCH_QUERY: ${research.query}`,
            research.results.map((item, index) =>
              `SUMBER ${index + 1}: ${item.title}\nURL: ${item.url}\nSOURCE_TYPE: ${item.official ? "OFFICIAL" : "GENERAL"}\nRELEVANCE: ${item.relevance.toFixed(2)}\n${item.highlights.join(" ")}`
            ).join("\n\n"),
          ].join("\n")
        : [
            `RESEARCH_STATUS: ${research.status.toUpperCase()}`,
            `RESEARCH_QUERY: ${research.query}`,
            `RESEARCH_REASON: ${research.reason || "Tidak ada sumber yang dapat digunakan."}`,
          ].join("\n");

      results.push({
        capability,
        status: "executed",
        text,
        citations: research.results.map((item) => ({ title: item.title, url: item.url })),
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
