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
    const reflection = await callGemini(`
Analisis satu interaksi James berikut sebagai mesin refleksi karakter.

USER:
${input.userRequest}

JAMES:
${input.assistantResult}

Keluarkan JSON SAJA dengan bentuk:
{
  "proposals": [
    {
      "category": "communication_style | interest | learned_topic | lesson | preference",
      "key": "kunci singkat",
      "value": "nilai singkat",
      "reason": "alasan berbasis interaksi",
      "confidence": 0.0,
      "source_excerpt": "kutipan singkat dari interaksi"
    }
  ]
}

Aturan:
- Maksimal 3 proposal.
- Jika tidak ada hal bermakna untuk dipelajari, gunakan {"proposals":[]}.
- Confidence >= 0.70 hanya untuk bukti yang jelas.
- Jangan menyimpan password, token, credential, nomor identitas, nomor telepon, alamat, lokasi presisi, data kesehatan, agama, politik, orientasi seksual, atau data sensitif lain.
- Jangan mendiagnosis atau menebak sifat sensitif pengguna.
- Jangan mengubah nama James, Omanto, RuangKita, atau core identity.
- "lesson" adalah pelajaran tentang cara James sebaiknya membantu/berkomunikasi, bukan fakta pribadi sensitif pengguna.
`, "Kamu adalah reflection engine internal James. Output wajib JSON valid tanpa markdown.");

    const parsed = extractJsonObject(reflection);
    const proposals = Array.isArray(parsed?.proposals)
      ? parsed.proposals as JamesEvolutionProposal[]
      : [];

    await applyJamesEvolution(
      input.userId,
      input.conversationId,
      proposals
    );
  } catch (error) {
    console.error("James evolution reflection error:", error);
  }
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
