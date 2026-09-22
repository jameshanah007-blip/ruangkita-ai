import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../../fun-zone/aiRouter";

function extractHtml(text: string): string {
  const trimmed = text.trim();

  const fenced = trimmed.match(
    /```(?:html)?\s*([\s\S]*?)\s*```/i
  );

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.search(
    /<!doctype html|<html[\s>]/i
  );

  if (start >= 0) {
    return trimmed.slice(start).trim();
  }

  return trimmed;
}

function validateGameHtml(html: string): string[] {
  const errors: string[] = [];

  if (!html.trim()) {
    errors.push("AI tidak menghasilkan HTML.");
  }

  if (!/<html[\s>]/i.test(html)) {
    errors.push("Dokumen tidak memiliki tag HTML.");
  }

  if (!/<body[\s>]/i.test(html)) {
    errors.push("Dokumen tidak memiliki tag body.");
  }

  if (!/<script[\s>]/i.test(html)) {
    errors.push("Game tidak memiliki JavaScript.");
  }

  if (!/<canvas[\s>]/i.test(html)) {
    errors.push("Game tidak menggunakan Canvas.");
  }

  if (html.length > 500_000) {
    errors.push("Ukuran game terlalu besar.");
  }

  const forbiddenPatterns = [
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /WebSocket/i,
    /localStorage/i,
    /sessionStorage/i,
    /document\.cookie/i,
    /window\.parent/i,
    /parent\./i,
    /window\.top/i,
    /top\./i,
    /eval\s*\(/i,
    /new\s+Function\s*\(/i,
    /import\s*\(/i,
    /require\s*\(/i,
    /process\./i,
  ];

  const forbiddenNames = [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "window.parent",
    "parent",
    "window.top",
    "top",
    "eval",
    "Function",
    "import",
    "require",
    "process",
  ];

  forbiddenPatterns.forEach((pattern, index) => {
    if (pattern.test(html)) {
      errors.push(
        `Game menggunakan kemampuan yang tidak diizinkan: ${forbiddenNames[index]}.`
      );
    }
  });

  return errors;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const gameHtml =
      typeof body?.gameHtml === "string"
        ? body.gameHtml
        : "";

    const errorMessage =
      typeof body?.errorMessage === "string"
        ? body.errorMessage.trim().slice(0, 3000)
        : "";

    const errorSource =
      typeof body?.errorSource === "string"
        ? body.errorSource.trim().slice(0, 1000)
        : "";

    const errorLine =
      typeof body?.errorLine === "number"
        ? body.errorLine
        : null;

    const errorColumn =
      typeof body?.errorColumn === "number"
        ? body.errorColumn
        : null;

    const genre =
      typeof body?.genre === "string"
        ? body.genre.trim().slice(0, 100)
        : "";

    if (!gameHtml.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Kode game kosong.",
        },
        { status: 400 }
      );
    }

    if (!errorMessage) {
      return NextResponse.json(
        {
          success: false,
          error: "Pesan error kosong.",
        },
        { status: 400 }
      );
    }

    const prompt = `
Kamu adalah AI Game Debugger untuk RuangKita AI.

Sebuah game browser yang dibuat oleh AI mengalami error.

Tugas kamu adalah MEMPERBAIKI game tersebut.

==================================================
GENRE
==================================================

${genre || "Tidak diketahui."}

==================================================
ERROR
==================================================

Pesan error:
${errorMessage}

Source:
${errorSource || "Tidak diketahui."}

Line:
${errorLine ?? "Tidak diketahui."}

Column:
${errorColumn ?? "Tidak diketahui."}

==================================================
KODE GAME SAAT INI
==================================================

${gameHtml}

==================================================
ATURAN PERBAIKAN
==================================================

1. Cari penyebab error secara langsung.

2. Perbaiki kode yang menyebabkan error.

3. Jangan menghapus gameplay hanya untuk menghilangkan error.

4. Pertahankan genre dan identitas game.

5. Pertahankan player, objective, challenge,
   score/progress, win condition dan lose condition
   selama tidak menyebabkan error.

6. Jika ada bagian kode yang rapuh, buat lebih aman.

7. Game harus tetap playable di mobile dan desktop.

8. Gunakan HTML, CSS, JavaScript vanilla
   dan Canvas 2D.

9. Semua kode harus tetap berada dalam satu
   dokumen HTML.

10. Jangan menggunakan external asset,
    external API atau external JavaScript.

==================================================
KEAMANAN
==================================================

Jangan menggunakan:

fetch
XMLHttpRequest
WebSocket
localStorage
sessionStorage
cookies
window.parent
window.top
eval
Function constructor
import
require
process

Jangan mengakses:

- filesystem
- server
- environment variable
- database
- Supabase
- Node.js
- API key

==================================================
SELF TEST
==================================================

Pastikan:

window.__RK_GAME_READY__ = true;

setelah initialization.

Pastikan:

window.__RK_GAME_RENDERED__ = true;

setelah frame pertama berhasil dirender.

Pastikan:

window.__RK_GAME_LOOP_STARTED__ = true;

setelah game loop dimulai.

==================================================
OUTPUT
==================================================

Output HANYA satu dokumen HTML lengkap.

Jangan gunakan markdown.

Jangan gunakan code fence.

Mulai dengan:

<!DOCTYPE html>

dan akhiri dengan:

</html>
`;

    const result =
      await generateWithAIRouter({
        systemInstruction: `
Kamu adalah AI Debugger khusus
untuk game browser RuangKita AI.

Analisis error secara teknis.

Jangan menjelaskan panjang lebar.

Perbaiki kode game secara langsung.

Output hanya HTML lengkap.

Jangan mengubah game menjadi quiz,
dashboard, form atau halaman informasi.

Game harus tetap menjadi VIDEO GAME.
`,
        prompt,
        temperature: 0.3,
        maxOutputTokens: 16000,
      });

    const fixedHtml =
      extractHtml(result.text);

    const validationErrors =
      validateGameHtml(fixedHtml);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          provider: result.provider,
          model: result.model,
          errors: validationErrors,
          htmlPreview:
            fixedHtml.slice(0, 1000),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      model: result.model,
      gameHtml: fixedHtml,
      size: fixedHtml.length,
    });
  } catch (error) {
    console.error(
      "AI Game Debugger error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI Game Debugger gagal memperbaiki game.",
      },
      { status: 500 }
    );
  }
}