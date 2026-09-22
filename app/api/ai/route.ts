import { NextResponse } from "next/server";
import { calculate } from "../tools/calculator";
import { webSearch } from "../tools/webSearch";
import { logActivity } from "../tools/logActivity";

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
    "carikan",
    "cari",
    "pencarian",
    "berita terbaru",
    "informasi terbaru",
    "terbaru",
    "hari ini",
    "sekarang",
    "lomba",
    "beasiswa",
    "lowongan",
    "website",
    "sumber",
  ];

  if (webSearchPatterns.some((keyword) => text.includes(keyword))) {
    return "web_search";
  }

  const documentPatterns = [
    "buatkan surat",
    "buat surat",
    "surat resmi",
    "surat izin",
    "surat undangan",
    "proposal",
    "laporan",
    "dokumen",
    "buatkan dokumen",
  ];

  if (documentPatterns.some((keyword) => text.includes(keyword))) {
    return "document";
  }

  const plannerPatterns = [
    "buat rencana",
    "rencana belajar",
    "jadwal belajar",
    "buat jadwal",
    "planning",
    "rencanakan",
    "strategi belajar",
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

    throw new Error(
      data?.error?.message ||
        "Gagal menghubungi Gemini."
    );
  }

  return extractText(data);
}

function extractText(data: any): string {
  if (!Array.isArray(data?.steps)) {
    return "";
  }

  const texts: string[] = [];

  for (const step of data.steps) {
    if (step?.type !== "model_output") {
      continue;
    }

    const content = step?.content;

    if (typeof content === "string") {
      texts.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === "string") {
          texts.push(item);
        }

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

function extractMathExpression(request: string): string {
  let expression = request
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

  const match = expression.match(
    /[\d\s+\-*/().%]+/
  );

  if (!match) {
    throw new Error(
      "Ekspresi matematika tidak ditemukan."
    );
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
    console.error(
      "Gagal menyimpan aktivitas AI:",
      error
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userRequest =
      typeof body?.request === "string"
        ? body.request.trim()
        : "";

    if (!userRequest) {
      return NextResponse.json(
        {
          error: "Permintaan tidak boleh kosong.",
        },
        { status: 400 }
      );
    }

    const intent = detectIntent(userRequest);

    // =========================
    // CALCULATOR
    // =========================

    if (intent === "calculator") {
      const expression =
        extractMathExpression(userRequest);

      const result = calculate(expression);

      const resultText = String(result);

      await saveActivity(
        userRequest,
        intent,
        "calculator",
        resultText
      );

      return NextResponse.json({
        result: resultText,
        intent,
        tool: "calculator",
        citations: [],
      });
    }

    // =========================
    // WEB SEARCH - EXA
    // =========================

    if (intent === "web_search") {
      const searchResults =
        await webSearch(userRequest);

      const citations: Citation[] =
        searchResults.map((item) => ({
          title: item.title || "Tanpa judul",
          url: item.url,
        }));

      if (searchResults.length === 0) {
        const resultText =
          "Saya tidak menemukan hasil pencarian yang relevan.";

        await saveActivity(
          userRequest,
          intent,
          "exa",
          resultText
        );

        return NextResponse.json({
          result: resultText,
          intent,
          tool: "exa",
          citations: [],
        });
      }

      const sourcesText = searchResults
        .map((item, index) => {
          const highlights =
            Array.isArray(item.highlights)
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
Kamu adalah RuangKita AI, asisten AI untuk pelajar dan komunitas.

Pengguna meminta:
"${userRequest}"

Berikut hasil pencarian dari mesin pencari Exa:

${sourcesText}

Tugas:
1. Jawab pertanyaan pengguna berdasarkan hasil pencarian di atas.
2. Jangan mengarang informasi yang tidak didukung sumber.
3. Jika informasi tidak cukup, katakan dengan jujur.
4. Gunakan bahasa Indonesia yang jelas.
5. Jika hasil berupa lomba, beasiswa, acara, atau kesempatan lain, jelaskan informasi penting seperti nama, penyelenggara, batas pendaftaran jika tersedia, dan tautan sumber.
6. Jangan membuat URL baru. Gunakan hanya URL yang tersedia dari hasil pencarian.
`;

      const resultText = await callGemini(
        prompt,
        "Berikan jawaban faktual, jelas, dan berguna berdasarkan sumber yang diberikan."
      );

      await saveActivity(
        userRequest,
        intent,
        "exa",
        resultText
      );

      return NextResponse.json({
        result:
          resultText ||
          "Saya menemukan beberapa sumber, tetapi belum dapat menyusun jawabannya.",
        intent,
        tool: "exa",
        citations,
      });
    }

    // =========================
    // DOCUMENT
    // =========================

    if (intent === "document") {
      const prompt = `
Kamu adalah RuangKita AI.

Pengguna meminta:
"${userRequest}"

Buatkan dokumen yang sesuai dengan permintaan tersebut.

Aturan:
- Gunakan bahasa Indonesia yang baik dan formal jika diperlukan.
- Susun dengan rapi.
- Gunakan placeholder seperti [Nama], [Tanggal], [Tempat], atau [Nama Sekolah] jika informasi belum diberikan.
- Jangan mengarang data pribadi pengguna.
- Berikan hasil yang siap disalin dan diedit.
`;

      const resultText = await callGemini(
        prompt,
        "Kamu adalah asisten penulisan dokumen yang rapi, jelas, dan praktis."
      );

      await saveActivity(
        userRequest,
        intent,
        "gemini",
        resultText
      );

      return NextResponse.json({
        result: resultText,
        intent,
        tool: "gemini",
        citations: [],
      });
    }

    // =========================
    // PLANNER
    // =========================

    if (intent === "planner") {
      const prompt = `
Kamu adalah RuangKita AI.

Pengguna meminta:
"${userRequest}"

Buatkan rencana yang praktis dan mudah dijalankan.

Jika berkaitan dengan belajar:
- buat tujuan
- buat jadwal
- bagi materi menjadi beberapa bagian
- berikan prioritas
- tambahkan waktu istirahat
- berikan tips evaluasi

Gunakan format yang mudah dibaca.
`;

      const resultText = await callGemini(
        prompt,
        "Kamu adalah asisten perencanaan yang membantu pengguna membuat rencana realistis dan terstruktur."
      );

      await saveActivity(
        userRequest,
        intent,
        "gemini",
        resultText
      );

      return NextResponse.json({
        result: resultText,
        intent,
        tool: "gemini",
        citations: [],
      });
    }

    // =========================
    // GENERAL CHAT
    // =========================

    const chatPrompt = `
Kamu adalah RuangKita AI, asisten digital untuk pelajar dan komunitas.

Pengguna berkata:
"${userRequest}"

Jawab dalam bahasa Indonesia.

Buat jawaban:
- jelas
- ramah
- praktis
- tidak bertele-tele
- mudah dipahami pelajar

Jika pengguna meminta bantuan mengerjakan sesuatu, berikan hasil yang dapat langsung digunakan jika memungkinkan.
`;

    const resultText = await callGemini(
      chatPrompt,
      "Kamu adalah RuangKita AI yang membantu pengguna bertanya, meminta, dan menyelesaikan sesuatu."
    );

    await saveActivity(
      userRequest,
      intent,
      "gemini",
      resultText
    );

    return NextResponse.json({
      result: resultText,
      intent,
      tool: "gemini",
      citations: [],
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