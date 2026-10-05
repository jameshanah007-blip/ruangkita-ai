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

export function createAssetProviderRouter(providers: AssetProvider[] = []): AssetProviderRouter {
  const candidates = providers.filter((provider) => provider.name !== localAssetProvider.name);

  const select = (asset: GameAssetSpec): AssetProvider => {
    return candidates.find((provider) => supports(provider, asset.kind)) ?? localAssetProvider;
  };

  const generate = async (asset: GameAssetSpec) => {
    const supported = candidates.filter((provider) => supports(provider, asset.kind));

    for (const provider of supported) {
      try {
        const result = await provider.generate(asset);
        console.info("Fun Zone asset generated:", {
          assetId: asset.id,
          kind: asset.kind,
          provider: provider.name,
        });
        return { provider: provider.name, result, fallback: false };
      } catch (error) {
        console.warn("Fun Zone asset provider failed; trying next provider:", {
          assetId: asset.id,
          kind: asset.kind,
          provider: provider.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const result = await localAssetProvider.generate(asset);
    return {
      provider: localAssetProvider.name,
      result,
      fallback: true,
    };
  };

  return {
    name: "james-asset-provider-router-v2",
    providers: [localAssetProvider, ...candidates],
    select,
    generate,
  };
}
