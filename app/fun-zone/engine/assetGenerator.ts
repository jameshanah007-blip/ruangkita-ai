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

function localAsset(asset: GameAssetSpec): GeneratedAsset {
  return {
    id: asset.id,
    kind: asset.kind,
    status: "placeholder",
    uri: `asset://placeholder/${encodeURIComponent(asset.id)}`,
    metadata: {
      prompt: asset.prompt,
      tags: asset.tags,
      animationNeeds: asset.animationNeeds,
      provider: "local-fallback",
      providerMetadata: {
        identityPreserved: true,
      },
    },
  };
}

/**
 * Synchronous compatibility path used by the existing local HTML compiler.
 * It preserves the original no-provider behavior and never introduces an
 * async boundary into buildLocalGameHtml().
 */
export function generateLocalGameAssets(registry: AssetRegistry): AssetGenerationResult {
  return {
    assets: registry.assets.map(localAsset),
    warnings: ["Visual assets currently use the local provider-neutral fallback."],
  };
}

/**
 * Provider-aware generation path.
 *
 * Provider failures are isolated per asset so an unavailable image provider
 * cannot break game generation. Unsupported asset kinds also fall back locally.
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
      assets.push(localAsset(asset));
    }
  }

  return { assets, warnings };
}
