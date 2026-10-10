import type { AssetKind, GameAssetSpec } from "./assetRegistry";
import { localAssetProvider, type AssetProvider, type AssetProviderResult } from "./assetProvider";

export type AssetProviderRouter = {
  name: string;
  providers: AssetProvider[];
  select: (asset: GameAssetSpec) => AssetProvider;
  generate: (asset: GameAssetSpec) => Promise<{
    provider: string;
    result: AssetProviderResult;
    fallback: boolean;
  }>;
};

function supports(provider: AssetProvider, kind: AssetKind): boolean {
  return provider.supports.includes(kind);
}

function requiresRealImageProvider(asset: GameAssetSpec): boolean {
  return asset.entityKind === "vehicle" || asset.tags.includes("racing-track");
}

function isProceduralProvider(provider: AssetProvider): boolean {
  return /local-fallback|james-native/i.test(provider.name);
}

function requiresAnimatedSprite(asset: GameAssetSpec): boolean {
  return (
    asset.entityKind !== "vehicle" &&
    ["character", "npc", "enemy", "companion"].includes(asset.kind) &&
    asset.animationNeeds.length > 0
  );
}

function hasValidSpriteSheetContract(result: AssetProviderResult): boolean {
  const sheet = result.metadata?.spriteSheet;
  if (!sheet || typeof sheet !== "object") return false;
  const value = sheet as Record<string, unknown>;
  return (
    Number(value.frameWidth) > 0 &&
    Number(value.frameHeight) > 0 &&
    Number(value.frameCount) >= 2 &&
    Number(value.rowCount) >= 1
  );
}

function isVerifiedRealImageResult(result: AssetProviderResult): boolean {
  return (
    result.metadata?.imageBacked === true &&
    typeof result.uri === "string" &&
    result.uri.startsWith("data:image/")
  );
}

export function createAssetProviderRouter(providers: AssetProvider[] = []): AssetProviderRouter {
  const candidates = providers.filter((provider) => provider.name !== localAssetProvider.name);

  const select = (asset: GameAssetSpec): AssetProvider => {
    const supported = candidates.filter((provider) => supports(provider, asset.kind));
    if (requiresRealImageProvider(asset)) {
      const realProvider = supported.find((provider) => !isProceduralProvider(provider));
      if (!realProvider) {
        throw new Error(
          `Racing asset "${asset.id}" requires a real image provider; no eligible provider is configured.`,
        );
      }
      return realProvider;
    }
    return supported[0] ?? localAssetProvider;
  };

  const generate = async (asset: GameAssetSpec) => {
    const strictImageAsset = requiresRealImageProvider(asset);
    const supported = candidates
      .filter((provider) => supports(provider, asset.kind))
      .filter((provider) => !strictImageAsset || !isProceduralProvider(provider));
    const failures: string[] = [];

    for (const provider of supported) {
      try {
        const result = await provider.generate(asset);
        if (strictImageAsset && !isVerifiedRealImageResult(result)) {
          throw new Error("Provider returned an unverified racing image result.");
        }

        // A single generated portrait is not an animation asset. Reject it at
        // provider routing time so the router can continue to the next provider
        // (including the identity-preserving sprite-sheet generator) instead
        // of letting a static image reach Phaser with false animation claims.
        if (requiresAnimatedSprite(asset) && !hasValidSpriteSheetContract(result)) {
          throw new Error(
            "Provider returned a static character image without a valid sprite-sheet contract; animation metadata is required.",
          );
        }

        console.info("Fun Zone asset generated:", {
          assetId: asset.id,
          kind: asset.kind,
          provider: provider.name,
        });
        return { provider: provider.name, result, fallback: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(provider.name + ": " + message);
        console.warn("Fun Zone asset provider failed; trying next provider:", {
          assetId: asset.id,
          kind: asset.kind,
          provider: provider.name,
          error: message,
        });
      }
    }

    if (strictImageAsset) {
      throw new Error(
        `Racing asset "${asset.id}" requires a real image provider and no real provider succeeded. Attempts: ${failures.join(" | ") || "no eligible image provider configured"}`,
      );
    }

    const result = await localAssetProvider.generate(asset);
    return {
      provider: localAssetProvider.name,
      result,
      fallback: true,
    };
  };

  return {
    name: "james-asset-provider-router-v3-strict-racing",
    providers: [localAssetProvider, ...candidates],
    select,
    generate,
  };
}
