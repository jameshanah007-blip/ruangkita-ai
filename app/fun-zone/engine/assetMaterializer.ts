import type { AssetGenerationResult, GeneratedAsset } from "./assetGenerator";

export type MaterializedAsset = GeneratedAsset & {
  status: "ready" | "placeholder";
  materializer: "james-native-visual-engine" | "provider";
};

export type AssetMaterializationResult = {
  assets: MaterializedAsset[];
  warnings: string[];
};

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
function hasRealRacingImageContract(asset: GeneratedAsset): boolean {
  if (asset.entityKind !== "vehicle" && !isRacingTrack(asset)) return true;
  const provider = String(asset.metadata.provider || "");
  if (!provider || /local-fallback|james-native/i.test(provider)) return false;
  if (asset.metadata.fallback === true) return false;
  if (asset.metadata.imageBacked !== true && asset.metadata.providerMetadata?.imageBacked !== true) return false;
  if (asset.entityKind === "vehicle") {
    const mode = asset.metadata.providerMetadata?.animationMode;
    return mode === "single-image" || hasSpriteSheetMetadata(asset);
  }
  return true;
}

function requiresAnimatedSprite(asset: GeneratedAsset): boolean {
  return (
    asset.entityKind !== "vehicle" &&
    ["character", "npc", "enemy", "companion"].includes(asset.kind) &&
    asset.metadata.animationNeeds.length > 0
  );
}

export function materializeGameAssets(
  generation: AssetGenerationResult,
): AssetMaterializationResult {
  const assets = generation.assets.map((asset) => {
    const providerUri = asset.status === "ready" && !asset.uri.startsWith("asset://placeholder/");
    const racingImageContractMissing = (asset.entityKind === "vehicle" || isRacingTrack(asset)) &&
      (!providerUri || !hasRealRacingImageContract(asset));
    const animationContractMissing = requiresAnimatedSprite(asset) && !hasSpriteSheetMetadata(asset);
    if (racingImageContractMissing) {
      const uriScheme = asset.uri.includes(":") ? asset.uri.slice(0, asset.uri.indexOf(":")) : "unknown";
      const provider = asset.metadata.provider || "missing";
      const providerMetadata = asset.metadata.providerMetadata || {};
      const contentType = typeof providerMetadata.contentType === "string" ? providerMetadata.contentType : "unknown";
      const imageBacked = asset.metadata.imageBacked === true || providerMetadata.imageBacked === true;
      const reason = !providerUri ? "asset-not-ready-or-placeholder-uri" :
        !provider || /local-fallback|james-native/i.test(String(provider)) ? "provider-is-not-a-real-image-provider" :
        asset.metadata.fallback === true ? "fallback-flag-is-true" :
        !imageBacked ? "imageBacked-metadata-missing" :
        asset.entityKind === "vehicle" && providerMetadata.animationMode !== "single-image" && !hasSpriteSheetMetadata(asset) ? "vehicle-animation-metadata-invalid" : "unknown-contract-failure";
      console.error("Fun Zone racing asset contract rejected", {
        assetId: asset.id,
        entityKind: asset.entityKind || "environment",
        status: asset.status,
        provider,
        uriScheme,
        contentType,
        imageBacked,
        fallback: asset.metadata.fallback === true,
        reason,
      });
      throw new Error(
        `Racing visual contract rejected asset "${asset.id}" (provider=${provider}, status=${asset.status}, uriScheme=${uriScheme}, contentType=${contentType}, imageBacked=${imageBacked}, reason=${reason}). Real image assets are required; procedural/native fallback is disabled.`,
      );
    }
    if (!providerUri) {
      throw new Error(
        `Asset materialization failed for "${asset.id}" (kind=${asset.kind}, entityKind=${asset.entityKind || "unspecified"}, status=${asset.status}, provider=${asset.metadata.provider || "missing"}). The provider did not return a usable image; placeholder assets are not promoted to ready.`,
      );
    }

    if (animationContractMissing) {
      throw new Error(
        `Asset animation contract failed for "${asset.id}" (kind=${asset.kind}, entityKind=${asset.entityKind || "unspecified"}, provider=${asset.metadata.provider || "missing"}). Required sprite-sheet metadata is missing; materializer fallback is disabled.`,
      );
    }

    if (isForbiddenRacingFallback(asset)) {
      throw new Error(`Racing visual contract rejected fallback asset "${asset.id}". Racing vehicles and tracks must come from a real image asset provider; procedural/native geometry is not accepted.`);
    }

    return {
      ...asset,
      status: "ready" as const,
      uri: asset.uri,
      metadata: asset.metadata,
      materializer: "provider" as const,
    };
  });

  return {
    assets,
    warnings: [
      ...generation.warnings,
      "Materializer is fail-closed: unavailable images and missing required sprite-sheet metadata stop the build instead of being replaced with an unverified fallback.",
    ],
  };
}
