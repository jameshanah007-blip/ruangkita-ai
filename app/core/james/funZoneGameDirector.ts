import { runJamesBrainWithSharedKnowledge } from "./jamesSharedKnowledge";
import { runJamesBrain } from "./jamesBrain";
import type { GameBlueprint } from "../../fun-zone/laboratory/types";

export type FunZoneGameDirectorResult = {
  success: true;
  stage: "director";
  provider: string;
  model: string;
  prompt: string;
  blueprint: GameBlueprint;
};

function extractJson(text: string): unknown {
  const cleaned = text.replace(/\`\`\`json/gi, "").replace(/\`\`\`/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("AI Director tidak menghasilkan JSON yang valid.");
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const result = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return result.length ? result : fallback;
}

function normalizeBlueprint(input: unknown, userPrompt: string): GameBlueprint {
  const source = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  return {
    title: stringValue(source.title, "AI Generated Game"),
    concept: stringValue(source.concept, userPrompt),
    genre: stringValue(source.genre, "original game"),
    mood: stringValue(source.mood, "engaging"),
    difficulty: stringValue(source.difficulty, "normal"),
    theme: stringValue(source.theme, userPrompt),
    world: stringValue(source.world, "an original game world"),
    coreLoop: stringValue(source.coreLoop, "explore, interact, overcome challenges, and progress"),
    objective: stringValue(source.objective, "Complete the main objective"),
    mechanics: stringArray(source.mechanics, ["movement", "interaction", "progression"]),
    playerActions: stringArray(source.playerActions, ["move", "interact", "restart"]),
    controls: stringArray(source.controls, ["WASD", "Arrow keys", "Space", "Touch tap"]),
    progression: stringValue(source.progression, "Progress through increasingly difficult challenges"),
    replayability: stringValue(source.replayability, "Replay to explore different strategies"),
    winCondition: stringValue(source.winCondition, "Complete the main objective"),
    loseCondition: stringValue(source.loseCondition, "Fail the main game challenge"),
    visualStyle: stringValue(source.visualStyle, "genre-appropriate 2D game art"),
    mobileNotes: stringArray(source.mobileNotes, ["Responsive layout", "Touch-friendly controls", "Android browser support"]),
    testRequirements: stringArray(source.testRequirements, [
      "Game renders visibly", "Game loop runs", "Animation advances", "Player input works",
      "Gameplay state changes", "Clear objective", "Win and lose conditions", "Playable on mobile",
    ]),
  };
}

const SYSTEM_INSTRUCTION = `
Kamu adalah AI GAME DIRECTOR untuk RuangKita AI.
Ubah prompt pengguna menjadi blueprint game yang spesifik dan playable. Jangan menulis kode.
Output HARUS satu objek JSON valid, tanpa markdown, komentar, atau teks lain.
Gunakan tepat field berikut dan tipe yang ditentukan:
{
  "title": "string",
  "concept": "string",
  "genre": "string",
  "mood": "string",
  "difficulty": "string",
  "theme": "string",
  "world": "string",
  "coreLoop": "string",
  "objective": "string",
  "mechanics": ["string"],
  "playerActions": ["string"],
  "controls": ["string"],
  "progression": "string",
  "replayability": "string",
  "winCondition": "string",
  "loseCondition": "string",
  "visualStyle": "string",
  "mobileNotes": ["string"],
  "testRequirements": ["string"]
}
Aturan JSON: gunakan tanda kutip ganda untuk semua key dan string; setiap properti dipisahkan koma;
jangan gunakan koma setelah properti terakhir; jangan masukkan baris baru mentah di dalam string.
Batasi setiap string menjadi satu kalimat ringkas dan setiap array menjadi 3-6 item.
Pertahankan genre dan maksud prompt pengguna. Jangan mengganti game yang diminta menjadi quiz,
dashboard, formulir, landing page, atau template generik. Untuk game 2D, targetkan Phaser dan
kontrol desktop serta Android/touch. Pastikan ada tujuan, gameplay loop, tantangan, progres,
kondisi menang dan kalah. controls, mechanics, playerActions, mobileNotes, testRequirements
harus berupa array string.
`;

export async function generateFunZoneGameBlueprint(userPrompt: string): Promise<FunZoneGameDirectorResult> {
  const result = await runJamesBrainWithSharedKnowledge({
    surface: "fun_zone",
    mode: "game_director",
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `USER GAME REQUEST:\n\n${userPrompt}\n\nBuat blueprint yang benar-benar sesuai permintaan. Isi semua field schema dengan nilai ringkas. Output satu objek JSON valid saja.`,
    temperature: 0.2,
    maxOutputTokens: 4200,
  });

  let parsedBlueprint: unknown;
  let finalProvider = result.provider;
  let finalModel = result.model;

  try {
    parsedBlueprint = extractJson(result.text);
  } catch (initialError) {
    const parseError = initialError instanceof Error ? initialError.message : String(initialError);
    console.warn("Fun Zone Director returned invalid JSON; requesting one format-only repair.", {
      provider: result.provider,
      model: result.model,
      error: parseError,
      outputCharacters: result.text.length,
    });

    // Repair is syntax-only and deliberately bypasses shared memory retrieval:
    // memory context can distract a formatting-only task and is not needed here.
    const repairResult = await runJamesBrain({
      surface: "fun_zone",
      mode: "game_director",
      systemInstruction: `
You are a strict JSON syntax repair utility. Return exactly one syntactically valid JSON object.
Do not use markdown fences, comments, explanations, or trailing commas. Preserve the original
game's meaning and every field/value that can be recovered. Do not invent a new game design.
Required keys: title, concept, genre, mood, difficulty, theme, world, coreLoop, objective,
mechanics, playerActions, controls, progression, replayability, winCondition, loseCondition,
visualStyle, mobileNotes, testRequirements. Array fields must contain strings only.
`,
      prompt: [
        "Repair JSON syntax only. Do not redesign or summarize the game.",
        `Parser error: ${parseError}`,
        "Original user request (for intent only):",
        userPrompt,
        "Invalid JSON to repair:",
        result.text,
        "Return only the corrected JSON object.",
      ].join("\n\n"),
      temperature: 0,
      maxOutputTokens: 4200,
    });

    try {
      parsedBlueprint = extractJson(repairResult.text);
      finalProvider = repairResult.provider;
      finalModel = repairResult.model;
      console.info("Fun Zone Director JSON repair succeeded.", {
        initialProvider: result.provider,
        repairProvider: repairResult.provider,
        outputCharacters: repairResult.text.length,
      });
    } catch (repairError) {
      const repairDetail = repairError instanceof Error ? repairError.message : String(repairError);
      console.error("Fun Zone Director JSON repair failed; no local blueprint fallback was used.", {
        initialError: parseError,
        repairError: repairDetail,
        initialOutputCharacters: result.text.length,
        repairOutputCharacters: repairResult.text.length,
      });
      throw new Error(
        `AI Director returned invalid JSON, and one syntax-repair attempt also failed. Original parse error: ${parseError}. Repair parse error: ${repairDetail}`,
        { cause: repairError }
      );
    }
  }

  const blueprint = normalizeBlueprint(parsedBlueprint, userPrompt);
  return {
    success: true,
    stage: "director",
    provider: finalProvider,
    model: finalModel,
    prompt: userPrompt,
    blueprint,
  };
}
