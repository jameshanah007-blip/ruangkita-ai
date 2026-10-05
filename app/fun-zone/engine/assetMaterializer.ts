import type { AssetGenerationResult, GeneratedAsset } from "./assetGenerator";
import { generateJamesNativeVisual } from "./jamesNativeVisualEngine";

export type MaterializedAsset = GeneratedAsset & {
  status: "ready" | "placeholder";
  materializer: "james-native-visual-engine" | "provider";
};

export type AssetMaterializationResult = {
  assets: MaterializedAsset[];
  warnings: string[];
};

function nativeFallback(asset: GeneratedAsset): string {
  const native = generateJamesNativeVisual({
    id: asset.id,
    kind: asset.kind,
    role: asset.kind,
    prompt: asset.metadata.prompt,
    tags: asset.metadata.tags,
    animationNeeds: asset.metadata.animationNeeds,
  });
  return native.uri;
}
export function materializeGameAssets(
  generation: AssetGenerationResult,
): AssetMaterializationResult {
  const assets = generation.assets.map((asset) => {
    const providerUri = asset.status === "ready" && !asset.uri.startsWith("asset://placeholder/");
    return {
      ...asset,
      status: "ready" as const,
      uri: providerUri ? asset.uri : nativeFallback(asset),
      materializer: providerUri ? "provider" as const : "james-native-visual-engine" as const,
    };
  });

  return {
    assets,
    warnings: [
      ...generation.warnings,
      "Provider assets are preserved when available; unavailable assets use the deterministic James Native Visual Engine instead of the legacy generic placeholder.",
    ],
  };
}
