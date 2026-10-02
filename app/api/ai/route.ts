import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { calculate } from "../tools/calculator";
import { webSearch } from "../tools/webSearch";
import { logActivity } from "../tools/logActivity";
import {
  getJamesMemory,
  getJamesPreviousConversationMessages,
  getJamesPreviousConversationSummaries,
  getJamesRelevantConversationMessages,
  getJamesLongTermMemory,
  saveJamesMemoryProposals,
  saveExplicitJamesMemories,
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
} from "../../core/ai/aiRouter";
import { addGlobalCandidate, getGlobalGrowth } from "../tools/jamesGlobalLearning";
import {
  runJamesBrainChat,
  streamJamesBrainChat,
} from "../../core/james/jamesBrain";
import { runJamesBrainWithSharedKnowledge } from "../../core/james/jamesSharedKnowledge";
import { buildJamesContext } from "../tools/jamesContext";
import { planJamesIntelligence, planJamesIntelligenceWithAI } from "../tools/jamesIntelligence";
import { runJamesAgentLoop } from "../tools/jamesAgentLoop";
import { generateWithJamesResourceManager } from "../tools/jamesResourceManager";
import { evaluateJamesTask } from "../tools/jamesSelfEvaluation";
import { formatJamesConsolidationContext, formatJamesExperienceContext, learnJamesExperience, recordJamesExperienceOutcome, retrieveJamesConsolidations, retrieveJamesExperiences, resolveJamesExperienceConflict } from "../tools/jamesExperience";
import { getJamesAgentTask } from "../tools/jamesAgentState";
import { isOmantoVerified } from "./verify-identity/route";
import { LEGACY_USER_COOKIE, LEGACY_USER_SIGNATURE_COOKIE, verifyLegacyUserIdSignature } from "../auth/cloudIdentity";
import { interpretJamesTrainingInstruction, isJamesTrainingInstruction } from "../tools/jamesTraining";
import { evaluateJamesMetaStrategies, learnJamesMetaStrategy, retrieveJamesMetaStrategiesByCapabilities } from "../tools/jamesMetaLearning";
import { isRuangKitaProjectQuestion, RUANGKITA_PROJECT_KNOWLEDGE } from "../tools/ruangkitaProjectKnowledge";
import { getJamesSocialMemory } from "../tools/jamesSocialMemory";
import { resolveJamesSocialAssociationLearning } from "../tools/socialMemoryRanking.js";
import { consumeJamesRateLimit } from "../tools/jamesRateLimit";

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

function requestsAgentResume(request: string) {
  const text = request
    .toLowerCase()
    .replace(/[!?.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    /\blanjutkan (tugas|pekerjaan|task) (tadi|sebelumnya)/,
    /\blanjut (tugas|pekerjaan|task) tadi/,
    /\bresume (tugas|task)/,
    /\tteruskan (tugas|pekerjaan) tadi/,
  ].some((pattern) => pattern.test(text));
}

function requestsConversationRecall(request: string) {
  const text = request
    .toLowerCase()
    .replace(/[!?.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    /\btadi kita (sedang )?(membicarakan|ngobrol|bahas)/,
    /\bkita tadi (sedang )?(membicarakan|ngobrol|bahas)/,
    /\byang tadi (apa|gimana|tentang apa)/,
    /\bkamu (masih )?ingat\b/,
    /\bjames (masih )?ingat\b/,
    /\bapa yang kita (bahas|bicarakan|obrolkan)/,
    /\btopik (kita )?(tadi|sebelumnya)/,
    /\bpercakapan (tadi|sebelumnya)/,
    /\bchat (tadi|sebelumnya|yang lalu)\b/,
    /\bobrolan (tadi|sebelumnya|yang lalu)\b/,
    /\b(?:apakah\s+)?(?:kamu|james)\s+(?:masih\s+)?kenal\s+(?:saya|aku|[a-zà-öø-ÿ][a-zà-öø-ÿ'_-]{1,40})\b/,
    /\b(?:kamu|james)\s+(?:masih\s+)?kenal\s+(?:saya|aku|[a-zà-öø-ÿ][a-zà-öø-ÿ'_-]{1,40})\b/
  ].some((pattern) => pattern.test(text));
}

function buildConversationRecallResponse(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  const previous = messages.filter((message) => message.content.trim());

  if (!previous.length) {
    return "Belum ada percakapan sebelumnya yang tersimpan di sesi ini.";
  }

  const recentUserMessages = previous
    .filter((message) => message.role === "user")
    .slice(-4);

  if (!recentUserMessages.length) {
    return "Tadi belum ada pesan pengguna yang bisa aku jadikan acuan.";
  }

  const topics = recentUserMessages.map((message) => {
    const content = message.content.trim().replace(/\s+/g, " ");
    return content.length > 240 ? `“${content.slice(0, 237)}...”` : `“${content}”`;
  });

  if (topics.length === 1) {
    return `Tadi kita sedang membicarakan: ${topics[0]}`;
  }

  return [
    "Tadi kita sedang membicarakan beberapa hal berikut:",
    ...topics.map((topic, index) => `${index + 1}. ${topic}`),
  ].join("\n");
}


function extractExplicitIdentityNames(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  const names: string[] = [];

  for (const message of messages) {
    if (message.role !== "user") continue;

    const matches = [
      message.content.match(/\b(?:halo|hai)?\s*(?:james[,! ]+)?(?:saya|aku)\s+(?:adalah\s+)?([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{1,40})\b/i),
      message.content.match(/\b(?:nama saya|namaku|nama aku)\s+(?:adalah\s+)?([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{1,40})\b/i),
    ];

    for (const match of matches) {
      const name = match?.[1]?.trim();
      if (!name || /^(james|kamu|aku|saya)$/i.test(name)) continue;
      if (!names.some((item) => item.toLowerCase() === name.toLowerCase())) {
        names.push(name);
      }
    }
  }

  return names;
}

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

  const explicitResearchPatterns = [
    /\bcarikan\b/,
    /\bcari(?:kan)?\b.*\b(internet|web|online|sumber|referensi|informasi|berita|lomba|beasiswa|lowongan)\b/,
    /\btolong\b.*\bcari\b/,
    /\bcek\b.*\b(terbaru|sekarang|hari ini|online|internet|web)\b/,
    /\bsearch\b.*\b(web|internet|online)\b/,
  ];

  const freshnessPatterns = [
    /\b(terbaru|terkini|hari ini|sekarang|saat ini|minggu ini|bulan ini)\b/,
    /\b(versi|rilis|harga|jadwal|berita|event|lomba|beasiswa|lowongan)\b.*\b(terbaru|terkini|sekarang|hari ini)\b/,
    /\b(terbaru|terkini|sekarang|hari ini)\b.*\b(versi|rilis|harga|jadwal|berita|event|lomba|beasiswa|lowongan)\b/,
  ];

  const sourceRequestPatterns = [
    /\b(sumber|referensi|link|tautan)\b.*\b(cari|berikan|kirim|tampilkan)\b/,
    /\b(cari|berikan|kirim|tampilkan)\b.*\b(sumber|referensi|link|tautan)\b/,
  ];

  if (
    explicitResearchPatterns.some((pattern) => pattern.test(text)) ||
    freshnessPatterns.some((pattern) => pattern.test(text)) ||
    sourceRequestPatterns.some((pattern) => pattern.test(text))
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
  systemInstruction?: string,
  context?: string
): Promise<string> {
  // Fast path: the request has already loaded James' memory/knowledge in this
  // route. Do not query the same shared knowledge tables a second time.
  const result = await runJamesBrainChat({
    prompt: userInput,
    systemInstruction: systemInstruction || buildJamesSystemInstruction(),
    context,
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
  socialMemoryContext?: string;
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

ASSOCIATION SOSIAL YANG DIPAKAI:
${input.socialMemoryContext || "(tidak ada association sosial yang dipilih untuk pesan ini)"}

FEEDBACK PENGGUNA TERKINI:
${feedbackContext}

Gunakan feedback sebagai bukti tambahan tentang kualitas jawaban James.
Jika association sosial tersedia, nilai hanya apakah association tersebut relevan dan digunakan secara natural. Jangan menganggap keberadaan association sebagai bukti bahwa James harus selalu menyebutkannya.
- Jika association_learning digunakan, association_key HARUS persis berasal dari association yang tersedia. Jangan membuat key baru dan jangan mengubah fakta relationship.
- "use_more" hanya jika bukti/feedback menunjukkan association membantu atau relevan; "use_less" hanya jika bukti/feedback menunjukkan association tidak relevan atau terasa dipaksakan; selain itu gunakan "neutral".
- association_learning hanya mengatur kecenderungan penggunaan association dalam percakapan. Jangan menghapus, menurunkan confidence, atau mengubah memory relationship berdasarkan feedback tersebut.
- Jika tidak ada association sosial yang dipakai, association_learning harus array kosong.
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
  "association_learning": [
    {
      "association_key": "stable key from ASSOCIATION SOSIAL YANG DIPAKAI, or empty",
      "decision": "use_more | use_less | neutral",
      "reason": "alasan berbasis feedback atau percakapan",
      "confidence": 0.0
    }
  ],
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

    const allowedAssociationKeys = new Set(
      [...(input.socialMemoryContext || "").matchAll(/association_key=([^\]\s]+)/g)]
        .map((match) => match[1]?.trim())
        .filter((value): value is string => Boolean(value))
    );
    const proposals = mergeLearningProposals(parsedResults, allowedAssociationKeys);
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
        [
          ...recentFeedback.map((item) => item.feedback).filter(Boolean),
          input.socialMemoryContext || "",
        ].filter(Boolean)
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

    const groups = new Map<string, typeof candidates>();    for (const candidate of candidates) {
      const key = candidate.value.toLowerCase().replace(/\s+/g, " ").trim();
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
  results: Array<{ provider: string; data: Record<string, unknown> }>,
  allowedAssociationKeys: Set<string> = new Set()
): JamesEvolutionProposal[] {
  const candidates = new Map<string, JamesEvolutionProposal[]>();

  for (const result of results) {
    const associationLearning = resolveJamesSocialAssociationLearning(
      result.data.association_learning,
      allowedAssociationKeys
    );

    for (const item of associationLearning) {
      const proposal: JamesEvolutionProposal = {
        category: "lesson",
        key: `social_association:${item.associationKey}`,
        value:
          item.decision === "use_more"
            ? `gunakan association sosial ${item.associationKey} ketika relevan`
            : `kurangi penggunaan association sosial ${item.associationKey} ketika tidak relevan`,
        reason: cleanReflectionText(item.reason, 240),
        confidence: item.confidence,
        source_excerpt: `association_key=${item.associationKey}`,
      };

      const identity = `${proposal.category}:${proposal.key}`;
      const list = candidates.get(identity) || [];
      list.push(proposal);
      candidates.set(identity, list);
    }

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
      const value = proposal.value.toLowerCase().replace(/\s+/g, " ").trim();
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

function saveJames(
  userId: string,
  conversationId: string,
  userRequest: string,
  result: string,
  intent: Intent,
  tool: string
) {
  // Persistence must not block the user's first visible response.
  // Next.js after() keeps the write alive after the response is sent.
  after(async () => {
    try {
      await saveJamesTurn({
        userId,
        conversationId,
        userMessage: userRequest,
        assistantMessage: result,
        intent,
        tool,
      });
      await saveExplicitJamesMemories(userId, conversationId, userRequest);
    } catch (error) {
      console.error("Gagal menyimpan memori James:", error);
    }
  });
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
  return cleaned;
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}


function createJamesChatStreamResponse(input: {
  userRequest: string;
  prompt: string;
  userId: string;
  conversationId: string;
  intent: Intent;
  rememberInstruction: string;
  jamesKnowledgeContext: string;
  memoryAvailable: boolean;
  evolutionVersion: number;
  socialMemoryContext?: string;
}) {
  const encoder = new TextEncoder();

  const encodeEvent = (payload: Record<string, unknown>) =>
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let resultText = "";
      let provider = "ai-router";
      let model = "";

      try {
        const brainStream = streamJamesBrainChat({
          prompt: input.prompt,
          systemInstruction: input.rememberInstruction,
          context: input.jamesKnowledgeContext,
          temperature: 0.7,
          maxOutputTokens: 4000,
        });

        for await (const event of brainStream) {
          if (event.type === "delta") {
            resultText += event.text;
            continue;
          }

          provider = event.provider;
          model = event.model;
          resultText = sanitizeJamesFinalResponse(event.text) ||
            "Maaf, aku belum bisa menyusun jawaban yang valid untuk pertanyaan itu. Coba tanyakan lagi dengan cara yang berbeda.";

          if (resultText.trim()) {
            controller.enqueue(encodeEvent({
              type: "delta",
              text: resultText,
            }));
          }

          after(async () => {
            await saveActivity(input.userRequest, input.intent, provider, resultText);
            try {
              // Persist the conversation before inserting long-term memories.
              // james_memories.conversation_id has a foreign key to ai_conversations;
              // running these concurrently can race and intermittently fail.
              await saveJamesTurn({
                userId: input.userId,
                conversationId: input.conversationId,
                userMessage: input.userRequest,
                assistantMessage: resultText,
                intent: input.intent,
                tool: provider,
              });
              await saveExplicitJamesMemories(
                input.userId,
                input.conversationId,
                input.userRequest
              );
            } catch (error) {
              console.error("Gagal menyimpan memori James:", error);
            }

            await evolveJames({
              userId: input.userId,
              conversationId: input.conversationId,
              userRequest: input.userRequest,
              assistantResult: resultText,
              socialMemoryContext: input.socialMemoryContext,
            });
          });

          controller.enqueue(encodeEvent({
            type: "done",
            result: resultText,
            intent: input.intent,
            tool: provider,
            model,
            citations: [],
            userId: input.userId,
            conversationId: input.conversationId,
            memoryAvailable: input.memoryAvailable,
            evolutionVersion: input.evolutionVersion,
          }));
        }

        controller.enqueue(encodeEvent({ type: "complete" }));
        controller.close();
      } catch (error) {
        console.error("James streaming API error:", error);
        controller.enqueue(encodeEvent({
          type: "error",
          error: error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat streaming James.",
        }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userRequest =
      typeof body?.request === "string" ? body.request.trim() : "";

    if (userRequest.length > 12000) {
      return NextResponse.json(
        { error: "Permintaan terlalu panjang. Maksimum 12.000 karakter." },
        { status: 413 },
      );
    }

    const claimsOmanto = /\b(?:saya|aku)\s+(?:adalah\s+)?omanto\b/i.test(userRequest);
    const omantoVerified = isOmantoVerified(request);

    if (!userRequest) {
      return NextResponse.json(
        { error: "Permintaan tidak boleh kosong." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const cookieUserId = cookieStore.get(LEGACY_USER_COOKIE)?.value;
    const cookieUserSignature = cookieStore.get(LEGACY_USER_SIGNATURE_COOKIE)?.value;
    const cookieConversationId = cookieStore.get("ruangkita-session-conversation")?.value;

    // Identity for /api/ai must come only from a server-issued, HMAC-bound
    // legacy session. Never accept userId from the request body as an
    // authorization fallback; doing so would allow cross-user memory access.
    if (
      !validUuid(cookieUserId) ||
      !verifyLegacyUserIdSignature(cookieUserId, cookieUserSignature)
    ) {
      return NextResponse.json(
        { error: "Sesi James tidak valid atau sudah kedaluwarsa. Silakan buat sesi James terlebih dahulu." },
        { status: 401 }
      );
    }

    // Conversation IDs are scoped to the signed user identity by every
    // memory query/write. A missing or invalid cookie gets a fresh ID rather
    // than trusting a client-supplied conversationId.
    const userId = cookieUserId;
    const conversationId = validUuid(cookieConversationId)
      ? cookieConversationId
      : crypto.randomUUID();

    const rateLimit = await consumeJamesRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Batas penggunaan James tercapai. Silakan coba lagi setelah beberapa saat." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const trainingRequest = isJamesTrainingInstruction(userRequest);
    if (trainingRequest && omantoVerified) {
      const proposals = await interpretJamesTrainingInstruction(userRequest);
      if (proposals.length) {
        await applyVerifiedJamesGlobalEvolution(
          userId,
          conversationId,
          userRequest,
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

    const [memory, previousConversationMessages, previousConversationSummaries, relevantConversationMessages, longTermMemories, growth, globalGrowth] = await Promise.all([
      getJamesMemory(userId, conversationId),
      getJamesPreviousConversationMessages(userId, conversationId, 40),
      getJamesPreviousConversationSummaries(userId, conversationId, 20),
      getJamesRelevantConversationMessages(userId, conversationId, userRequest, 20),
      getJamesLongTermMemory(userId, 30),
      getJamesGrowth(userId),
      getGlobalGrowth(20),
    ]);
    const socialMemoryContext = await getJamesSocialMemory(
      userId,
      userRequest,
      growth.lessons,
    );
    const contextResult = buildJamesContext({
      userRequest,
      ...memory,
      // Cross-conversation continuity is restricted to this userId.
      // These rows were retrieved with the same user boundary above.
      messages: [
        ...previousConversationSummaries,
        ...previousConversationMessages,
        ...relevantConversationMessages,
        ...(memory.messages || []),
      ],
      longTermMemories,
      growth,
      globalGrowth,
    });
    const memoryContext = [contextResult.context, socialMemoryContext].filter(Boolean).join("\n\n");

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


    const deterministicIntelligencePlan = planJamesIntelligence(userRequest);
    const needsExperienceContext =
      deterministicIntelligencePlan.primary !== "chat" ||
      deterministicIntelligencePlan.capabilities.length > 1 ||
      isRuangKitaProjectQuestion(userRequest);

    let experienceContext = "";
    let experiences: Awaited<ReturnType<typeof retrieveJamesExperiences>> = [];
    let metaStrategies: Awaited<ReturnType<typeof retrieveJamesMetaStrategiesByCapabilities>> = [];
    if (needsExperienceContext) {
      const [retrievedExperiences, consolidations, retrievedMetaStrategies] = await Promise.all([
        retrieveJamesExperiences({
          userId,
          request: userRequest,
          capabilities: deterministicIntelligencePlan.capabilities,
          limit: 4,
        }),
        retrieveJamesConsolidations(userId, userRequest, 3),
        retrieveJamesMetaStrategiesByCapabilities(
          deterministicIntelligencePlan.capabilities,
          4
        ),
      ]);

      experiences = retrievedExperiences;
      metaStrategies = retrievedMetaStrategies;

      const experienceConflict = await resolveJamesExperienceConflict({
        request: userRequest,
        experiences,
        consolidations,
        capabilities: deterministicIntelligencePlan.capabilities,
      });

      experienceContext = [
        formatJamesExperienceContext(experiences),
        formatJamesConsolidationContext(consolidations),
        experienceConflict.context,
        metaStrategies.length
          ? [
              "ACTIVE JAMES META STRATEGIES:",
              ...metaStrategies.map((item, index) => [
                "META STRATEGY " + (index + 1),
                "Task class: " + item.task_class,
                "Strategy: " + item.strategy,
                "Evidence: " + item.evidence_count,
                "Confidence: " + Number(item.confidence).toFixed(2),
                "Relevance: " + Number(item.relevance).toFixed(2),
              ].join("\n")),
              "",
              "Gunakan meta strategy hanya sebagai pola kerja yang dapat diuji kembali; jangan menganggapnya sebagai aturan mutlak.",
            ].join("\n")
          : "ACTIVE JAMES META STRATEGIES: none.",
      ].join("\n\n");
    }

    const projectKnowledgeContext = isRuangKitaProjectQuestion(userRequest)
      ? [
          "VERIFIED RUANGKITA PROJECT CONTEXT:",
          RUANGKITA_PROJECT_KNOWLEDGE,
          "",
          "ATURAN PROJECT CONTEXT:",
          "- Untuk pertanyaan tentang RuangKita, gunakan konteks proyek ini sebagai sumber fakta proyek.",
          "- Jangan mengganti fakta proyek dengan template software umum.",
          "- Jika fakta yang diminta tidak ada di konteks, katakan bahwa detail tersebut belum tersedia.",
          "- Bedakan fakta proyek dari memori pribadi pengguna dan pengetahuan umum model.",
        ].join("\\n")
      : "";

    const jamesKnowledgeContext = [
      memoryContext,
      activeKnowledgeContext,
      experienceContext,
      projectKnowledgeContext,
    ].filter(Boolean).join("\\n\\n");
    let intent = deterministicIntelligencePlan.primary;

    // Pertanyaan recall percakapan tidak membutuhkan model eksternal.
    // Gunakan history yang sudah tersimpan agar fungsi memori tetap bekerja
    // walaupun semua provider sedang terkena quota/rate limit.
    if (requestsAgentResume(userRequest)) {
      const resumePlan = await planJamesIntelligenceWithAI(
        userRequest,
        memoryContext
      );

      const agentResult = await runJamesAgentLoop({
        request: userRequest,
        initialPlan: resumePlan,
        conversationContext: jamesKnowledgeContext,
        userId,
        conversationId,
        resume: true,
      });

      const resultText = sanitizeJamesFinalResponse(agentResult.answer);
      await saveActivity(userRequest, "planner", "james-agent-resume", resultText);
      await saveJames(
        userId,
        conversationId,
        userRequest,
        resultText,
        "planner",
        "james-agent-resume"
      );

      return NextResponse.json({
        result: resultText,
        intent: "planner",
        tool: "james-agent-resume",
        agent: {
          resumed: true,
          verified: agentResult.verified,
          iterations: agentResult.iterations,
          recovered: agentResult.recovered,
          steps: agentResult.steps,
        },
        citations: agentResult.citations,
        userId,
        conversationId,
        memoryAvailable: memory.available,
      });
    }

    if (requestsConversationRecall(userRequest)) {
      const recallMessages = [
        ...(relevantConversationMessages.length
          ? [...relevantConversationMessages, ...previousConversationSummaries]
          : [...previousConversationSummaries, ...previousConversationMessages, ...memory.messages]),
      ]
        .filter((message) => message.content.trim())
        .sort((a, b) =>
          String(a.created_at || "").localeCompare(String(b.created_at || ""))
        )
        .filter((message, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.role === message.role &&
              candidate.content === message.content &&
              candidate.created_at === message.created_at
          ) === index
        )
        .slice(-40);

      const asksIdentity = /\b(?:siapa|apa)\s+(?:nama|namaku|nama saya)\b|\bsiapa namaku\b/i.test(userRequest);
      const asksPersonalMemory = /\b(?:apa yang (?:kamu|james) ingat(?: tentang)?|(?:kamu|james) (?:masih )?ingat (?:saya|aku)|(?:apakah\s+)?(?:kamu|james) (?:masih\s+)?kenal\s+(?:saya|aku|[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{1,40}))\b/i.test(userRequest);
      const identityMemories = longTermMemories.filter(
        (memory) => memory.memory_type === "identity" && memory.status === "active"
      );
      const stableMemories = longTermMemories.filter(
        (memory) =>
          memory.status === "active" &&
          memory.memory_type !== "identity" &&
          ["relationship", "project", "goal", "preference", "interest", "context"].includes(memory.memory_type)
      );
      const memoryName =
        identityMemories.find((memory) => memory.memory_key === "user_name")?.memory_value ||
        identityMemories.find((memory) => memory.memory_key?.startsWith("self_name:"))?.memory_value ||
        extractExplicitIdentityNames(recallMessages)[0] ||
        null;

      const resultText =
        asksPersonalMemory && (memoryName || stableMemories.length)
          ? [
              memoryName ? "Ya, aku masih mengingatmu." : "Aku punya beberapa memori tentang pengguna ini.",
              memoryName ? "Nama yang tersimpan: **" + memoryName + "**." : "",
              stableMemories.length
                ? [
                    "Hal lain yang tersimpan dari percakapan sebelumnya:",
                    ...stableMemories.slice(0, 8).map((memory) => "- " + memory.memory_value),
                  ].join("\n")
                : "",
            ].filter(Boolean).join("\n")
          : asksIdentity && memoryName
            ? "Dari memori yang tersimpan, kamu pernah memperkenalkan diri sebagai **" + memoryName + "**."
            : asksIdentity && extractExplicitIdentityNames(recallMessages).length > 1
              ? "Aku menemukan beberapa nama yang pernah dipakai untuk memperkenalkan diri di percakapan kita: " +
                extractExplicitIdentityNames(recallMessages).map((name) => "**" + name + "**").join(", ") +
                ". Karena ada lebih dari satu, aku belum bisa memastikan siapa yang sedang berbicara sekarang."
              : buildConversationRecallResponse(recallMessages);

      await saveActivity(userRequest, "chat", "conversation-memory", resultText);
      await saveJames(userId, conversationId, userRequest, resultText, "chat", "conversation-memory");

      return NextResponse.json({
        result: resultText,
        intent: "chat",
        tool: "conversation-memory",
        citations: [],
        userId,
        conversationId,
        memoryAvailable: memory.available,
        evolutionVersion: growth.evolution_version,
      });
    }

    if (requestsMultiProviderKnowledge(userRequest)) {
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

      const wantsPermanentLearning = requestsPermanentKnowledgeLearning(userRequest) && omantoVerified;
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
JANGAN mengganti hasil konsultasi dengan pengetahuan umum bawaanmu.Jika pengguna meminta apa yang didapatkan dari provider, jelaskan secara eksplisit hasil dari masing-masing provider yang tersedia.
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


    // Fast path: simple requests do not need a second LLM call just to classify
    // them. The deterministic planner already handles chat/calculator/search/
    // document/planner. Semantic planning is reserved for true multi-capability
    // tasks, where the extra reasoning step adds value.
    const intelligencePlan = deterministicIntelligencePlan.capabilities.length > 1
      ? await planJamesIntelligenceWithAI(userRequest, jamesKnowledgeContext)
      : deterministicIntelligencePlan;
    intent = intelligencePlan.primary;
    const verifiedIdentityContext = omantoVerified
      ? "\\nIDENTITAS TERVERIFIKASI: Pengguna telah melewati verifikasi server sebagai Omanto. Kamu boleh memperlakukan identitas Omanto sebagai terverifikasi untuk percakapan ini.\\n"
      : "";
    if (intelligencePlan.capabilities.length > 1) {
      const agentResult = await runJamesAgentLoop({
        request: userRequest,
        initialPlan: intelligencePlan,
        conversationContext: jamesKnowledgeContext,
        userId,
        conversationId,
      });

      const researchVerified = agentResult.capabilityResults.some(
        (item) =>
          item.capability === "web_search" &&
          item.text.includes("RESEARCH_STATUS: VERIFIED")
      );

      let resultText = sanitizeUnavailableResearchResponse(
        sanitizeJamesFinalResponse(agentResult.answer),
        researchVerified
      );

      // Never expose an empty result when the multi-step agent has failed.
      // A provider/verification failure should degrade to a direct answer,
      // not to the generic UI fallback "James belum dapat memberikan jawaban."
      if (!resultText.trim()) {
        try {
          const fallback = await generateWithJamesResourceManager("fallback", {
            prompt: [
              "Berikan jawaban langsung kepada pengguna sebagai James.",
              "Tugas multi-step sebelumnya tidak menghasilkan jawaban yang dapat ditampilkan.",
              "Gunakan konteks RuangKita yang tersedia dan jangan mengarang fakta eksternal.",
              "",
              "PERMINTAAN PENGGUNA:",
              userRequest,
              "",
              "KONTEKS RUANGKITA:",
              jamesKnowledgeContext,
              "",
              "Berikan analisis praktis dalam bahasa Indonesia. Jika diminta rencana, susun prioritas dan langkah bertahap.",
            ].join("\n"),
            systemInstruction:
              "Kamu adalah last-resort response engine James. Selalu berikan jawaban yang berguna jika permintaan dapat dijawab dari konteks yang tersedia. Jangan mengarang fakta eksternal.",
            temperature: 0.25,
            maxOutputTokens: 2800,
          });
          resultText = sanitizeUnavailableResearchResponse(
            sanitizeJamesFinalResponse(fallback.text),
            researchVerified
          );
        } catch (error) {
          console.error("James last-resort response error:", error);
        }
      }

      await saveActivity(
        userRequest,
        intent,
        agentResult.recovered ? "james-agent-recovery" : "james-agent-loop",
        resultText
      );
      await saveJames(
        userId,
        conversationId,
        userRequest,
        resultText,
        intent,
        agentResult.recovered ? "james-agent-recovery" : "james-agent-loop"
      );

      if (experiences.length) {
        void recordJamesExperienceOutcome({
          userId,
          experienceIds: experiences
            .map((experience) => experience.id)
            .filter((id): id is string => typeof id === "string"),
          verified: agentResult.verified,
        }).catch((error) => {
          console.error("James experience feedback error:", error);
        });
      }

      void (async () => {
        const evaluation = await evaluateJamesTask({
          userId,
          conversationId,
          taskId: agentResult.taskId,
          request: userRequest,
          result: agentResult,
        });

        if (metaStrategies.length) {
          await evaluateJamesMetaStrategies({
            request: userRequest,
            answer: agentResult.answer,
            capabilities: agentResult.plan.capabilities,
            verified: agentResult.verified,
            outcome:
              evaluation?.outcome === "success" ||
              evaluation?.outcome === "failure" ||
              evaluation?.outcome === "partial"
                ? evaluation.outcome
                : agentResult.verified ? "success" : "partial",
          });
        }
      })().catch((error) => {
        console.error("James task/meta-strategy evaluation error:", error);
      });

      if (agentResult.verified && agentResult.taskId) {
        void (async () => {
          const task = await getJamesAgentTask(agentResult.taskId || "", {
            userId,
            conversationId,
          });
          if (!task) return;

          const learnedExperience = await learnJamesExperience({
            userId,
            conversationId,
            taskId: agentResult.taskId,
            request: userRequest,
            actions: task.actions,
            verified: agentResult.verified,
          });

          if (learnedExperience) {
            await learnJamesMetaStrategy({
              pattern: learnedExperience.pattern,
              strategy: learnedExperience.strategy,
              capabilities: Array.isArray(learnedExperience.capabilities) ? learnedExperience.capabilities : [],
              verified: agentResult.verified,
            });
          }
        })().catch((error) => {
          console.error("James experience learning error:", error);
        });
      }

      void evolveJames({
        userId,
        conversationId,
        userRequest,
        assistantResult: resultText,
        socialMemoryContext,
      }).catch((error) => {
        console.error("James background learning error:", error);
      });

      return NextResponse.json({
        result: resultText,
        intent,
        capabilities: agentResult.plan.capabilities,
        tool: agentResult.recovered ? "james-agent-recovery" : "james-agent-loop",
        agent: {
          verified: agentResult.verified,
          iterations: agentResult.iterations,
          recovered: agentResult.recovered,
          steps: agentResult.steps,
        },
        citations: agentResult.citations,
        userId,
        conversationId,
        memoryAvailable: memory.available,
        evolutionVersion: growth.evolution_version,
      });
    }

    const rememberInstruction = buildJamesSystemInstruction(`
${projectKnowledgeContext}

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
      const research = await webSearch(intelligencePlan.researchQuery || userRequest);
      const searchResults = research.results;

      const citations: Citation[] = searchResults.map((item) => ({
        title: item.title || "Tanpa judul",
        url: item.url,
      }));

      if (searchResults.length === 0) {
        const fallbackPrompt = `
${memoryContext}

Pengguna meminta informasi yang mungkin membutuhkan penelitian eksternal:
"${userRequest}"

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
"${userRequest}"

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

    const recentConversationContext = memory.messages
      .slice(-12)
      .map((message) => {
        const speaker = message.role === "assistant" ? "James" : "Pengguna";
        return `${speaker}: ${message.content}`;
      })
      .join("\n");

    const chatPrompt = `
RIWAYAT PERCAKAPAN SEBELUM PESAN SAAT INI:
${recentConversationContext || "(belum ada riwayat percakapan)"}

RINGKASAN PERCAKAPAN:
${memory.summary || "(belum ada ringkasan)"}

PESAN PENGGUNA SAAT INI:
"${userRequest}"

ATURAN KONTINUITAS WAJIB:
- Pesan pengguna saat ini adalah kelanjutan dari riwayat di atas kecuali pengguna jelas membuka topik baru.
- Jika pengguna bertanya "tadi kita membicarakan apa", "yang tadi apa", "kamu ingat?", "lanjut", atau rujukan serupa, jawab berdasarkan pesan-pesan sebelumnya yang benar-benar tercantum di RIWAYAT.
- Jangan mengatakan "kita belum sempat ngobrol" jika RIWAYAT PERCAKAPAN berisi pesan sebelumnya.
- Jangan mengarang topik yang tidak ada di RIWAYAT.
- Untuk pertanyaan tentang percakapan sebelumnya, prioritaskan RIWAYAT PERCAKAPAN di atas pengetahuan umum model.

Jawab langsung sebagai James.
Gunakan bahasa Indonesia yang natural, ramah, hangat, jelas, dan praktis.
Jangan bertele-tele jika pertanyaannya sederhana.
Jika pengguna membutuhkan bantuan mengerjakan sesuatu, berikan hasil yang dapat langsung digunakan.
Jika konteksnya cocok, tanyakan satu pertanyaan balik yang membantu percakapan berkembang.
Jangan menampilkan label internal, metadata provider, status safety, reasoning, analisis internal, atau format seperti "User Safety: ...".
Berikan hanya jawaban yang memang ditujukan untuk pengguna.
`;

    if (request.headers.get("accept")?.includes("text/event-stream")) {
      return createJamesChatStreamResponse({
        userRequest,
        prompt: chatPrompt,
        userId,
        conversationId,
        intent,
        rememberInstruction,
        jamesKnowledgeContext,
        memoryAvailable: memory.available,
        evolutionVersion: growth.evolution_version,
        socialMemoryContext,
      });
    }
    const resultText = await callJamesAI(
      chatPrompt,
      rememberInstruction,
      jamesKnowledgeContext
    );

    await saveActivity(userRequest, intent, "gemini", resultText);
    await saveJames(userId, conversationId, userRequest, resultText, intent, "gemini");
    void evolveJames({
      userId,
      conversationId,
      userRequest,
      assistantResult: resultText,
      socialMemoryContext,
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