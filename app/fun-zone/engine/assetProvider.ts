import type { AssetKind, GameAssetSpec } from "./assetRegistry";

export type AssetProviderResult = {
  uri: string;
  metadata?: Record<string, unknown>;
};

export type AssetProvider = {
  name: string;
  supports: AssetKind[];
  generate: (asset: GameAssetSpec) => Promise<AssetProviderResult>;
};

/**
 * Safe local provider contract.
 *
 * It intentionally returns a provider-neutral placeholder URI. The existing
 * SVG materializer remains responsible for producing a playable local asset.
 * A real image/sprite provider can implement AssetProvider without changing
 * the Game Director, Visual Director, registry, or builder contracts.
 */
export const localAssetProvider: AssetProvider = {
  name: "local-fallback",
  supports: [
    "character",
    "npc",
    "enemy",
    "companion",
    "environment",
    "prop",
    "effect",
    "ui",
  ],
  async generate(asset) {
    return {
      uri: `asset://placeholder/${encodeURIComponent(asset.id)}`,
      metadata: {
        provider: "local-fallback",
        identityPreserved: true,
      },
    };
  },
};
