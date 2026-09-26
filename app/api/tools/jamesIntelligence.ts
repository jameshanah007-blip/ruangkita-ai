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

function normalize(text: string) {
  return text.toLowerCase().trim();
}

export function planJamesIntelligence(request: string): JamesIntelligencePlan {
  const text = normalize(request);
  const capabilities = new Set<JamesCapability>();

  const calculator =
    /\d+\s*[+\-*/x×÷%]\s*\d+/.test(text) ||
    /\b(berapa hasil|hitung|berapakah|kalkulator)\b/.test(text);

  if (calculator) capabilities.add("calculator");

  const research =
    /\bcarikan\b/.test(text) ||
    /\bcari(?:kan)?\b.*\b(internet|web|online|sumber|referensi|informasi|berita|lomba|beasiswa|lowongan)\b/.test(text) ||
    /\btolong\b.*\bcari\b/.test(text) ||
    /\bcek\b.*\b(terbaru|sekarang|hari ini|online|internet|web)\b/.test(text) ||
    ( /\b(terbaru|terkini|hari ini|sekarang|saat ini|minggu ini|bulan ini)\b/.test(text) &&
      /\b(versi|rilis|harga|jadwal|berita|event|lomba|beasiswa|lowongan|teknologi|ai|software|aplikasi)\b/.test(text) );

  if (research) capabilities.add("web_search");

  const document =
    /\b(buatkan|buat)\b.*\b(surat|proposal|laporan|dokumen)\b/.test(text) ||
    /\bsurat (resmi|izin|undangan)\b/.test(text);

  if (document) capabilities.add("document");

  const planner =
    /\b(buat rencana|rencana belajar|jadwal belajar|buat jadwal|planning|rencanakan|strategi belajar)\b/.test(text);

  if (planner) capabilities.add("planner");

  if (!capabilities.size) capabilities.add("chat");

  const ordered: JamesCapability[] = [
    "calculator",
    "web_search",
    "document",
    "planner",
    "chat",
  ];

  const selected = ordered.filter((item) => capabilities.has(item));
  const primary = selected[0];

  const reasons: string[] = [];
  if (capabilities.has("calculator")) reasons.push("perhitungan");
  if (capabilities.has("web_search")) reasons.push("informasi eksternal/terkini");
  if (capabilities.has("document")) reasons.push("pembuatan dokumen");
  if (capabilities.has("planner")) reasons.push("perencanaan");
  if (capabilities.has("chat")) reasons.push("percakapan");

  return {
    capabilities: selected,
    primary,
    needsResearch: capabilities.has("web_search"),
    needsMemory: !capabilities.has("calculator"),
    needsExperience: !capabilities.has("calculator"),
    reason: `Membutuhkan: ${reasons.join(", ")}.`,
  };
}
