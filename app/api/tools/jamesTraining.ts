import { generateWithAIRouter } from "../../fun-zone/aiRouter";
import type { JamesEvolutionProposal } from "./jamesEvolution";

export function isJamesTrainingInstruction(request: string) {
  return /(?:saya ingin mengajarkan|saya mau mengajarkan|ajarkan|ajari|mulai sekarang|mulai saat ini|ubah cara kamu|ubah cara james|saya ingin kamu belajar|jadikan ini aturan)/i.test(request.trim());
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function confidence(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export async function interpretJamesTrainingInstruction(request: string): Promise<JamesEvolutionProposal[]> {
  const prompt = [
    "Kamu adalah James Training Interpreter.",
    "Instruksi berikut datang dari Omanto yang sudah terverifikasi.",
    "Ubah instruksi menjadi maksimal 3 proposal evolution.",
    "Keluarkan JSON saja dengan bentuk {proposals:[{category,key,value,reason,confidence,source_excerpt}]}",
    'category hanya: communication_style, interest, learned_topic, lesson, preference.',
    "Hanya terima aturan komunikasi, cara kerja, pembelajaran, preferensi, atau lesson.",
    "Jangan mengubah nama James, hubungan inti dengan Omanto, identitas AI, keselamatan, source code, environment variable, credential, database schema, atau sistem keamanan.",
    "Jangan menyimpan password, token, API key, kode verifikasi, atau data sensitif.",
    "source_excerpt harus merupakan kutipan yang benar-benar muncul pada instruksi.",
    "Confidence minimal 0.80 untuk instruksi yang jelas.",
    "INSTRUKSI OMANTO:",
    request
  ].join("\n");

  const result = await generateWithAIRouter({
    prompt,
    systemInstruction: "Keluarkan JSON valid saja. Jangan mengarang isi instruksi Omanto.",
    temperature: 0.1,
    maxOutputTokens: 1800,
  });

  const parsed = extractJson(result.text);
  if (!parsed || typeof parsed !== "object") return [];

  const items = Array.isArray((parsed as Record<string, unknown>).proposals)
    ? (parsed as Record<string, unknown>).proposals
    : [];

  const accepted: JamesEvolutionProposal[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    const category = value.category;

    if (
      category !== "communication_style" &&
      category !== "interest" &&
      category !== "learned_topic" &&
      category !== "lesson" &&
      category !== "preference"
    ) continue;

    const proposal: JamesEvolutionProposal = {
      category,
      key: clean(value.key, 60),
      value: clean(value.value, 240),
      reason: clean(value.reason, 240),
      confidence: confidence(value.confidence),
      source_excerpt: clean(value.source_excerpt, 320),
    };

    if (
      proposal.key &&
      proposal.value &&
      proposal.source_excerpt &&
      proposal.confidence >= 0.80 &&
      request.toLowerCase().includes(proposal.source_excerpt.toLowerCase())
    ) {
      accepted.push(proposal);
    }
  }

  return accepted.slice(0, 3);
}
