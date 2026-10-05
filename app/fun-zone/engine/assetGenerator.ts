import type { AssetRegistry, GameAssetSpec } from "./assetRegistry";
import { localAssetProvider, type AssetProvider } from "./assetProvider";
import { createAssetProviderRouter } from "./assetProviderRouter";

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
    fallback?: boolean;
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
      providerMetadata: { identityPreserved: true },
      fallback: true,
    },
  };
}

export function generateLocalGameAssets(registry: AssetRegistry): AssetGenerationResult {
  return {
    assets: registry.assets.map(localAsset),
    warnings: ["Visual assets currently use the local provider-neutral fallback."],
  };
}

/**
 * Provider-aware generation through James' deterministic provider router.
 * Existing callers without a provider continue to use the local path.
 */
export async function generateGameAssets(
  registry: AssetRegistry,
  provider?: AssetProvider | AssetProvider[],
): Promise<AssetGenerationResult> {
  const providers = Array.isArray(provider)
    ? provider.filter(Boolean)
    : provider
      ? [provider]
      : [];
  const router = createAssetProviderRouter(providers);
  const warnings: string[] = [];
  const assets: GeneratedAsset[] = [];

  for (const asset of registry.assets) {
    const routed = await router.generate(asset);
    const isPlaceholder = routed.result.uri.startsWith("asset://placeholder/");

    if (routed.fallback) {
      warnings.push(
        `Asset "${asset.id}" used local fallback after provider routing.`,
      );
    }

    assets.push({
      id: asset.id,
      kind: asset.kind,
      status: isPlaceholder ? "placeholder" : "ready",
      uri: routed.result.uri,
      metadata: {
        prompt: asset.prompt,
        tags: asset.tags,
        animationNeeds: asset.animationNeeds,
        provider: routed.provider,
        providerMetadata: routed.result.metadata,
        fallback: routed.fallback,
      },
    });
  }

  if (providers.length === 0) {
    warnings.push("No external asset provider configured; James is using local fallback assets.");
  }

  return { assets, warnings };
}
