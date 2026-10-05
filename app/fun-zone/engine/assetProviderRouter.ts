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

/**
 * Routes each asset to the first provider that supports its kind.
 *
 * The router is deliberately deterministic. Provider order is controlled by
 * the caller, so James can later learn which provider works best without
 * changing the asset registry or runtime contracts.
 */
export function createAssetProviderRouter(
  providers: AssetProvider[] = [],
): AssetProviderRouter {
  const candidates = providers.filter((provider) => provider.name !== localAssetProvider.name);

  const select = (asset: GameAssetSpec): AssetProvider => {
    return candidates.find((provider) => supports(provider, asset.kind)) ?? localAssetProvider;
  };

  const generate = async (asset: GameAssetSpec) => {
    const provider = select(asset);

    if (provider.name === localAssetProvider.name) {
      return {
        provider: localAssetProvider.name,
        result: await localAssetProvider.generate(asset),
        fallback: true,
      };
    }

    try {
      return {
        provider: provider.name,
        result: await provider.generate(asset),
        fallback: false,
      };
    } catch (error) {
      return {
        provider: localAssetProvider.name,
        result: {
          ...(await localAssetProvider.generate(asset)),
          metadata: {
            fallbackFrom: provider.name,
            fallbackReason: error instanceof Error ? error.message : String(error),
          },
        },
        fallback: true,
      };
    }
  };

  return {
    name: "james-asset-provider-router-v1",
    providers: [localAssetProvider, ...candidates],
    select,
    generate,
  };
}
