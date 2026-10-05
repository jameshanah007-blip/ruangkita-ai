import type { AssetRegistry, GameAssetSpec } from "./assetRegistry";
import { localAssetProvider, type AssetProvider } from "./assetProvider";

export type GeneratedAsset = {
  id: string;
  kind: GameAssetSpec["kind"];
  status: "ready" | "placeholder";
  uri: string;
  metadata: {
    prompt: string;
    tags: string[];
    animationNeeds: string[];
    provider?: string;
    providerMetadata?: Record<string, unknown>;
  };
};

export type AssetGenerationResult = {
  assets: GeneratedAsset[];
  warnings: string[];
};

/**
 * Generate assets through an optional provider.
 *
 * Backward compatibility is intentional: callers can continue using
 * generateGameAssets(registry), which uses the local fallback exactly as
 * before. Provider failures are isolated per asset so one unavailable
 * image provider cannot break game generation.
 */
export async function generateGameAssets(
  registry: AssetRegistry,
  provider?: AssetProvider,
): Promise<AssetGenerationResult> {
  const activeProvider = provider ?? localAssetProvider;
  const warnings: string[] = [];
  const assets: GeneratedAsset[] = [];

  for (const asset of registry.assets) {
    try {
      if (!activeProvider.supports.includes(asset.kind)) {
        throw new Error(`Provider "${activeProvider.name}" does not support asset kind "${asset.kind}".`);
      }

      const result = await activeProvider.generate(asset);
      assets.push({
        id: asset.id,
        kind: asset.kind,
        status: result.uri.startsWith("asset://placeholder/") ? "placeholder" : "ready",
        uri: result.uri,
        metadata: {
          prompt: asset.prompt,
          tags: asset.tags,
          animationNeeds: asset.animationNeeds,
          provider: activeProvider.name,
          providerMetadata: result.metadata,
        },
      });
    } catch (error) {
      warnings.push(
        `Asset provider "${activeProvider.name}" failed for "${asset.id}"; using local fallback.`,
      );

      const fallback = await localAssetProvider.generate(asset);
      assets.push({
        id: asset.id,
        kind: asset.kind,
        status: "placeholder",
        uri: fallback.uri,
        metadata: {
          prompt: asset.prompt,
          tags: asset.tags,
          animationNeeds: asset.animationNeeds,
          provider: "local-fallback",
          providerMetadata: {
            fallbackReason: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  }

  if (activeProvider.name === "local-fallback") {
    warnings.push("Visual assets currently use the local provider-neutral fallback.");
  }

  return { assets, warnings };
}
