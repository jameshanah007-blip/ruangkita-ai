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
    entityKind: asset.entityKind,
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

function isRacingTrack(asset: GeneratedAsset): boolean {
  return asset.metadata.tags.includes("racing-track");
}
function isForbiddenRacingFallback(asset: GeneratedAsset): boolean {
  return (asset.entityKind === "vehicle" || isRacingTrack(asset)) &&
    (asset.metadata.provider === "local-fallback" || asset.metadata.provider === "james-native-visual-engine-v2" || asset.metadata.fallback === true);
}
function buildVehicleSpriteSheetFromImage(asset: GeneratedAsset): { uri: string; metadata: Record<string, unknown> } {
  const safe = asset.uri.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const frames = [0, 1, 2, 3].map((frame) => {
    const x = frame * 256;
    const rotate = frame === 1 ? -3 : frame === 3 ? 3 : 0;
    const y = frame === 2 ? 2 : 0;
    return `<g transform="translate(${x} 0)"><image href="${safe}" x="20" y="${y}" width="216" height="216" preserveAspectRatio="xMidYMid meet" transform="rotate(${rotate} 128 128)"/></g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="256" viewBox="0 0 1024 256"><title>Generated racing vehicle sprite sheet</title>${frames}</svg>`;
  return {
    uri: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    metadata: { spriteSheet: { frameWidth: 256, frameHeight: 256, frameCount: 4, rowCount: 1, states: ["idle","drive","steer","finish"], fps: 8 }, sourceAssetUri: asset.uri, visualAssetType: "generated-raster-vehicle" },
  };
}
function requiresAnimatedSprite(asset: GeneratedAsset): boolean {
  return (
    asset.entityKind === "vehicle" ||
    (
      ["character", "npc", "enemy", "companion"].includes(asset.kind) &&
      asset.metadata.animationNeeds.length > 0
    )
  );
}

export function materializeGameAssets(
  generation: AssetGenerationResult,
): AssetMaterializationResult {
  const assets = generation.assets.map((asset) => {
    const providerUri = asset.status === "ready" && !asset.uri.startsWith("asset://placeholder/");
    const animationContractMissing = requiresAnimatedSprite(asset) && !hasSpriteSheetMetadata(asset);
    const useNative = !providerUri || animationContractMissing;

    if (animationContractMissing) {
      console.warn("Fun Zone asset provider lacks required sprite animation contract; using James Native Visual Engine:", {
        assetId: asset.id,
        kind: asset.kind,
        entityKind: asset.entityKind,
      });
    }

    if (isForbiddenRacingFallback(asset)) {
      throw new Error(`Racing visual contract rejected fallback asset "${asset.id}". Racing vehicles and tracks must come from a real image asset provider; procedural/native geometry is not accepted.`);
    }
    const vehicleSpriteSheet = asset.entityKind === "vehicle" && providerUri ? buildVehicleSpriteSheetFromImage(asset) : null;
    const native = useNative && !vehicleSpriteSheet ? nativeFallback(asset) : null;

    return {
      ...asset,
      status: "ready" as const,
      uri: vehicleSpriteSheet?.uri || native?.uri || asset.uri,
      metadata: vehicleSpriteSheet
        ? { ...asset.metadata, providerMetadata: { ...asset.metadata.providerMetadata, ...vehicleSpriteSheet.metadata }, fallback: false }
        : native
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
