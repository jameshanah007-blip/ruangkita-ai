import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../../fun-zone/aiRouter";
import {
  GameBlueprintSchema,
  type GameBlueprint,
} from "../../../fun-zone/engine/gameBlueprint";

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

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AI tidak menghasilkan JSON game yang valid.");
    }

    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

const SYSTEM_INSTRUCTION = `
Kamu adalah AI Game Brain untuk RuangKita AI.

Buat blueprint game original yang dapat dimainkan.

Game bukan quiz.

Genre yang tersedia:
adventure
action
combat
survival
strategy
mystery
runner
puzzle
rpg
simulation

Aturan:
1. Output hanya JSON valid.
2. Jangan gunakan markdown.
3. Jangan gunakan code fence.
4. Jangan memberikan penjelasan di luar JSON.
5. Jangan membuat JavaScript.
6. Jangan membuat executable code.
7. Harus ada tepat satu player entity.
8. Harus ada minimal tiga entity.
9. Harus ada minimal dua entity interaktif selain player.
10. Harus ada minimal empat possibleEvents.
11. dynamicEventsEnabled harus true.
12. x dan y entity harus berada antara 0 dan 100.

Gunakan schema GameBlueprint yang diberikan oleh sistem.

Pastikan JSON valid.
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const genre =
      typeof body?.genre === "string" && body.genre.trim()
        ? body.genre.trim()
        : "adventure";

    const mood =
      typeof body?.mood === "string" && body.mood.trim()
        ? body.mood.trim()
        : "seru";

    const theme =
      typeof body?.theme === "string" && body.theme.trim()
        ? body.theme.trim()
        : "petualangan misterius";

    const prompt = `
Buat satu game baru.

Genre: ${genre}
Mood: ${mood}
Tema: ${theme}

Game harus memiliki:
- satu player
- NPC, enemy, item atau portal
- dunia yang dapat dieksplorasi
- pergerakan
- interaksi
- event dinamis
- kondisi kemenangan
- kondisi kekalahan

Jangan membuat quiz.

Minimal:
- 3 entity
- tepat 1 player
- 2 entity interaktif selain player
- 4 possibleEvents

dynamicEventsEnabled harus true.

Output hanya JSON.
`;

    const result = await generateWithAIRouter({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      temperature: 0.7,
      maxOutputTokens: 6000,
    });

    const parsed = extractJson(result.text);

    const validation = GameBlueprintSchema.safeParse(parsed);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Blueprint AI tidak sesuai schema.",
          details: validation.error.flatten(),
          provider: result.provider,
          model: result.model,
        },
        { status: 502 }
      );
    }

    const game: GameBlueprint = validation.data;

    const playerEntities = game.entities.filter(
      (entity) => entity.type === "player"
    );

    const interactiveEntities = game.entities.filter(
      (entity) =>
        entity.type === "npc" ||
        entity.type === "enemy" ||
        entity.type === "item" ||
        entity.type === "portal"
    );

    if (playerEntities.length !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Game harus memiliki tepat satu player.",
          provider: result.provider,
          model: result.model,
        },
        { status: 502 }
      );
    }

    if (game.entities.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: "Game harus memiliki minimal tiga entity.",
          provider: result.provider,
          model: result.model,
        },
        { status: 502 }
      );
    }

    if (interactiveEntities.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Game harus memiliki minimal dua entity interaktif.",
          provider: result.provider,
          model: result.model,
        },
        { status: 502 }
      );
    }

    if (game.possibleEvents.length < 4) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Game harus memiliki minimal empat event.",
          provider: result.provider,
          model: result.model,
        },
        { status: 502 }
      );
    }

    if (game.rules.dynamicEventsEnabled !== true) {
      return NextResponse.json(
        {
          success: false,
          error: "Dynamic events harus aktif.",
          provider: result.provider,
          model: result.model,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      source: "ai",
      provider: result.provider,
      model: result.model,
      game,
    });
  } catch (error) {
    console.error("AI Game Brain error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI Game Brain gagal.",
      },
      { status: 500 }
    );
  }
}