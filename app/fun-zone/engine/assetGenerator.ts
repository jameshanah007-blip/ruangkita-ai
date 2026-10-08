import type { AssetRegistry, GameAssetSpec } from "./assetRegistry";
import { localAssetProvider, type AssetProvider } from "./assetProvider";
import { createAssetProviderRouter } from "./assetProviderRouter";
import { generateJamesNativeVisual } from "./jamesNativeVisualEngine";
import { buildCharacterDNA } from "./characterDNA";
import { buildCharacterPoseSet } from "./characterPoseSystem";

const jamesNativeProvider: AssetProvider = {
  name: "james-native-visual-engine-v2",
  supports: ["character", "npc", "enemy", "companion", "environment", "prop", "effect", "ui"],
  async generate(asset) {
    return generateJamesNativeVisual(asset);
  },
};

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

export async function generateGameAssets(
  registry: AssetRegistry,
  provider?: AssetProvider | AssetProvider[],
): Promise<AssetGenerationResult> {
  const externalProviders = Array.isArray(provider)
    ? provider.filter(Boolean)
    : provider
      ? [provider]
      : [];
  const providers = [...externalProviders, jamesNativeProvider];
  const router = createAssetProviderRouter(providers);
  const warnings: string[] = [];
  const assets: GeneratedAsset[] = [];

  for (const asset of registry.assets) {
    const routed = await router.generate(asset);
    const isPlaceholder = routed.result.uri.startsWith("asset://placeholder/");

    if (routed.fallback) {
      warnings.push(`Asset "${asset.id}" used emergency placeholder fallback.`);
    }

    const characterDNA =
      asset.entityKind === "vehicle"
        ? null
        : (() => {
            const dna = buildCharacterDNA(asset);
            return dna ? { ...dna, poseSet: buildCharacterPoseSet(dna) } : null;
          })();

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
        providerMetadata: {
          ...routed.result.metadata,
          characterDNA,
        },
        fallback: routed.fallback,
      },
    });
  }

  return { assets, warnings };
}
