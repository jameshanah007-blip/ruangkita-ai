import type { GameBlueprint } from "../laboratory/types";
import { buildAssetRegistry } from "./assetRegistry";
import { generateLocalGameAssets } from "./assetGenerator";
import { materializeGameAssets, type AssetMaterializationResult } from "./assetMaterializer";
import { buildVisualBlueprint } from "./visualBlueprint";
import { buildPhaserGameHtml } from "../phaser/runtime";
import { compilePhaserGameSpec } from "../phaser/genreDefinitions";
import { validatePlayableRuntimeContract } from "./runtimeContract";

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 1200);
}

function inferGenre(text: string): string {
  const value = text.toLowerCase();
  if (/farm|farming|bertani|tanam|panen|kebun/.test(value)) return "farming";
  if (/platformer|platform|lompat|jump/.test(value)) return "platformer";
  if (/pokemon|monster tamer|creature/.test(value)) return "monster_tamer";
  if (/puzzle|teka.?teki|match|grid/.test(value)) return "puzzle";
  if (/adventure|petualangan|explore|jelajah/.test(value)) return "adventure";
  if (/rpg|role.?playing/.test(value)) return "rpg";
  if (/racing|race|balap/.test(value)) return "racing";
  if (/shooter|tembak|shoot/.test(value)) return "shooter";
  if (/survival|bertahan|zombie/.test(value)) return "survival";
  if (/strategy|strategi|tactical/.test(value)) return "strategy";
  if (/simulation|simulasi|management/.test(value)) return "simulation";
  return "";
}

export function createAutonomousGameBlueprint(prompt: string): GameBlueprint {
  const text = normalize(prompt);
  const genre = inferGenre(text);

  return {
    title: normalize(text.split(/[.!?]/)[0] || "James 2D Game").slice(0, 70),
    concept: text,
    genre,
    mood: /horror|horor|tegang|gelap/i.test(text) ? "tense" : "dynamic",
    difficulty: /hard|sulit|menantang/i.test(text) ? "hard" : "medium",
    theme: text,
    world: text,
    coreLoop: "move → interact → progress",
    objective: text.slice(0, 240),
    mechanics: genre ? [genre] : [],
    playerActions: ["move", "interact", "restart"],
    controls: ["WASD", "Arrow keys", "Touch"],
    progression: "Complete the requested objective.",
    replayability: "Restart and replay.",
    winCondition: "Complete the requested objective.",
    loseCondition: "Fail the requested objective.",
    visualStyle: "2D asset-backed game with animated sprites",
    mobileNotes: ["Touch-first controls", "Responsive Phaser canvas"],
    testRequirements: [
      "Phaser boots",
      "player is visible",
      "sprite animation works",
      "touch input works",
      "objective progresses",
      "restart works",
    ],
  };
}

export function buildAutonomousGameHtml(
  blueprint: GameBlueprint,
  materializedAssets?: AssetMaterializationResult,
  playerAssetId = "protagonist",
): string {
  const runtimeAssets = materializedAssets ?? materializeGameAssets(
    generateLocalGameAssets(buildAssetRegistry(buildVisualBlueprint(blueprint))),
  );
  const runtimeContract = validatePlayableRuntimeContract(
    blueprint,
    runtimeAssets,
    playerAssetId,
  );

  if (!runtimeContract.valid) {
    throw new Error(
      "Fun Zone 2D runtime contract failed: " + runtimeContract.errors.join("; "),
    );
  }

  const phaserAssets = runtimeAssets.assets.map((asset) => {
    const sheet = asset.metadata.providerMetadata?.spriteSheet;
    const spriteSheet =
      typeof sheet === "object" && sheet !== null
        ? (sheet as {
            frameWidth?: number;
            frameHeight?: number;
            frameCount?: number;
            rowCount?: number;
          })
        : null;

    return {
      id: asset.id,
      kind: asset.kind,
      uri: asset.uri,
      animationNeeds: asset.metadata.animationNeeds || [],
      animationMode: spriteSheet ? ("sprite-sheet" as const) : ("single-image" as const),
      frameWidth: spriteSheet?.frameWidth,
      frameHeight: spriteSheet?.frameHeight,
      frameCount: spriteSheet?.frameCount,
      rowCount: spriteSheet?.rowCount,
      characterDNA:
        (asset.metadata.providerMetadata?.characterDNA as Record<string, unknown> | undefined) ||
        null,
    };
  });

  const spec = compilePhaserGameSpec(
    blueprint,
    blueprint.concept || blueprint.title,
    phaserAssets,
    playerAssetId,
  );

  if (!spec) {
    throw new Error(
      `Fun Zone 2D runtime is not implemented for genre "${blueprint.genre}". Add a dedicated Phaser 2D genre adapter before enabling this genre.`,
    );
  }

  const specContract = validatePlayableRuntimeContract(
    blueprint,
    runtimeAssets,
    playerAssetId,
    spec,
  );

  if (!specContract.valid) {
    throw new Error(
      "Fun Zone Phaser spec contract failed: " + specContract.errors.join("; "),
    );
  }

  return buildPhaserGameHtml(spec);
}
