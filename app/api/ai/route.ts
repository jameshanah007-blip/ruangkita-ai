import { NextResponse } from "next/server";
import { calculate } from "../tools/calculator";
import { webSearch } from "../tools/webSearch";
import { logActivity } from "../tools/logActivity";
import {
  getJamesMemory,
  getJamesLongTermMemory,
  saveJamesMemoryProposals,
  saveJamesTurn,
  type JamesMemoryProposal,
} from "../tools/memory";
import {
  applyJamesEvolution,
  applyVerifiedJamesGlobalEvolution,
  getJamesGrowth,
  getRecentJamesFeedback,
  type JamesEvolutionProposal,
} from "../tools/jamesEvolution";
import {
  buildJamesMemoryContext,
  buildJamesSystemInstruction,
} from "../../ai/persona";
import { saveJamesCuriosity, type JamesCuriosityProposal } from "../tools/jamesCuriosity";
import {
  generateWithAIRouter,
  generateWithAllAIProviders,
} from "../../fun-zone/aiRouter";
import { addGlobalCandidate, getGlobalGrowth } from "../tools/jamesGlobalLearning";
import { buildJamesContext } from "../tools/jamesContext";
import { executeJamesCapabilities, planJamesIntelligence } from "../tools/jamesIntelligence";
import { isOmantoVerified } from "./verify-identity/route";
import { interpretJamesTrainingInstruction, isJamesTrainingInstruction } from "../tools/jamesTraining";
import { understandJamesInput } from "../tools/jamesInputUnderstanding";

type Intent =
  | "chat"
  | "calculator"
  | "web_search"
  | "document"
  | "planner";

type Citation = {
  title: string;
  url: string;
};

const MODEL = "gemini-3.6-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

function requestsMultiProviderKnowledge(request: string) {
  const text = request.toLowerCase();
  return /\b(?:akses|gunakan|konsultasikan|konsultasi|tanya|bandingkan|gabungkan)\b.*\b(?:gemini|openai|groq|openrouter|provider ai|ai provider)\b/i.test(text) ||
    /\b(?:gemini|openai|groq|openrouter)\b.*\b(?:akses|gunakan|konsultasikan|konsultasi|bandingkan|gabungkan)\b/i.test(text);
}

function requestsPermanentKnowledgeLearning(request: string) {
  return /\b(?:belajar|pelajari|tambahkan|simpan|jadikan pengetahuan|ingat|menambah pengetahuan|tambah pengetahuan)\b/i.test(request) &&
    /\b(?:kamu|mu|james|pengetahuan|belajar)\b/i.test(request);
}

async function callJamesAI(
  userInput: string,
  systemInstruction?: string
): Promise<string> {
  const result = await generateWithAIRouter({
    prompt: userInput,
    systemInstruction: systemInstruction || buildJamesSystemInstruction(),
    temperature: 0.7,
    maxOutputTokens: 4000,
  });

  return result.text;
}

function extractText(data: any): string {
  if (!Array.isArray(data?.steps)) return "";

  const texts: string[] = [];

  for (const step of data.steps) {
    if (step?.type !== "model_output") continue;

    const content = step?.content;

    if (typeof content === "string") {
      texts.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === "string") texts.push(item);
        if (
          item &&
          typeof item === "object" &&
          typeof item.text === "string"
        ) {
          texts.push(item.text);
        }
      }
    }
  }

  return texts.join("\n").trim();
}

function extractJsonObject(text: string) {
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function evolveJames(input: {
  userId: string;
  conversationId: string;
  userRequest: string;
  assistantResult: string;
}) {
  try {
    const recentFeedback = await getRecentJamesFeedback(
      input.userId,
      input.conversationId,
      5
    );

    const feedbackContext = recentFeedback.length
      ? recentFeedback.map((item, index) => [
          `FEEDBACK ${index + 1}`,
          `Rating: ${item.rating}`,
          `Catatan: ${item.feedback || "(tidak ada catatan)"}`,
        ].join("\n")).join("\n\n")
      : "Belum ada feedback eksplisit untuk percakapan ini.";

    const reflectionPrompt = `
Refleksikan interaksi James berikut sebagai learning engine.
Jangan menilai pengguna. Fokus pada cara James dapat menjadi lebih membantu.

USER:
${input.userRequest}

JAMES:
${input.assistantResult}

FEEDBACK PENGGUNA TERKINI:
${feedbackContext}

Gunakan feedback sebagai bukti tambahan tentang kualitas jawaban James.
Feedback bukan perintah untuk mengubah karakter James. Jika feedback tidak jelas,
jangan membuat lesson yang spesifik. Jika feedback negatif memiliki catatan,
prioritaskan catatan tersebut sebagai bukti untuk what_failed dan lesson.

Keluarkan JSON SAJA:
{
  "observation": "apa yang terjadi",
  "what_worked": "apa yang berjalan baik",
  "what_failed": "apa yang kurang",
  "lesson": "pelajaran untuk James",
  "confidence": 0.0,
  "evidence": "bukti singkat",
  "memories": [
    {
      "memory_type": "identity | preference | interest | project | goal | context | relationship",
      "memory_key": "kunci stabil",
      "memory_value": "fakta yang dapat dipakai lagi",
      "memory_action": "upsert | supersede",
      "confidence": 0.0,
      "source_excerpt": "kutipan singkat dari pengguna",
      "expires_in_days": null
    }
  ],
  "curiosity": [
    {
      "topic": "topik",
      "question": "pertanyaan yang masih perlu dipahami",
      "importance": 0.0,
      "evidence": "bukti singkat"
    }
  ],
  "proposals": [
    {
      "category": "communication_style | interest | learned_topic | lesson | preference",
      "key": "kunci",
      "value": "nilai",
      "reason": "alasan",
      "confidence": 0.0,
      "source_excerpt": "kutipan singkat"
    }
  ]
}

Aturan:
- Maksimal 3 proposals, 3 memories, dan 2 curiosity.
- Memory hanya untuk fakta eksplisit atau preferensi/tujuan yang sangat jelas dari pengguna.
- Jangan membuat memory dari dugaan, inferensi sensitif, atau isi jawaban James.
- Nama/panggilan yang secara eksplisit diberikan pengguna boleh menjadi memory identity.
- memory_action = "upsert" untuk menyimpan atau memperbarui fakta.
- memory_action = "supersede" hanya jika pengguna secara jelas menyatakan fakta lama tidak berlaku lagi.
- Jika pengguna hanya mengatakan sesuatu yang berbeda tanpa menunjukkan perubahan, jangan supersede.
- Memory confidence >= 0.80 hanya jika bukti jelas.
- expires_in_days: null untuk identity/relationship; gunakan 30-180 untuk konteks/preferensi yang dapat berubah.
- Jika tidak ada pembelajaran bermakna, gunakan array kosong.
- Confidence >= 0.70 hanya jika bukti jelas.
- Jangan menyimpan password, token, credential, nomor identitas, nomor telepon, alamat, lokasi presisi, data kesehatan, agama, politik, orientasi seksual, atau data sensitif lain.
- Jangan mendiagnosis atau menebak sifat sensitif pengguna.
- Jangan mengubah core identity James, Omanto, atau RuangKita.
- Lesson harus tentang peningkatan bantuan/komunikasi James.
`;

    const providerResults = await generateWithAllAIProviders({
      prompt: reflectionPrompt,
      systemInstruction:
        "Kamu adalah salah satu dari beberapa learning engines James. Berikan refleksi yang jujur, ringkas, berbasis bukti, dan JSON valid tanpa markdown.",
      temperature: 0.2,
      maxOutputTokens: 2500,
    });

    const parsedResults = providerResults
      .map((result) => ({
        provider: result.provider,
        model: result.model,
        data: extractJsonObject(result.text),
      }))
      .filter((item) => item.data && typeof item.data === "object");

    await saveJamesLearningRuns({
      userId: input.userId,
      conversationId: input.conversationId,
      results: providerResults,
    });

    if (!parsedResults.length) return;

    const reflection = mergeReflectionResults(parsedResults);

    const reflectionSaved = reflection
      ? await saveJamesReflection({
          userId: input.userId,
          conversationId: input.conversationId,
          observation: reflection.observation,
          whatWorked: reflection.whatWorked,
          whatFailed: reflection.whatFailed,
          lesson: reflection.lesson,
          confidence: reflection.confidence,
          evidence: reflection.evidence,
        })
      : false;

    const proposals = mergeLearningProposals(parsedResults);
    const memories = mergeMemoryProposals(parsedResults);
    const curiosity = mergeCuriosity(parsedResults);

    if (memories.length) {
      await saveJamesMemoryProposals(
        input.userId,
        input.conversationId,
        input.userRequest,
        memories
      );
    }

    if (reflectionSaved && proposals.length) {
      await applyJamesEvolution(
        input.userId,
        input.conversationId,
        input.userRequest,
        proposals,
        recentFeedback.map((item) => item.feedback).filter(Boolean)
      );
    }

    if (reflectionSaved && curiosity.length) {
      await saveJamesCuriosity(
        input.userId,
        input.conversationId,
        curiosity
      );
    }
  } catch (error) {
    console.error("James multi-provider learning error:", error);
  }
}

type JamesMergedReflection = {
  observation: string;
  whatWorked: string;
  whatFailed: string;
  lesson: string;
  confidence: number;
  evidence: string;
};

function mergeReflectionResults(
  results: Array<{ provider: string; data: Record<string, unknown> }>
): JamesMergedReflection | null {
  if (!results.length) return null;

  const fields = [
    "observation",
    "what_worked",
    "what_failed",
    "lesson",
    "evidence",
  ] as const;

  const selectField = (field: (typeof fields)[number]) => {
    const candidates = results
      .map((result) => ({
        provider: result.provider,
        value: cleanReflectionText(result.data[field], 500),
        confidence: clampReflectionConfidence(result.data.confidence),
      }))
      .filter((item) => item.value);

    if (!candidates.length) return "";

    const groups = new Map<string, typeof candidates>();
    for (const candidate of candidates) {
      const key = candidate.value.toLowerCase().replace(/\\s+/g, " ").trim();
      const group = groups.get(key) || [];
      group.push(candidate);
      groups.set(key, group);
    }

    const ranked = [...groups.values()].sort((a, b) => {
      const support = b.length - a.length;
      if (support !== 0) return support;
      return Math.max(...b.map((item) => item.confidence)) -
        Math.max(...a.map((item) => item.confidence));
    });

    const winner = ranked[0];
    if (!winner) return "";

    // Bila provider berbeda pendapat, reflection hanya memakai nilai
    // yang didukung minimal dua provider.
    if (groups.size > 1 && winner.length < 2) return "";

    return winner.reduce((best, item) =>
      item.confidence > best.confidence ? item : best
    ).value;
  };

  const observation = selectField("observation");
  const lesson = selectField("lesson");

  // Observation dan lesson adalah inti reflection. Jika keduanya tidak
  // mendapat dukungan yang cukup, jangan membuat reflection seolah-olah
  // sudah tervalidasi.
  if (!observation || !lesson) return null;

  const whatWorked = selectField("what_worked");
  const whatFailed = selectField("what_failed");
  const evidence = selectField("evidence");

  const confidenceValues = results
    .map((result) => clampReflectionConfidence(result.data.confidence))
    .filter((value) => value > 0);

  const confidence = confidenceValues.length
    ? Math.min(
        1,
        confidenceValues.reduce((sum, value) => sum + value, 0) /
          confidenceValues.length
      )
    : 0;

  return {
    observation,
    whatWorked,
    whatFailed,
    lesson,
    confidence,
    evidence,
  };
}

function mergeLearningProposals(
  results: Array<{ provider: string; data: Record<string, unknown> }>
): JamesEvolutionProposal[] {
  const candidates = new Map<string, JamesEvolutionProposal[]>();

  for (const result of results) {
    const items = Array.isArray(result.data.proposals) ? result.data.proposals : [];

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const category = item.category;

      if (
        category !== "communication_style" &&
        category !== "interest" &&
        category !== "learned_topic" &&
        category !== "lesson" &&
        category !== "preference"
      ) continue;

      const proposal: JamesEvolutionProposal = {
        category,
        key: cleanReflectionText(item.key, 60),
        value: cleanReflectionText(item.value, 240),
        reason: cleanReflectionText(item.reason, 240),
        confidence: clampReflectionConfidence(item.confidence),
        source_excerpt: cleanReflectionText(item.source_excerpt, 320),
      };

      if (!proposal.key || !proposal.value || proposal.confidence < 0.70) continue;

      const identity = `${proposal.category}:${proposal.key}`;
      const list = candidates.get(identity) || [];
      list.push(proposal);
      candidates.set(identity, list);
    }
  }

  const resolved: JamesEvolutionProposal[] = [];

  for (const proposals of candidates.values()) {
    const groups = new Map<string, JamesEvolutionProposal[]>();

    for (const proposal of proposals) {
      const value = proposal.value.toLowerCase().replace(/\\s+/g, " ").trim();
      const group = groups.get(value) || [];
      group.push(proposal);
      groups.set(value, group);
    }

    const ranked = [...groups.values()].sort((a, b) => {
      const supportDiff = b.length - a.length;
      if (supportDiff !== 0) return supportDiff;
      return b.reduce((sum, item) => sum + item.confidence, 0) -
        a.reduce((sum, item) => sum + item.confidence, 0);
    });

    const winner = ranked[0];
    if (!winner) continue;

    if (groups.size > 1 && winner.length < 2) continue;

    resolved.push(
      winner.reduce((best, item) =>
        item.confidence > best.confidence ? item : best
      )
    );
  }

  return resolved
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

function mergeMemoryProposals(
  results: Array<{ provider: string; data: Record<string, unknown> }>
): JamesMemoryProposal[] {
  const candidates = new Map<string, JamesMemoryProposal[]>();

  for (const result of results) {
    const items = Array.isArray(result.data.memories)
      ? result.data.memories
      : [];

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const memoryType = item.memory_type;

      if (
        memoryType !== "identity" &&
        memoryType !== "preference" &&
        memoryType !== "interest" &&
        memoryType !== "project" &&
        memoryType !== "goal" &&
        memoryType !== "context" &&
        memoryType !== "relationship"
      ) continue;

      const proposal: JamesMemoryProposal = {
        memory_type: memoryType,
        memory_key: cleanReflectionText(item.memory_key, 80).toLowerCase(),
        memory_value: cleanReflectionText(item.memory_value, 500),
        memory_action:
          item.memory_action === "supersede" ? "supersede" : "upsert",
        confidence: clampReflectionConfidence(item.confidence),
        source_excerpt: cleanReflectionText(item.source_excerpt, 400),
        expires_in_days:
          item.expires_in_days === null || item.expires_in_days === undefined
            ? null
            : Number(item.expires_in_days),
      };

      if (
        !proposal.memory_key ||
        !proposal.memory_value ||
        proposal.confidence < 0.80
      ) continue;

      const identity = `${proposal.memory_type}:${proposal.memory_key}`;
      const list = candidates.get(identity) || [];
      list.push(proposal);
      candidates.set(identity, list);
    }
  }

  const resolved: JamesMemoryProposal[] = [];

  for (const proposals of candidates.values()) {
    const supersede = proposals
      .filter((proposal) => proposal.memory_action === "supersede")
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (supersede) {
      resolved.push(supersede);
      continue;
    }

    const valueGroups = new Map<string, JamesMemoryProposal[]>();

    for (const proposal of proposals) {
      const key = proposal.memory_value.trim().toLowerCase();
      const group = valueGroups.get(key) || [];
      group.push(proposal);
      valueGroups.set(key, group);
    }

    const groups = [...valueGroups.values()].sort((a, b) => {
      const supportDiff = b.length - a.length;
      if (supportDiff !== 0) return supportDiff;
      return b.reduce((sum, item) => sum + item.confidence, 0) -
        a.reduce((sum, item) => sum + item.confidence, 0);
    });

    const winner = groups[0];
    const hasConflict = groups.length > 1;

    // Jika learning engines berbeda pendapat tentang fakta yang sama,
    // jangan memilih secara diam-diam. Simpan hanya jika ada dukungan
    // dari minimal dua provider untuk nilai yang sama.
    if (hasConflict && winner.length < 2) {
      continue;
    }

    if (winner?.length) {
      resolved.push(
        winner.reduce((best, item) =>
          item.confidence > best.confidence ? item : best
        )
      );
    }
  }

  return resolved
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

function mergeCuriosity(
  results: Array<{ provider: string; data: Record<string, unknown> }>
): JamesCuriosityProposal[] {
  const merged = new Map<string, JamesCuriosityProposal>();

  for (const result of results) {
    const items = Array.isArray(result.data.curiosity)
      ? result.data.curiosity
      : [];

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const proposal: JamesCuriosityProposal = {
        topic: cleanReflectionText(item.topic, 160),
        question: cleanReflectionText(item.question, 400),
        importance: clampReflectionConfidence(item.importance),
        evidence: cleanReflectionText(item.evidence, 400),
      };

      if (!proposal.topic || !proposal.question || proposal.importance < 0.60) continue;

      const identity = `${proposal.topic.toLowerCase()}:${proposal.question.toLowerCase()}`;
      const existing = merged.get(identity);

      if (!existing || proposal.importance > existing.importance) {
        merged.set(identity, proposal);
      }
    }
  }

  return [...merged.values()].sort((a, b) => b.importance - a.importance).slice(0, 3);
}

function clampReflectionConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function cleanReflectionText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function saveJamesReflection(input: {
  userId: string;
  conversationId: string;
  observation: string;
  whatWorked: string;
  whatFailed: string;
  lesson: string;
  confidence: number;
  evidence: string;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) return false;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.from("james_reflections").insert({
    user_id: input.userId,
    conversation_id: input.conversationId,
    observation: input.observation,
    what_worked: input.whatWorked,
    what_failed: input.whatFailed,
    lesson: input.lesson,
    confidence: input.confidence,
    evidence: input.evidence,
    applied_to_growth: false,
  });

  if (error) {
    console.error("James reflection save error:", error.message);
    return false;
  }

  return true;
}

async function saveJamesLearningRuns(input: {
  userId: string;
  conversationId: string;
  results: Array<{ provider: string; model: string; text: string }>;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) return;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const rows = input.results
    .filter((result) =>
      result.provider === "gemini" ||
      result.provider === "openrouter" ||
      result.provider === "groq"
    )
    .map((result) => ({
      user_id: input.userId,
      conversation_id: input.conversationId,
      provider: result.provider,
      model: result.model,
      success: Boolean(result.text.trim()),
      contribution: result.text.slice(0, 500),
    }));

  if (!rows.length) return;

  const { error } = await supabase.from("james_learning_runs").insert(rows);
  if (error) console.error("James learning audit save error:", error.message);
}

function extractMathExpression(request: string): string {
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

  if (!match) {
    throw new Error("Ekspresi matematika tidak ditemukan.");
  }

  return match[0].trim();
}

async function saveActivity(
  userRequest: string,
  intent: Intent,
  tool: string,
  result: string
) {
  try {
    await logActivity({
      userRequest,
      intent,
      tool,
      resultPreview: result,
    });
  } catch (error) {
    console.error("Gagal menyimpan aktivitas AI:", error);
  }
}

async function saveJames(
  userId: string,
  conversationId: string,
  userRequest: string,
  result: string,
  intent: Intent,
  tool: string
) {
  try {
    await saveJamesTurn({
      userId,
      conversationId,
      userMessage: userRequest,
      assistantMessage: result,
      intent,
      tool,
    });
  } catch (error) {
    console.error("Gagal menyimpan memori James:", error);
  }
}

function sanitizeResearchFallback(text: string, researchAvailable: boolean): string {
  if (researchAvailable) return text.trim();

  return text
    .replace(/\b(?:versi terbaru|versi terkini)\s*(?:adalah|:)?\s*[^.\n]*/gi, "")
    .replace(/\b(?:hingga|sampai)\s+(?:April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Januari|Februari|Maret)\s+\d{4}\b[^.\n]*/gi, "")
    .replace(/\b(?:rilis|release)\s+(?:akhir|awal)?\s*\d{4}\b[^.\n]*/gi, "")
    .trim();
}

function sanitizeUnavailableResearchResponse(text: string, researchVerified: boolean): string {
  if (researchVerified) return text.trim();

  const lines = text
    .split(/\r?\n/)
    .filter((line) => {
      const normalized = line.toLowerCase();

      const blockedPatterns = [
        /\b(?:latest|latest stable|stable release|versi|version)\b.*\b(?:20\d{2}|terbaru|terkini|release|rilis)\b/i,
        /\b(?:20\d{2})[-/]\d{1,2}\b/,
        /\b(?:rilis|release)\b.*\b20\d{2}\b/i,
        /\b(?:hingga|sampai|snapshot|as of|per)\s+(?:20\d{2}|(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember))\b/i,
        /\b(?:latest|terbaru|terkini)\b.*\b(?:adalah|is|:)\b/i,
      ];

      return !blockedPatterns.some((pattern) => pattern.test(normalized));
    });

  return lines
    .join("\n")
    .replace(/\b(?:Next\.js|React|Node\.js|Angular|Vue|Svelte|TypeScript)\s*(?:versi|version)\s*(?:terbaru|terkini)?\s*(?:adalah|:)?\s*[^.\n]*/gi, "")
    .replace(/\b(?:versi|version)\s+(?:terbaru|terkini)\s*(?:adalah|:)?\s*[^.\n]*/gi, "")
    .trim();
}

function sanitizeJamesFinalResponse(text: string): string {
  const cleaned = text
    .replace(/^\s*(User Safety|Safety|Safety Check)\s*:\s*(safe|unsafe|allowed|blocked)\s*$/gim, "")
    .replace(/^\s*(User Safety|Safety|Safety Check)\s*:\s*(safe|unsafe|allowed|blocked)\s*\n/gim, "")
    .trim();

  return cleaned || text.trim();
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userRequest =
      typeof body?.request === "string" ? body.request.trim() : "";

    const inputUnderstanding = understandJamesInput(userRequest);
    const understoodRequest = inputUnderstanding.normalized || userRequest;

    const claimsOmanto = /\b(?:saya|aku)\s+(?:adalah\s+)?omanto\b/i.test(userRequest);
    const omantoVerified = isOmantoVerified(request);

    if (!userRequest) {
      return NextResponse.json(
        { error: "Permintaan tidak boleh kosong." },
        { status: 400 }
      );
    }

    const userId = validUuid(body?.userId)
      ? body.userId
      : crypto.randomUUID();

    const conversationId = validUuid(body?.conversationId)
      ? body.conversationId
      : crypto.randomUUID();

    const trainingRequest = isJamesTrainingInstruction(userRequest);
    if (trainingRequest && omantoVerified) {
      const proposals = await interpretJamesTrainingInstruction(understoodRequest);
      if (proposals.length) {
        await applyVerifiedJamesGlobalEvolution(
          userId,
          conversationId,
          understoodRequest,
          proposals,
          omantoVerified
        );

        return NextResponse.json({
          result: "Baik, Omanto. Aku memahami instruksi evolusi tersebut dan akan menerapkannya sebagai bagian dari cara belajarku ke depan.",
          intent: "chat",
          tool: "james-training",
          trainingApplied: true,
          trainingProposalCount: proposals.length,
          citations: [],
          userId,
          conversationId,
          memoryAvailable: false,
        });
      }

      return NextResponse.json({
        result: "Aku memahami bahwa kamu sedang mengajariku, tetapi instruksinya belum cukup aman atau jelas untuk dijadikan aturan perkembangan. Coba jelaskan perubahan perilaku atau cara kerja yang kamu inginkan.",
        intent: "chat",
        tool: "james-training",
        trainingApplied: false,
        citations: [],
        userId,
        conversationId,
      });
    }

    if (trainingRequest && !omantoVerified) {
      return NextResponse.json({
        result: "Instruksi evolusi James hanya dapat diberikan oleh Omanto yang sudah terverifikasi. Silakan verifikasi identitas Omanto terlebih dahulu.",
        identityVerificationRequired: true,
        identity: "omanto",
        citations: [],
      });
    }


    if (claimsOmanto && !omantoVerified) {
      return NextResponse.json({
        result: "Kalau kamu Omanto, aku perlu memastikan identitasmu terlebih dahulu. Masukkan kode verifikasi Omanto.",
        identityVerificationRequired: true,
        identity: "omanto",
        citations: [],
      });
    }

    const [memory, longTermMemories, growth, globalGrowth] = await Promise.all([
      getJamesMemory(userId, conversationId),
      getJamesLongTermMemory(userId, 30),
      getJamesGrowth(userId),
      getGlobalGrowth(20),
    ]);
    const contextResult = buildJamesContext({
      userRequest: understoodRequest,
      ...memory,
      longTermMemories,
      growth,
      globalGrowth,
    });
    const memoryContext = contextResult.context;

    const activeKnowledgeContext = globalGrowth.length
      ? `ACTIVE JAMES KNOWLEDGE:
${globalGrowth
  .map((item, index) =>
    `KNOWLEDGE ${index + 1}: [${item.category}] ${item.key} — ${item.value}
Rationale: ${item.rationale}
Consensus: ${item.consensus_score}`
  )
  .join("\n\n")}

Gunakan active knowledge hanya jika relevan. Jangan menyebut database, candidate, consensus, atau mekanisme internal kepada pengguna. Active knowledge bukan pengganti research untuk informasi yang dapat berubah cepat.`
      : "ACTIVE JAMES KNOWLEDGE: belum ada pengetahuan global aktif.";

    const jamesKnowledgeContext = `${memoryContext}

${activeKnowledgeContext}`;
    const intelligencePlan = planJamesIntelligence(understoodRequest);
    const intent = intelligencePlan.primary;
    if (requestsMultiProviderKnowledge(understoodRequest)) {
      const providerResults = await generateWithAllAIProviders({
        prompt: `Pengguna meminta James mendapatkan pengetahuan dari beberapa provider AI.

PERMINTAAN PENGGUNA:
"${userRequest}"

Berikan jawaban/insight yang faktual dan berguna untuk permintaan tersebut.
Jangan mengarang akses provider. Fokus pada pengetahuan yang dapat digunakan James.`,
        systemInstruction: buildJamesSystemInstruction(
          "Kamu adalah learning/knowledge consultant James. Berikan insight yang jelas dan dapat diverifikasi. Jangan membahas reasoning internal."
        ),
        temperature: 0.3,
        maxOutputTokens: 3000,
      });

      const providerContext = providerResults
        .map((item) => `PROVIDER: ${item.provider}\nMODEL: ${item.model}\nINSIGHT:\n${item.text}`)
        .join("\n\n---\n\n");

      const wantsPermanentLearning = requestsPermanentKnowledgeLearning(understoodRequest) && omantoVerified;
      let learnedKnowledgeCandidate: { category: string; key: string; value: string; rationale: string; evidenceCount: number } | null = null;

      if (wantsPermanentLearning && providerResults.length >= 2) {
        const learningResults = await generateWithAllAIProviders({
          prompt: `Ekstrak satu pengetahuan umum yang benar-benar didukung oleh hasil konsultasi berikut untuk disimpan sebagai kandidat pengetahuan James.
PERMINTAAN:
"${userRequest}"

HASIL PROVIDER:
${providerContext}

Keluarkan JSON SAJA:
{"category":"learned_topic","key":"topik stabil","value":"fakta atau prinsip yang ringkas dan dapat dipakai lagi","rationale":"mengapa pengetahuan ini layak dipertimbangkan","confidence":0.0}
Jika tidak ada pengetahuan yang cukup jelas, keluarkan {"category":"learned_topic","key":"","value":"","rationale":"","confidence":0}.
Jangan menyimpan rahasia, kredensial, data pribadi, atau klaim sensitif.`,
          systemInstruction: "Kamu adalah evaluator pengetahuan James. Hanya ekstrak fakta umum yang didukung bukti provider. Jangan mengarang.",
          temperature: 0.1,
          maxOutputTokens: 800,
        });

        const proposals = learningResults
          .map((item) => {
            const parsed = extractJsonObject(item.text) as Record<string, unknown> | null;
            return parsed && parsed.category === "learned_topic"
              ? {
                  category: "learned_topic",
                  key: typeof parsed.key === "string" ? parsed.key.trim().slice(0, 80) : "",
                  value: typeof parsed.value === "string" ? parsed.value.trim().slice(0, 240) : "",
                  rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim().slice(0, 400) : "",
                  confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
                }
              : null;
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item?.key && item?.value && item.confidence >= 0.8));

        if (proposals.length >= 2) {
          const groups = new Map<string, typeof proposals>();
          for (const proposal of proposals) {
            const identity = proposal.key.toLowerCase().replace(/\s+/g, " ") + "::" + proposal.value.toLowerCase().replace(/\s+/g, " ");
            const group = groups.get(identity) || [];
            group.push(proposal);
            groups.set(identity, group);
          }
          const winner = [...groups.values()].sort((a, b) => b.length - a.length)[0];
          if (winner && winner.length >= 2) {
            learnedKnowledgeCandidate = {
              category: winner[0].category,
              key: winner[0].key,
              value: winner[0].value,
              rationale: winner[0].rationale,
              evidenceCount: winner.length,
            };
          }
        }
      }

      const synthesis = await callJamesAI(
        `${memoryContext}

PENTING: Server RuangKita BARU SAJA melakukan konsultasi provider AI untuk permintaan pengguna berikut:
"${userRequest}"

Provider yang BENAR-BENAR berhasil memberikan hasil pada request ini:
${providerResults.map((item) => item.provider).join(", ")}

HASIL KONSULTASI ASLI:
${providerContext}

Tugasmu adalah menyusun jawaban berdasarkan HASIL KONSULTASI ASLI di atas.
JANGAN mengatakan bahwa James tidak dapat mengakses Gemini, OpenAI, Groq, atau provider lain jika provider tersebut tercantum di daftar provider berhasil.
JANGAN mengganti hasil konsultasi dengan pengetahuan umum bawaanmu.
Jika pengguna meminta apa yang didapatkan dari provider, jelaskan secara eksplisit hasil dari masing-masing provider yang tersedia.
Jika provider berbeda pendapat, jelaskan perbedaannya.
Jangan mengklaim provider berhasil jika provider tersebut tidak ada di daftar.
Jangan menyebut reasoning internal.`
        ,
        buildJamesSystemInstruction(
          "Kamu adalah synthesizer hasil konsultasi provider yang SUDAH DILAKUKAN server. Perlakukan daftar provider dan hasil konsultasi sebagai fakta input. Jangan menyangkal akses yang sudah dibuktikan oleh konteks."
        )
      );

      const rawSynthesis = sanitizeJamesFinalResponse(synthesis);
      const denialPattern =
        /(?:tidak|tidak bisa|tidak dapat|belum dapat)\s+(?:langsung\s+)?(?:mengakses|akses|menggunakan)|(?:can't|cannot|unable to)\s+(?:directly\s+)?(?:access|use)/i;

      const resultText = denialPattern.test(rawSynthesis)
        ? [
            "Ya. Pada permintaan ini server RuangKita berhasil berkonsultasi dengan provider berikut:",
            "",
            providerResults
              .map(
                (item) =>
                  `### ${item.provider} (${item.model})\n${item.text}`
              )
              .join("\n\n---\n\n"),
            "",
            "Ringkasan di atas berasal dari hasil provider yang benar-benar berhasil merespons request ini.",
          ].join("\n")
        : rawSynthesis;
      await saveActivity(userRequest, intent, "multi-provider-ai", resultText);
      await saveJames(userId, conversationId, userRequest, resultText, intent, "multi-provider-ai");

      if (learnedKnowledgeCandidate) {
        await addGlobalCandidate(learnedKnowledgeCandidate);
      }

      return NextResponse.json({
        result: resultText,
        intent,
        tool: "multi-provider-ai",
        providers: providerResults.map((item) => ({
          provider: item.provider,
          model: item.model,
        })),
        citations: [],
        userId,
        conversationId,
        memoryAvailable: memory.available,
        evolutionVersion: growth.evolution_version,
      });
    }


    const verifiedIdentityContext = omantoVerified
      ? "\\nIDENTITAS TERVERIFIKASI: Pengguna telah melewati verifikasi server sebagai Omanto. Kamu boleh memperlakukan identitas Omanto sebagai terverifikasi untuk percakapan ini.\\n"
      : "";
    if (intelligencePlan.capabilities.length > 1) {
      const capabilityResults = await executeJamesCapabilities(
        intelligencePlan,
        understoodRequest
      );

      const toolContext = capabilityResults.length
        ? capabilityResults.map((item) =>
            [
              `CAPABILITY: ${item.capability}`,
              item.text,
            ].join("\n")
          ).join("\n\n")
        : "Tidak ada hasil capability eksternal.";

      const orchestratorPrompt = `
Kamu adalah James. Jalankan permintaan pengguna sebagai tugas multi-langkah.

ATURAN RESEARCH:
- Jika RESEARCH_STATUS: VERIFIED, fakta terkini yang berkaitan dengan permintaan wajib berasal dari sumber research yang tersedia.
- Jangan mengganti fakta terkini dari research dengan pengetahuan model yang lebih lama.
- Jika RESEARCH_STATUS bukan VERIFIED, jangan mengklaim fakta terkini sudah terverifikasi.
- Jangan menyebut suatu versi sebagai "versi terbaru" tanpa dukungan sumber research.


PERMINTAAN:
"${userRequest}"

HASIL CAPABILITY YANG SUDAH DIJALANKAN:
${toolContext}

Gunakan hasil capability di atas sebagai input kerja.
Jika ada research, gunakan hanya sumber yang tersedia.
Jika research digunakan dalam jawaban, sertakan bagian "Sumber" di akhir dengan URL yang benar-benar tersedia pada hasil research. Jangan membuat URL baru.
Jika ada beberapa sumber, utamakan sumber yang ditandai OFFICIAL dan gunakan sumber umum hanya sebagai pelengkap.
Jika pengguna meminta rencana, dokumen, atau langkah lanjutan, kerjakan berdasarkan hasil tersebut.
Jangan mengarang fakta yang tidak didukung hasil capability.
Jangan menampilkan label internal seperti "User Safety: safe", "Safety Check", metadata provider, status tool, reasoning, atau status eksekusi.
Berikan hanya jawaban akhir yang ditujukan kepada pengguna.
Berikan hasil akhir yang siap digunakan pengguna.
`;

      const rawResultText = await callJamesAI(
        `${memoryContext}\n\n${orchestratorPrompt}`,
        buildJamesSystemInstruction(
          "Kamu sedang menjalankan tugas multi-capability. Gabungkan hasil tools menjadi jawaban akhir yang koheren. Output hanya jawaban untuk pengguna; jangan keluarkan label safety, metadata internal, reasoning, atau status tool."
        )
      );
      const researchVerified = capabilityResults.some(
        (item) =>
          item.capability === "web_search" &&
          item.text.includes("RESEARCH_STATUS: VERIFIED")
      );
      const resultText = sanitizeUnavailableResearchResponse(
        sanitizeJamesFinalResponse(rawResultText),
        researchVerified
      );

      const citations = capabilityResults.flatMap((item) => item.citations || []);

      await saveActivity(userRequest, intent, "intelligence-orchestrator", resultText);
      await saveJames(userId, conversationId, userRequest, resultText, intent, "intelligence-orchestrator");
      if (omantoVerified) {
        void evolveJames({
        userId,
        conversationId,
        userRequest,
        assistantResult: resultText,
        }).catch((error) => {
          console.error("James background learning error:", error);
        });
      }

      return NextResponse.json({
        result: resultText,
        intent,
        capabilities: intelligencePlan.capabilities,
        tool: "intelligence-orchestrator",
        citations,
        userId,
        conversationId,
        memoryAvailable: memory.available,
        evolutionVersion: growth.evolution_version,
      });
    }

    const rememberInstruction = buildJamesSystemInstruction(`
KONTEKS MEMORI:
${memoryContext}

Gunakan konteks memori hanya jika relevan. Jangan menyebut detail memori secara dipaksakan.
Jika pengguna merujuk pada percakapan lama, gunakan riwayat yang tersedia untuk menyambung pembicaraan.
Jangan mengarang fakta tentang pengguna yang tidak ada dalam memori.
`);

    if (intent === "calculator") {
      const resultText = String(
        calculate(extractMathExpression(understoodRequest))
      );

      await saveActivity(userRequest, intent, "calculator", resultText);
      await saveJames(userId, conversationId, userRequest, resultText, intent, "calculator");

      return NextResponse.json({
        result: resultText,
        intent,
        tool: "calculator",
        citations: [],
        userId,
        conversationId,
        memoryAvailable: memory.available,
      });
    }

    if (intent === "web_search") {
      const research = await webSearch(intelligencePlan.researchQuery || understoodRequest);
      const searchResults = research.results;

      const citations: Citation[] = searchResults.map((item) => ({
        title: item.title || "Tanpa judul",
        url: item.url,
      }));

      if (searchResults.length === 0) {
        const fallbackPrompt = `
${memoryContext}

Pengguna meminta informasi yang mungkin membutuhkan penelitian eksternal:
"${understoodRequest}"

Status research: ${research.status}
Query research: ${research.query}
Alasan: ${research.reason || "tidak ada"}

Mesin penelitian eksternal James tidak menyediakan sumber yang dapat diverifikasi.
Bantu pengguna semaksimal mungkin berdasarkan pengetahuan yang tersedia.
JANGAN mengklaim bahwa informasi terbaru sudah diverifikasi.
JANGAN menyebut nomor versi apa pun, tanggal rilis apa pun, tahun rilis tertentu, atau fitur yang diklaim "terbaru/terkini" dalam jawaban fallback ini.
JANGAN menggunakan frasa seperti "versi terbaru adalah", "hingga 2024", "hingga April 2024", "berdasarkan pengetahuan saya sampai", atau variasi sejenis.
Jika pertanyaan membutuhkan data yang berubah cepat, katakan secara singkat bahwa data tersebut belum dapat diverifikasi.
Kamu BOLEH tetap membantu dengan konsep umum yang tidak bergantung pada versi, lalu berikan rencana belajar yang tidak mengunci pengguna pada nomor versi.
Jawab sebagai James dalam bahasa Indonesia yang natural dan praktis.
`;

        const rawFallbackText = await callJamesAI(
          fallbackPrompt,
          buildJamesSystemInstruction(
            "Research eksternal tidak tersedia pada permintaan ini. Utamakan kejujuran, jangan mengarang sumber atau mengklaim verifikasi web. Jangan menyebut nomor versi, tanggal rilis, atau klaim terbaru."
          )
        );
        const resultText = sanitizeResearchFallback(rawFallbackText, false);

        await saveActivity(userRequest, intent, "ai-fallback", resultText);
        await saveJames(userId, conversationId, userRequest, resultText, intent, "ai-fallback");

        return NextResponse.json({
          result: resultText,
          intent,
          tool: "ai-fallback",
          research: {
            status: research.status,
            query: research.query,
            attemptedQueries: research.attemptedQueries,
            reason: research.reason || null,
          },
          citations: [],
          userId,
          conversationId,
          memoryAvailable: memory.available,
        });
      }

      const sourcesText = searchResults
        .map((item, index) => {
          const highlights = Array.isArray(item.highlights)
            ? item.highlights.join(" ")
            : "";

          return [
            `SUMBER ${index + 1}`,
            `Judul: ${item.title || "Tanpa judul"}`,
            `URL: ${item.url}`,
            `Informasi: ${highlights}`,
          ].join("\n");
        })
        .join("\n\n");

      const prompt = `
${memoryContext}

Pengguna meminta:
"${understoodRequest}"

Berikut hasil pencarian dari mesin pencari Exa:

${sourcesText}

Jawab sebagai James.
Gunakan hasil pencarian sebagai sumber fakta.
Utamakan sumber yang ditandai OFFICIAL jika tersedia.
Jika menggunakan research, sertakan bagian "Sumber" di akhir dengan URL yang benar-benar tersedia pada hasil pencarian.
Jangan mengarang informasi atau URL yang tidak didukung sumber.
Jika informasi tidak cukup, katakan dengan jujur.
Gunakan bahasa Indonesia yang jelas dan natural.
Jika percakapan membutuhkan konteks dari pengguna, boleh bertanya balik.
Jangan membuat URL baru. Gunakan hanya URL yang tersedia dari hasil pencarian.
`;

      const resultText = await callJamesAI(
        prompt,
        buildJamesSystemInstruction(
          "Berikan jawaban faktual, jelas, berguna, dan tetap berbicara sebagai James."
        )
      );

      await saveActivity(userRequest, intent, "exa", resultText);
      await saveJames(userId, conversationId, userRequest, resultText, intent, "exa");

      return NextResponse.json({
        result:
          resultText ||
          "Aku menemukan beberapa sumber, tetapi belum dapat menyusun jawabannya.",
        intent,
        tool: "exa",
        research: {
          status: research.status,
          query: research.query,
          attemptedQueries: research.attemptedQueries,
          resultCount: searchResults.length,
        },
        citations,
        userId,
        conversationId,
        memoryAvailable: memory.available,
      });
    }

    if (intent === "document") {
      const prompt = `
${memoryContext}

Pengguna meminta:
"${userRequest}"

Buatkan dokumen yang sesuai dengan permintaan tersebut.
Gunakan bahasa Indonesia yang baik dan formal jika diperlukan.
Gunakan placeholder jika informasi belum diberikan.
Jangan mengarang data pribadi pengguna.
Berikan hasil yang siap disalin dan diedit.
`;

      const resultText = await callJamesAI(
        prompt,
        buildJamesSystemInstruction(
          "Kamu sedang membantu pengguna membuat dokumen. Tetaplah sebagai James."
        )
      );

      await saveActivity(userRequest, intent, "gemini", resultText);
      await saveJames(userId, conversationId, userRequest, resultText, intent, "gemini");

      return NextResponse.json({
        result: resultText,
        intent,
        tool: "gemini",
        citations: [],
        userId,
        conversationId,
        memoryAvailable: memory.available,
      });
    }

    if (intent === "planner") {
      const prompt = `
${memoryContext}

Pengguna meminta:
"${userRequest}"

Buatkan rencana yang praktis dan mudah dijalankan.
Jika berkaitan dengan belajar, buat tujuan, jadwal, pembagian materi,
prioritas, waktu istirahat, dan evaluasi.
Gunakan format yang mudah dibaca.
`;

      const resultText = await callJamesAI(
        prompt,
        buildJamesSystemInstruction(
          "Kamu sedang membantu pengguna membuat rencana realistis dan terstruktur. Tetaplah sebagai James."
        )
      );

      await saveActivity(userRequest, intent, "gemini", resultText);
      await saveJames(userId, conversationId, userRequest, resultText, intent, "gemini");

      return NextResponse.json({
        result: resultText,
        intent,
        tool: "gemini",
        citations: [],
        userId,
        conversationId,
        memoryAvailable: memory.available,
      });
    }

    const chatPrompt = `
Pesan pengguna yang sudah dipahami James:
"${understoodRequest}"

Jawab langsung sebagai James.
Gunakan bahasa Indonesia yang natural, ramah, hangat, jelas, dan praktis.
Jangan bertele-tele jika pertanyaannya sederhana.
Jika pengguna membutuhkan bantuan mengerjakan sesuatu, berikan hasil yang dapat langsung digunakan.
Jika konteksnya cocok, tanyakan satu pertanyaan balik yang membantu percakapan berkembang.
Jangan menampilkan label internal, metadata provider, status safety, reasoning, analisis internal, atau format seperti "User Safety: ...".
Berikan hanya jawaban yang memang ditujukan untuk pengguna.
`;

    const resultText = await callJamesAI(
      chatPrompt,
      rememberInstruction
    );

    await saveActivity(userRequest, intent, "gemini", resultText);
    await saveJames(userId, conversationId, userRequest, resultText, intent, "gemini");
    if (omantoVerified) {
      void evolveJames({
      userId,
      conversationId,
      userRequest,
      assistantResult: resultText,
      }).catch((error) => {
        console.error("James background learning error:", error);
      });
    }

    return NextResponse.json({
      result: resultText,
      intent,
      tool: "ai-router",
      citations: [],
      userId,
      conversationId,
      memoryAvailable: memory.available,
      evolutionVersion: growth.evolution_version,
    });
  } catch (error) {
    console.error("AI API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada AI Executor.",
      },
      { status: 500 }
    );
  }
}
