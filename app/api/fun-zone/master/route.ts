import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../../fun-zone/aiRouter";
import {
  GameCommandListSchema,
  type GameCommandList,
} from "../../../fun-zone/engine/gameCommands";
import type { GameState } from "../../../fun-zone/engine/gameState";

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (
      start === -1 ||
      end === -1 ||
      end <= start
    ) {
      throw new Error(
        "AI Game Master tidak menghasilkan JSON valid."
      );
    }

    return JSON.parse(
      cleaned.slice(start, end + 1)
    );
  }
}

const SYSTEM_INSTRUCTION = `
Kamu adalah AI Game Master untuk RuangKita AI.

Tugasmu adalah mengendalikan perkembangan dunia game
berdasarkan tindakan pemain dan keadaan game saat ini.

Kamu bukan programmer.
Jangan menghasilkan JavaScript.
Jangan menghasilkan kode executable.

Kamu hanya boleh menghasilkan Game Commands yang
disediakan oleh sistem.

Tujuanmu:
- membuat dunia terasa hidup
- merespons tindakan pemain
- menciptakan kejadian baru
- mengatur musuh
- mengatur reward
- mengubah cuaca
- membuka area
- memulai atau mengakhiri battle
- menyesuaikan tingkat kesulitan
- menjaga permainan tetap menarik

Jangan mengubah game secara tidak masuk akal.

Jangan langsung membunuh pemain tanpa alasan yang jelas.

Jangan membuat lebih dari 5 command dalam satu respons.

Gunakan command berikut jika diperlukan:

SPAWN_ENTITY
REMOVE_ENTITY
MOVE_ENTITY
DAMAGE_ENTITY
HEAL_PLAYER
DAMAGE_PLAYER
CHANGE_WEATHER
ADD_SCORE
TRIGGER_EVENT
START_BATTLE
END_BATTLE
OPEN_AREA
CHANGE_DIFFICULTY

Output HARUS JSON valid tanpa markdown.

Format:

{
  "commands": [],
  "reasoning": "penjelasan singkat keputusan Game Master"
}
`;

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const gameState =
      body?.gameState as GameState | undefined;

    const playerAction =
      typeof body?.playerAction === "string"
        ? body.playerAction
        : "Tidak ada aksi khusus.";

    if (!gameState) {
      return NextResponse.json(
        {
          success: false,
          error: "Game state diperlukan.",
        },
        { status: 400 }
      );
    }

    const prompt = `
GAME STATE:

${JSON.stringify(gameState, null, 2)}

AKSI PEMAIN:

${playerAction}

Analisis situasi tersebut.

Tentukan apakah dunia perlu berubah.

Jika tidak perlu perubahan besar,
kamu boleh mengembalikan commands kosong.

Jika perlu perubahan, gunakan hanya command
yang tersedia.

Jangan menghasilkan lebih dari 5 command.
`;

    const result =
      await generateWithAIRouter({
        systemInstruction:
          SYSTEM_INSTRUCTION,

        prompt,

        temperature: 0.8,

        maxOutputTokens: 3000,
      });

    const parsed = extractJson(
      result.text
    );

console.log(
  "AI GAME MASTER RAW OUTPUT:",
  result.text
);

console.log(
  "AI GAME MASTER PARSED:",
  JSON.stringify(
    parsed,
    null,
    2
  )
);


    const validation =
      GameCommandListSchema.safeParse(
        parsed
      );

    if (!validation.success) {
      console.error(
        "AI Game Master menghasilkan command invalid:",
        validation.error.flatten()
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "AI Game Master menghasilkan command yang tidak valid.",
          provider: result.provider,
        },
        { status: 502 }
      );
    }

    const commands: GameCommandList =
      validation.data;

    return NextResponse.json({
      success: true,

      provider: result.provider,

      model: result.model,

      commands: commands.commands,

      reasoning: commands.reasoning,
    });
  } catch (error) {
    console.error(
      "AI Game Master error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI Game Master gagal.",
      },
      { status: 500 }
    );
  }
}