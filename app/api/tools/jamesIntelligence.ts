export type JamesCapability =
  | "chat"
  | "calculator"
  | "web_search"
  | "document"
  | "planner";

export type JamesIntelligencePlan = {
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

  const calculator =
    /\d+\s*[+\-*/x×÷%]\s*\d+/.test(text) ||
    /\b(berapa hasil|hitung|berapakah|kalkulator)\b/.test(text);

  if (calculator) {
    return {
      primary: "calculator",
      needsResearch: false,
      needsMemory: false,
      needsExperience: false,
      reason: "Permintaan membutuhkan perhitungan.",
    };
  }

  const explicitResearch =
    /\bcarikan\b/.test(text) ||
    /\bcari(?:kan)?\b.*\b(internet|web|online|sumber|referensi|informasi|berita|lomba|beasiswa|lowongan)\b/.test(text) ||
    /\btolong\b.*\bcari\b/.test(text) ||
    /\bcek\b.*\b(terbaru|sekarang|hari ini|online|internet|web)\b/.test(text);

  const freshness =
    /\b(terbaru|terkini|hari ini|sekarang|saat ini|minggu ini|bulan ini)\b/.test(text) &&
    /\b(versi|rilis|harga|jadwal|berita|event|lomba|beasiswa|lowongan|teknologi|ai|software|aplikasi)\b/.test(text);

  if (explicitResearch || freshness) {
    return {
      primary: "web_search",
      needsResearch: true,
      needsMemory: true,
      needsExperience: true,
      reason: "Permintaan meminta informasi eksternal atau informasi yang dapat berubah.",
    };
  }

  if (
    /\b(buatkan|buat)\b.*\b(surat|proposal|laporan|dokumen)\b/.test(text) ||
    /\bsurat (resmi|izin|undangan)\b/.test(text)
  ) {
    return {
      primary: "document",
      needsResearch: false,
      needsMemory: true,
      needsExperience: true,
      reason: "Permintaan membutuhkan pembuatan dokumen.",
    };
  }

  if (
    /\b(buat rencana|rencana belajar|jadwal belajar|buat jadwal|planning|rencanakan|strategi belajar)\b/.test(text)
  ) {
    return {
      primary: "planner",
      needsResearch: false,
      needsMemory: true,
      needsExperience: true,
      reason: "Permintaan membutuhkan perencanaan.",
    };
  }

  return {
    primary: "chat",
    needsResearch: false,
    needsMemory: true,
    needsExperience: true,
    reason: "Percakapan umum menggunakan konteks James.",
  };
}
