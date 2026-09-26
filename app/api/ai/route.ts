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
  getJamesGrowth,
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
import { getGlobalGrowth } from "../tools/jamesGlobalLearning";
import { buildJamesContext } from "../tools/jamesContext";

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

function detectIntent(request: string): Intent {
  const text = request.toLowerCase();

  const calculatorPatterns = [
    /\d+\s*[+\-*/x×÷%]\s*\d+/,
    /berapa hasil/,
    /hitung/,
    /berapakah/,
    /kalkulator/,
  ];

  if (calculatorPatterns.some((pattern) => pattern.test(text))) {
    return "calculator";
  }

  const webSearchPatterns = [
    "carikan", "cari", "pencarian",
    "berita terbaru", "informasi terbaru",
    "berita hari ini", "hari ini",
    "lomba", "beasiswa", "lowongan",
    "cari di internet", "cari di web",
    "sumber terbaru", "referensi terbaru",
  ];

  const researchPatterns = [
    /\bterbaru\b.*\b(teknologi|ai|software|aplikasi|berita|fitur|versi)\b/,
    /\b(teknologi|ai|software|aplikasi|berita|fitur|versi)\b.*\bterbaru\b/,
    /\bsekarang\b.*\b(versi|fitur|rilis|berita)\b/,
  ];

  if (
    webSearchPatterns.some((keyword) => text.includes(keyword)) ||
    researchPatterns.some((pattern) => pattern.test(text))
  ) {
    return "web_search";
  }

  const documentPatterns = [
    "buatkan surat", "buat surat", "surat resmi", "surat izin",
    "surat undangan", "proposal", "laporan", "dokumen",
    "buatkan dokumen",
  ];

  if (documentPatterns.some((keyword) => text.includes(keyword))) {
    return "document";
  }

  const plannerPatterns = [
    "buat rencana", "rencana belajar", "jadwal belajar",
    "buat jadwal", "planning", "rencanakan", "strategi belajar",
  ];

  if (plannerPatterns.some((keyword) => text.includes(keyword))) {
    return "planner";
  }

  return "chat";
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
    const reflectionPrompt = `
Refleksikan interaksi James berikut sebagai learning engine.
Jangan menilai pengguna. Fokus pada cara James dapat menjadi lebih membantu.

USER:
${input.userRequest}

JAMES:
${input.assistantResult}

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
        proposals
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

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userRequest =
      typeof body?.request === "string" ? body.request.trim() : "";

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

    const [memory, longTermMemories, growth, globalGrowth] = await Promise.all([
      getJamesMemory(userId, conversationId),
      getJamesLongTermMemory(userId, 30),
      getJamesGrowth(userId),
      getGlobalGrowth(20),
    ]);
    const contextResult = buildJamesContext({
      userRequest,
      ...memory,
      longTermMemories,
      growth,
      globalGrowth,
    });
    const memoryContext = contextResult.context;
    const intent = detectIntent(userRequest);

    const rememberInstruction = buildJamesSystemInstruction(`
KONTEKS MEMORI:
${memoryContext}

Gunakan konteks memori hanya jika relevan. Jangan menyebut detail memori secara dipaksakan.
Jika pengguna merujuk pada percakapan lama, gunakan riwayat yang tersedia untuk menyambung pembicaraan.
Jangan mengarang fakta tentang pengguna yang tidak ada dalam memori.
`);

    if (intent === "calculator") {
      const resultText = String(
        calculate(extractMathExpression(userRequest))
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
      const searchResults = await webSearch(userRequest);

      const citations: Citation[] = searchResults.map((item) => ({
        title: item.title || "Tanpa judul",
        url: item.url,
      }));

      if (searchResults.length === 0) {
        const fallbackPrompt = `
${memoryContext}

Pengguna meminta informasi yang mungkin membutuhkan penelitian eksternal:
"${userRequest}"

Mesin penelitian eksternal James tidak mengembalikan sumber yang dapat diverifikasi.
Bantu pengguna semaksimal mungkin berdasarkan pengetahuan yang tersedia.
JANGAN mengklaim bahwa informasi terbaru sudah diverifikasi.
Jika pertanyaan membutuhkan data yang berubah cepat, jelaskan secara singkat bahwa kamu tidak dapat memverifikasinya saat ini.
Jika kamu memberikan pengetahuan umum, bedakan dengan jelas dari informasi terkini.
Jawab sebagai James dalam bahasa Indonesia yang natural dan praktis.
`;

        const resultText = await callJamesAI(
          fallbackPrompt,
          buildJamesSystemInstruction(
            "Research eksternal tidak tersedia pada permintaan ini. Utamakan kejujuran, jangan mengarang sumber atau mengklaim verifikasi web."
          )
        );

        await saveActivity(userRequest, intent, "ai-fallback", resultText);
        await saveJames(userId, conversationId, userRequest, resultText, intent, "ai-fallback");

        return NextResponse.json({
          result: resultText,
          intent,
          tool: "ai-fallback",
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
"${userRequest}"

Berikut hasil pencarian dari mesin pencari Exa:

${sourcesText}

Jawab sebagai James.
Gunakan hasil pencarian sebagai sumber fakta.
Jangan mengarang informasi yang tidak didukung sumber.
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
Percakapan terbaru dari pengguna:
"${userRequest}"

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
    void evolveJames({
      userId,
      conversationId,
      userRequest,
      assistantResult: resultText,
    }).catch((error) => {
      console.error("James background learning error:", error);
    });

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
