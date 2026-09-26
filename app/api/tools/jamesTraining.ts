import { generateWithAIRouter, generateWithAllAIProviders } from "../../fun-zone/aiRouter";
import type { JamesEvolutionProposal } from "./jamesEvolution";

function normalizeTrainingText(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\\s+/g, " ")
    .replace(/\\b(gk|ga|gak|nggak|ngga)\\b/g, "tidak")
    .replace(/\\b(yg)\\b/g, "yang")
    .replace(/\\b(dgn)\\b/g, "dengan")
    .replace(/\\b(utk)\\b/g, "untuk")
    .replace(/\\b(klo|kl)\\b/g, "kalau")
    .replace(/\\b(bgt)\\b/g, "banget")
    .trim();
}

export function isJamesTrainingInstruction(request: string) {
  const text = normalizeTrainingText(request);
  return /(?:saya ingin mengajarkan|saya mau mengajarkan|ajarkan|ajari|mulai sekarang|mulai saat ini|mulai besok|ke depan|ubah cara kamu|ubah cara james|saya ingin kamu belajar|jadikan ini aturan|jadikan kebiasaan|biasakan kamu|ingat ini|catat ini|setiap kali|kalau saya)/i.test(text) &&
    /(?:james|kamu|cara bicara|cara menjawab|jawab|belajar|ingat|aturan|kebiasaan|jangan|harus|gunakan|pakai|respon|menjawab)/i.test(text);
}

function containsSourceExcerpt(request: string, excerpt: string) {
  const source = normalizeTrainingText(request);
  const candidate = normalizeTrainingText(excerpt);
  if (!candidate) return false;
  if (source.includes(candidate)) return true;

  // Provider may normalize punctuation/spacing while preserving the user's words.
  const sourceWords = source.split(/\\s+/).filter(Boolean);
  const candidateWords = candidate.split(/\\s+/).filter(Boolean);
  if (candidateWords.length < 2 || candidateWords.length > sourceWords.length) return false;

  for (let i = 0; i <= sourceWords.length - candidateWords.length; i++) {
    const window = sourceWords.slice(i, i + candidateWords.length).join(" ");
    if (window === candidate) return true;
  }

  return false;
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
    "Jika bahasa informal, singkatan, typo, atau kalimat tidak lengkap tetapi maksudnya jelas, pahami maksudnya dari konteks.",
    "INSTRUKSI OMANTO:",
    request
  ].join("\n");

  const providerResults = await generateWithAllAIProviders({
    prompt,
    systemInstruction: "Keluarkan JSON valid saja. Jangan mengarang isi instruksi Omanto.",
    temperature: 0.1,
    maxOutputTokens: 1800,
  });

  const proposals: JamesEvolutionProposal[] = [];

  for (const result of providerResults) {
    const parsed = extractJson(result.text);
    if (!parsed || typeof parsed !== "object") continue;

    const rawProposals = (parsed as Record<string, unknown>).proposals;
    const items: unknown[] = Array.isArray(rawProposals) ? rawProposals : [];

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
        containsSourceExcerpt(request, proposal.source_excerpt)
      ) {
        proposals.push(proposal);
      }
    }
  }

  // Prefer an interpretation supported by at least two provider outputs.
  // If only one provider is available, keep its validated proposal so a
  // temporary provider outage does not disable Omanto's learning command.
  const groups = new Map<string, JamesEvolutionProposal[]>();

  for (const proposal of proposals) {
    const key = [
      proposal.category,
      proposal.key.toLowerCase(),
      proposal.value.toLowerCase(),
    ].join("::");
    const group = groups.get(key) || [];
    group.push(proposal);
    groups.set(key, group);
  }

  const ranked = [...groups.values()].sort((a, b) => {
    const support = b.length - a.length;
    if (support !== 0) return support;
    return Math.max(...b.map((item) => item.confidence)) -
      Math.max(...a.map((item) => item.confidence));
  });

  return ranked
    .filter((group) => providerResults.length < 2 || group.length >= 2)
    .map((group) =>
      group.reduce((best, item) =>
        item.confidence > best.confidence ? item : best
      )
    )
    .slice(0, 3);
}
