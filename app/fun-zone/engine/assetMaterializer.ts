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

function nativeFallback(asset: GeneratedAsset): { uri: string; metadata: Record<string, unknown> } {
  return generateJamesNativeVisual({
    id: asset.id,
    kind: asset.kind,
    role: asset.kind,
    prompt: asset.metadata.prompt,
    tags: asset.metadata.tags,
    animationNeeds: asset.metadata.animationNeeds,
    source: "procedural",
    required: true,
  });
}

function hasSpriteSheetMetadata(asset: GeneratedAsset): boolean {
  const spriteSheet = asset.metadata.providerMetadata?.spriteSheet;
  return Boolean(
    spriteSheet &&
    typeof spriteSheet === "object" &&
    Number((spriteSheet as { frameWidth?: unknown }).frameWidth) > 0 &&
    Number((spriteSheet as { frameHeight?: unknown }).frameHeight) > 0 &&
    Number((spriteSheet as { frameCount?: unknown }).frameCount) >= 2 &&
    Number((spriteSheet as { rowCount?: unknown }).rowCount) >= 1,
  );
}

function requiresAnimatedCharacter(asset: GeneratedAsset): boolean {
  return (
    asset.kind === "character" ||
    asset.kind === "npc" ||
    asset.kind === "enemy" ||
    asset.kind === "companion"
  ) && asset.metadata.animationNeeds.length > 0;
}

export function materializeGameAssets(
  generation: AssetGenerationResult,
): AssetMaterializationResult {
  const assets = generation.assets.map((asset) => {
    const providerUri = asset.status === "ready" && !asset.uri.startsWith("asset://placeholder/");
    const animationContractMissing = requiresAnimatedCharacter(asset) && !hasSpriteSheetMetadata(asset);
    const useNative = !providerUri || animationContractMissing;

    if (animationContractMissing) {
      console.warn("Fun Zone asset provider lacks required character animation contract; using James Native Visual Engine:", {
        assetId: asset.id,
        kind: asset.kind,
      });
    }

    const native = useNative ? nativeFallback(asset) : null;

    return {
      ...asset,
      status: "ready" as const,
      uri: native?.uri || asset.uri,
      metadata: native
        ? {
            ...asset.metadata,
            provider: "james-native-visual-engine-v2",
            providerMetadata: {
              ...asset.metadata.providerMetadata,
              ...native.metadata,
            },
            fallback: true,
          }
        : asset.metadata,
      materializer: native ? "james-native-visual-engine" as const : "provider" as const,
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
