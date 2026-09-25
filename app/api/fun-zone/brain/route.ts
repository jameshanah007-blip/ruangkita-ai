import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../../fun-zone/aiRouter";
import type { GameBlueprint } from "../../../fun-zone/laboratory/types";

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
        "AI Director tidak menghasilkan JSON yang valid."
      );
    }

    return JSON.parse(
      cleaned.slice(start, end + 1)
    );
  }
}

function stringValue(
  value: unknown,
  fallback: string
): string {
  return (
    typeof value === "string" &&
    value.trim()
  )
    ? value.trim()
    : fallback;
}

function stringArray(
  value: unknown,
  fallback: string[]
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const result = value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);

  return result.length > 0
    ? result
    : fallback;
}

function normalizeBlueprint(
  input: unknown,
  userPrompt: string
): GameBlueprint {
  const source =
    input &&
    typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};

  const blueprint: GameBlueprint = {
    title: stringValue(
      source.title,
      "AI Generated Game"
    ),

    concept: stringValue(
      source.concept,
      userPrompt ||
        "An original interactive browser game"
    ),

    genre: stringValue(
      source.genre,
      "original game"
    ),

    mood: stringValue(
      source.mood,
      "engaging"
    ),

    difficulty: stringValue(
      source.difficulty,
      "normal"
    ),

    theme: stringValue(
      source.theme,
      userPrompt ||
        "original interactive world"
    ),

    world: stringValue(
      source.world,
      "an original game world"
    ),

    coreLoop: stringValue(
      source.coreLoop,
      "explore, interact, overcome challenges, and progress"
    ),

    objective: stringValue(
      source.objective,
      "Complete the main objective"
    ),

    mechanics: stringArray(
      source.mechanics,
      [
        "movement",
        "interaction",
        "progression",
      ]
    ),

    playerActions: stringArray(
      source.playerActions,
      [
        "move",
        "interact",
        "restart",
      ]
    ),

    controls: stringArray(
      source.controls,
      [
        "WASD",
        "Arrow keys",
        "Space",
        "Mouse click",
        "Touch tap",
        "Touch swipe",
      ]
    ),

    progression: stringValue(
      source.progression,
      "Progress through increasingly difficult challenges"
    ),

    replayability: stringValue(
      source.replayability,
      "Replay to explore different strategies and improve the result"
    ),

    winCondition: stringValue(
      source.winCondition,
      "Complete the main objective"
    ),

    loseCondition: stringValue(
      source.loseCondition,
      "Fail the main game challenge"
    ),

    visualStyle: stringValue(
      source.visualStyle,
      "modern 2D browser game"
    ),

    mobileNotes: stringArray(
      source.mobileNotes,
      [
        "Responsive layout",
        "Touch-friendly controls",
        "Mobile browser support",
        "Portrait and landscape support",
      ]
    ),

    testRequirements: stringArray(
      source.testRequirements,
      [
        "Game must render visibly",
        "Game loop must start",
        "Game animation must advance",
        "Player input must work",
        "Gameplay state must change",
        "Game must have a clear objective",
        "Game must provide win and lose conditions",
        "Game must be playable on mobile",
      ]
    ),
  };

  return blueprint;
}

const SYSTEM_INSTRUCTION = `
Kamu adalah AI GAME DIRECTOR untuk
RuangKita AI.

Tugasmu adalah mengubah deskripsi bebas dari
user menjadi GAME BLUEPRINT yang lengkap.

==================================================
KONSEP UTAMA
==================================================

User TIDAK harus memilih genre dari daftar tetap.

User cukup menjelaskan game yang dia inginkan.

Kamu harus memahami sendiri:

- genre
- mood
- difficulty
- theme
- world
- mechanics
- objective
- player actions
- progression
- controls
- win condition
- lose condition
- visual style
- mobile requirements
- testing requirements

Genre boleh berupa genre umum,
subgenre, hybrid genre,
atau genre original.

Contoh:

"game horor di rumah sakit tua"

dapat menjadi:

genre:
survival horror

mood:
tegang

difficulty:
brutal

theme:
rumah sakit tua

mechanics:
exploration,
collecting,
enemy avoidance,
resource management

Contoh lain:

"pesawat luar angkasa bertahan dari
serangan asteroid"

dapat menjadi:

genre:
space survival

mechanics:
movement,
dodging,
shooting,
resource management

Jangan membatasi kreativitas pada
daftar genre tertentu.

==================================================
TUGAS
==================================================

Analisis prompt user.

Kemudian buat Game Blueprint lengkap.

Blueprint harus memiliki:

title
concept
genre
mood
difficulty
theme
world
coreLoop
objective
mechanics
playerActions
controls
progression
replayability
winCondition
loseCondition
visualStyle
mobileNotes
testRequirements

==================================================
GAMEPLAY
==================================================

Game harus benar-benar merupakan game.

Jangan membuat:

- quiz
- dashboard
- form
- website informasi
- landing page

Game harus memiliki:

- player
- objective
- gameplay loop
- interaction
- progression
- challenge
- win condition
- lose condition

==================================================
CONTROLS
==================================================

controls harus berupa ARRAY STRING.

Contoh:

[
  "WASD movement",
  "Arrow keys movement",
  "Space interaction",
  "Mouse click",
  "Touch tap",
  "Touch swipe"
]

Jangan membuat object keyboard/mouse/touch.

==================================================
MOBILE
==================================================

mobileNotes harus berupa ARRAY STRING.

Contoh:

[
  "Responsive layout",
  "Touch controls",
  "Mobile browser support"
]

Game harus dapat dimainkan di:

- desktop
- Android
- mobile browser

==================================================
TEST REQUIREMENTS
==================================================

testRequirements harus berupa ARRAY STRING.

Minimal mencakup:

- rendering
- game loop
- animation
- input
- gameplay state
- objective
- win condition
- lose condition
- mobile usability

Test requirements akan digunakan oleh
AI Tester untuk mengevaluasi Game Artifact.

==================================================
OUTPUT
==================================================

Output HANYA JSON.

Jangan gunakan markdown.

Jangan gunakan code fence.

Jangan membuat JavaScript.

Jangan membuat HTML.

Jangan memberikan penjelasan tambahan.

JSON harus valid.
`;

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    /*
     * Prompt bebas adalah input utama
     * Laboratory AI.
     *
     * genre/mood/theme tetap diterima
     * untuk backward compatibility
     * dengan UI lama.
     */

    const userPrompt =
      typeof body?.prompt === "string" &&
      body.prompt.trim()
        ? body.prompt.trim()
        : "";

    const legacyGenre =
      typeof body?.genre === "string"
        ? body.genre.trim()
        : "";

    const legacyMood =
      typeof body?.mood === "string"
        ? body.mood.trim()
        : "";

    const legacyTheme =
      typeof body?.theme === "string"
        ? body.theme.trim()
        : "";

    const combinedPrompt =
      userPrompt ||
      [
        legacyGenre
          ? `Genre: ${legacyGenre}`
          : "",

        legacyMood
          ? `Mood: ${legacyMood}`
          : "",

        legacyTheme
          ? `Theme: ${legacyTheme}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

    if (!combinedPrompt) {
      return NextResponse.json(
        {
          success: false,
          stage: "director",
          error:
            "Deskripsi game belum diberikan.",
        },
        {
          status: 400,
        }
      );
    }

    const prompt = `
USER GAME REQUEST:

${combinedPrompt}

==================================================

Bertindak sebagai AI Game Director.

Jangan sekadar mengulang prompt.

Ekstrak dan rancang sendiri:

- genre
- mood
- difficulty
- theme
- world
- mechanics
- objective
- player actions
- progression
- controls
- win condition
- lose condition
- visual style
- mobile requirements
- testing requirements

Buat konsep yang konkret,
original,
dan benar-benar dapat dimainkan.

Genre tidak dibatasi.

Pastikan controls adalah array string.

Pastikan mobileNotes adalah array string.

Pastikan testRequirements adalah array string.

Output JSON saja.
`;

    const result =
      await generateWithAIRouter({
        systemInstruction:
          SYSTEM_INSTRUCTION,

        prompt,

        temperature: 0.8,

        maxOutputTokens: 7000,
      });

    const parsed =
      extractJson(result.text);

    const game =
      normalizeBlueprint(
        parsed,
        combinedPrompt
      );

    return NextResponse.json({
      success: true,

      source: "ai",

      stage: "director",

      provider:
        result.provider,

      model:
        result.model,

      prompt:
        combinedPrompt,

      blueprint:
        game,
    });
  } catch (error) {
    console.error(
      "AI Game Director error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        stage: "director",

        error:
          error instanceof Error
            ? error.message
            : "AI Game Director gagal.",
      },
      {
        status: 500,
      }
    );
  }
}