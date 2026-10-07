import type { GameBlueprint } from "../laboratory/types";
import type { AssetMaterializationResult } from "./assetMaterializer";
import type { PhaserGameSpec } from "../phaser/types";

export type RuntimeContractResult = {
  valid: boolean;
  errors: string[];
};

export function validatePlayableRuntimeContract(
  blueprint: GameBlueprint,
  assets: AssetMaterializationResult,
  playerAssetId: string,
  spec?: PhaserGameSpec,
): RuntimeContractResult {
  const errors: string[] = [];
  const player = assets.assets.find((asset) => asset.id === playerAssetId);

  if (!player) errors.push(`player asset "${playerAssetId}" is missing`);
  else {
    if (player.status !== "ready") errors.push(`player asset "${playerAssetId}" is not ready`);
    if (!player.uri || !player.uri.startsWith("data:image/")) errors.push(`player asset "${playerAssetId}" is not a materialized image`);
    if (player.metadata.animationNeeds.length > 0 && !player.metadata.providerMetadata?.spriteSheet) {
      errors.push(`player asset "${playerAssetId}" has animation requirements but no sprite-sheet contract`);
    }
  }

  if (spec) {
    if (spec.player.assetId !== playerAssetId) errors.push("Phaser player contract does not match Laboratory player identity");
    if (!spec.assets.some((asset) => asset.id === spec.player.assetId)) errors.push("Phaser manifest does not contain the declared player");
  }

  if (!blueprint.genre.trim()) errors.push("game genre is empty");
  if (!blueprint.objective.trim()) errors.push("game objective is empty");

  return { valid: errors.length === 0, errors };
}
