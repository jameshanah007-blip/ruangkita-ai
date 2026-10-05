import type { AssetRegistry, GameAssetSpec } from "./assetRegistry";

export type GeneratedAsset = {
  id: string;
  kind: GameAssetSpec["kind"];
  status: "ready" | "placeholder";
  uri: string;
  metadata: {
    prompt: string;
    tags: string[];
    animationNeeds: string[];
  };
};

export type AssetGenerationResult = {
  assets: GeneratedAsset[];
  warnings: string[];
};

/**
 * Provider-neutral contract for visual generation.
 * The current implementation intentionally uses deterministic placeholders.
 * A real image/sprite provider can be plugged in later without changing
 * Game Director, Visual Director, or Game Builder contracts.
 */
export function generateGameAssets(registry: AssetRegistry): AssetGenerationResult {
  const assets = registry.assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    status: "placeholder" as const,
    uri: `asset://placeholder/${encodeURIComponent(asset.id)}`,
    metadata: {
      prompt: asset.prompt,
      tags: asset.tags,
      animationNeeds: asset.animationNeeds,
    },
  }));

  return {
    assets,
    warnings: [
      "Visual assets currently use provider-neutral placeholders.",
      "Connect a real image/sprite generator to materialize generated assets.",
    ],
  };
}
