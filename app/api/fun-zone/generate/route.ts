import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GameSpecificationSchema } from "../../../fun-zone/engine/gameSchema";
import { generateLocalGame } from "../../../fun-zone/engine/localGenerator";

const MODEL = "gemini-3.6-flash";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

type FunZoneHistory = {
  game_title: string;
  game_theme: string | null;
  game_genre: string | null;
  difficulty: string | null;
  mood: string | null;
};

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

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(
      "AI tidak menghasilkan JSON yang valid."
    );
  }

  return JSON.parse(
    cleaned.slice(firstBrace, lastBrace + 1)
  );
}

async function getHistory(): Promise<FunZoneHistory[]> {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    console.warn(
      "Supabase belum dikonfigurasi. History tidak digunakan."
    );

    return [];
  }

  try {
    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("fun_sessions")
      .select(
        "game_title,game_theme,game_genre,difficulty,mood"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(10);

    if (error) {
      console.error(
        "Gagal membaca history Fun Zone:",
        error.message
      );

      return [];
    }

    return (data || []) as FunZoneHistory[];
  } catch (error) {
    console.error(
      "History Fun Zone tidak tersedia:",
      error
    );

    return [];
  }
}

function getRecentThemes(
  history: FunZoneHistory[]
): string[] {
  return history
    .map((item) => item.game_theme)
    .filter(
      (theme): theme is string =>
        Boolean(theme)
    );
}

function getRecentTitles(
  history: FunZoneHistory[]
): string[] {
  return history
    .map((item) => item.game_title)
    .filter(
      (title): title is string =>
        Boolean(title)
    );
}

function createHistoryContext(
  history: FunZoneHistory[]
): string {
  if (history.length === 0) {
    return "Belum ada riwayat permainan.";
  }

  return history
    .slice(0, 10)
    .map((item, index) => {
      return `${index + 1}. ${item.game_title} | tema: ${
        item.game_theme || "tidak diketahui"
      } | genre: ${
        item.game_genre || "tidak diketahui"
      } | kesulitan: ${
        item.difficulty || "tidak diketahui"
      } | mood: ${
        item.mood || "tidak diketahui"
      }`;
    })
    .join("\n");
}

async function generateWithGemini(
  mood: string,
  history: FunZoneHistory[]
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY belum dikonfigurasi."
    );
  }

  const historyContext =
    createHistoryContext(history);

  const prompt = `
Kamu adalah AI Game Director untuk RuangKita AI.

Tugasmu adalah menciptakan SATU permainan baru yang dapat dimainkan
di browser berdasarkan preferensi pemain dan riwayat permainan sebelumnya.

Preferensi pemain:
"${mood}"

Riwayat permainan sebelumnya:
${historyContext}

Gunakan riwayat tersebut untuk membuat pengalaman yang lebih bervariasi.

Aturan variasi:
- Jangan menggunakan judul yang sama dengan riwayat terbaru.
- Hindari tema yang sama jika masih ada pilihan tema lain.
- Jangan terus-menerus menggunakan genre yang sama jika genre lain sesuai.
- Jika pemain memilih mood "menantang", gunakan tantangan yang lebih sulit.
- Jika pemain memilih mood "santai", buat permainan yang ringan.
- Jika pemain memilih mood "cepat", buat permainan singkat.
- Jika pemain memilih mood "mikir", prioritaskan logika, puzzle, atau edukasi.
- Jika pemain memilih mood "lucu", gunakan tema yang ringan dan menyenangkan.
- Jika pemain memilih "surprise", pilih kombinasi yang tidak monoton.

Buat pengalaman yang:
- kreatif
- tidak monoton
- mudah dipahami
- dapat dimainkan dalam beberapa menit
- cocok untuk pelajar dan komunitas
- memiliki tantangan yang jelas
- memiliki kondisi menang dan kalah
- tidak membutuhkan kode JavaScript
- tidak membutuhkan akses internet
- tidak mengandung konten berbahaya, seksual, perjudian, atau kekerasan ekstrem

Kamu WAJIB menghasilkan JSON dengan struktur berikut:

{
  "title": "string",
  "description": "string",
  "genre": "quiz | mystery | adventure | puzzle | arcade | strategy | riddle | education",
  "theme": "string",
  "difficulty": "easy | medium | hard | extreme",
  "durationMinutes": 1,
  "mechanic": "multiple_choice | riddle | true_false | sequence | text_input",
  "objective": "string",
  "rules": {
    "lives": 3,
    "scorePerCorrect": 100,
    "timeLimitSeconds": 60
  },
  "challenges": [
    {
      "id": "challenge-1",
      "type": "multiple_choice",
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "string"
    }
  ],
  "victoryMessage": "string",
  "defeatMessage": "string"
}

Aturan tambahan:
- challenges minimal 3 dan maksimal 10.
- correctAnswer harus cocok dengan jawaban yang tersedia.
- Untuk riddle atau text_input, options boleh tidak digunakan.
- Jangan menghasilkan Markdown.
- Jangan menghasilkan komentar.
- Jangan menghasilkan teks di luar JSON.
- Hasil harus berupa JSON valid.
`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      system_instruction:
        "Kamu adalah AI Game Director. Selalu ikuti format JSON yang diminta.",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "Gemini Game Generator error:",
      data
    );

    throw new Error(
      data?.error?.message ||
        "Gagal menghubungi Gemini."
    );
  }

  const text = extractText(data);

  if (!text) {
    throw new Error(
      "Gemini tidak menghasilkan game."
    );
  }

  const rawGame = extractJson(text);

  const validation =
    GameSpecificationSchema.safeParse(rawGame);

  if (!validation.success) {
    console.error(
      "Game validation error:",
      validation.error.flatten()
    );

    throw new Error(
      "Game yang dibuat AI tidak memenuhi aturan Game Engine."
    );
  }

  return validation.data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const mood =
      typeof body?.mood === "string"
        ? body.mood.trim()
        : "surprise";

    const history = await getHistory();

    const recentThemes =
      getRecentThemes(history);

    const recentTitles =
      getRecentTitles(history);

    // Prioritas pertama: Gemini
    try {
      const game =
        await generateWithGemini(
          mood,
          history
        );

      return NextResponse.json({
        success: true,
        source: "ai",
        game,
      });
    } catch (error) {
      console.warn(
        "Gemini gagal. Menggunakan Local Game Generator.",
        error
      );
    }

    // Fallback: Local Game Generator
    const localGame =
      generateLocalGame(
        mood,
        recentThemes,
        recentTitles
      );

    return NextResponse.json({
      success: true,
      source: "local",
      game: localGame,
    });
  } catch (error) {
    console.error(
      "Fun Zone Generator error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat membuat game.",
      },
      { status: 500 }
    );
  }
}