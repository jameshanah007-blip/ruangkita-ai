import { NextResponse } from "next/server";
import { calculate } from "../tools/calculator";
import { webSearch } from "../tools/webSearch";
import { logActivity } from "../tools/logActivity";
import { getJamesMemory, saveJamesTurn } from "../tools/memory";
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
import { generateWithAllAIProviders } from "../../fun-zone/aiRouter";

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
    "carikan", "cari", "pencarian", "berita terbaru",
    "informasi terbaru", "terbaru", "hari ini", "sekarang",
    "lomba", "beasiswa", "lowongan", "website", "sumber",
  ];

  if (webSearchPatterns.some((keyword) => text.includes(keyword))) {
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

async function callGemini(
  userInput: string,
  systemInstruction?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi.");
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    input: userInput,
  };

  if (systemInstruction) {
    body.system_instruction = systemInstruction;
  }

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini API error:", data);
    throw new Error(data?.error?.message || "Gagal menghubungi Gemini.");
  }

  return extractText(data);
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
- Maksimal 3 proposals dan 2 curiosity.
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
        data: extractJsonObject(result.text),
      }))
      .filter((item) => item.data && typeof item.data === "object");

    if (!parsedResults.length) return;

    const primary = parsedResults[0].data as Record<string, unknown>;
    const observation = cleanReflectionText(primary.observation, 500);
    const whatWorked = cleanReflectionText(primary.what_worked, 500);
    const whatFailed = cleanReflectionText(primary.what_failed, 500);
    const lesson = cleanReflectionText(primary.lesson, 500);
    const evidence = cleanReflectionText(primary.evidence, 500);
    const confidence = clampReflectionConfidence(primary.confidence);

    const reflectionSaved = await saveJamesReflection({
      userId: input.userId,
      conversationId: input.conversationId,
      observation,
      whatWorked,
      whatFailed,
      lesson,
      confidence,
      evidence,
    });

    const proposals = mergeLearningProposals(parsedResults);
    const curiosity = mergeCuriosity(parsedResults);

    if (reflectionSaved && proposals.length) {
      await applyJamesEvolution(
        input.userId,
        input.conversationId,
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

function mergeLearningProposals(
  results: Array<{ provider: string; data: Record<string, unknown> }>
): JamesEvolutionProposal[] {
  const merged = new Map<string, JamesEvolutionProposal>();

  for (const result of results) {
    const items = Array.isArray(result.data.proposals)
      ? result.data.proposals
      : [];

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

      const identity = `${proposal.category}:${proposal.key}:${proposal.value.toLowerCase()}`;
      const existing = merged.get(identity);

      if (!existing || proposal.confidence > existing.confidence) {
        merged.set(identity, proposal);
      }
    }
  }

  return [...merged.values()].slice(0, 5);
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

    const [memory, growth] = await Promise.all([
      getJamesMemory(userId, conversationId),
      getJamesGrowth(userId),
    ]);
    const memoryContext = buildJamesMemoryContext({ ...memory, growth });
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
        const resultText = "Aku tidak menemukan hasil pencarian yang relevan.";

        await saveActivity(userRequest, intent, "exa", resultText);
        await saveJames(userId, conversationId, userRequest, resultText, intent, "exa");

        return NextResponse.json({
          result: resultText,
          intent,
          tool: "exa",
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

      const resultText = await callGemini(
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

      const resultText = await callGemini(
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

      const resultText = await callGemini(
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
${memoryContext}

Percakapan terbaru dari pengguna:
"${userRequest}"

Jawab sebagai James.
Gunakan bahasa Indonesia yang natural, ramah, hangat, jelas, dan praktis.
Jangan bertele-tele jika pertanyaannya sederhana.
Jika pengguna membutuhkan bantuan mengerjakan sesuatu, berikan hasil yang dapat langsung digunakan.
Jika konteksnya cocok, tanyakan satu pertanyaan balik yang membantu percakapan berkembang.
`;

    const resultText = await callGemini(
      chatPrompt,
      buildJamesSystemInstruction(
        "Kamu sedang melakukan percakapan langsung dengan seorang pengguna RuangKita."
      )
    );

    await saveActivity(userRequest, intent, "gemini", resultText);
    await saveJames(userId, conversationId, userRequest, resultText, intent, "gemini");
    await evolveJames({
      userId,
      conversationId,
      userRequest,
      assistantResult: resultText,
    });

    return NextResponse.json({
      result: resultText,
      intent,
      tool: "gemini",
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
