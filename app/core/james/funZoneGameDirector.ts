import { runJamesBrainWithSharedKnowledge } from "./jamesSharedKnowledge";
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
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
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
Ubah prompt pengguna menjadi spesifikasi game terstruktur yang konkret dan dapat dimainkan.
Tentukan genre, mood, difficulty, theme, world, coreLoop, objective, mechanics, playerActions,
controls, progression, replayability, winCondition, loseCondition, visualStyle, mobileNotes,
dan testRequirements. Genre bebas termasuk subgenre dan hybrid. Game harus memiliki player,
tujuan, gameplay loop, interaksi, progres, tantangan, kondisi menang dan kalah. Jangan membuat
quiz, dashboard, formulir, landing page, HTML, atau JavaScript. Visual style dan mekanik wajib
sesuai genre yang diminta; jangan mengganti genre dengan template generik. Untuk game 2D,
targetkan gameplay browser berbasis Phaser dan kontrol desktop/Android. controls, mechanics,
playerActions, mobileNotes, dan testRequirements harus berupa array string. Output hanya JSON valid.
`;

export async function generateFunZoneGameBlueprint(userPrompt: string): Promise<FunZoneGameDirectorResult> {
  const result = await runJamesBrainWithSharedKnowledge({
    surface: "fun_zone",
    mode: "game_director",
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `USER GAME REQUEST:\n\n${userPrompt}\n\nRancang blueprint yang spesifik untuk prompt ini. Jangan sekadar mengulang prompt dan jangan membuat kode. Output JSON saja.`,
    temperature: 0.8,
    maxOutputTokens: 7000,
  });
  const blueprint = normalizeBlueprint(extractJson(result.text), userPrompt);
  return {
    success: true,
    stage: "director",
    provider: result.provider,
    model: result.model,
    prompt: userPrompt,
    blueprint,
  };
}
