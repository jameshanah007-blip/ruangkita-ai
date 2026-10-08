import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AssetKind, GameAssetSpec } from "./assetRegistry";

export type AssetProviderResult = {
  uri: string;
  metadata?: Record<string, unknown>;
};

export type AssetProvider = {
  name: string;
  supports: AssetKind[];
  generate: (asset: GameAssetSpec) => Promise<AssetProviderResult>;
};

type LocalRealAssetEntry = {
  uri: string;
  entityKind?: GameAssetSpec["entityKind"];
  tags: string[];
  source: "vendored";
  license: "CC0";
  animationMode?: "sprite-sheet" | "single-image";
};

const LOCAL_REAL_ASSETS: LocalRealAssetEntry[] = [
  {
    uri: "/fun-zone-assets/racing/vehicles/car-red.png",
    entityKind: "vehicle",
    tags: ["racing-vehicle", "sprite-asset", "top-down", "racing"],
    source: "vendored",
    license: "CC0",
    animationMode: "single-image",
  },
  {
    uri: "/fun-zone-assets/racing/tracks/racing-circuit.png",
    tags: ["racing-track", "track", "environment-asset", "top-down", "racing"],
    source: "vendored",
    license: "CC0",
    animationMode: "single-image",
  },
];

function isRacingAsset(asset: GameAssetSpec): boolean {
  return asset.entityKind === "vehicle" || asset.tags.includes("racing-track");
}

function matches(entry: LocalRealAssetEntry, asset: GameAssetSpec): boolean {
  if (asset.entityKind && entry.entityKind !== asset.entityKind) return false;
  if (asset.tags.includes("racing-track") && !entry.tags.includes("racing-track")) return false;
  if (asset.entityKind === "vehicle" && entry.entityKind !== "vehicle") return false;
  return true;
}

export const localRealAssetProvider: AssetProvider = {
  name: "local-real-asset-library-v1",
  supports: ["character", "environment"],
  async generate(asset) {
    if (!isRacingAsset(asset)) {
      throw new Error("Local real asset library currently has no non-racing catalog entry for asset: " + asset.id);
    }
    const entry = LOCAL_REAL_ASSETS.find((candidate) => matches(candidate, asset));
    if (!entry) {
      throw new Error("No matching vendored real image asset exists for: " + asset.id);
    }
    return {
      uri: entry.uri,
      metadata: {
        provider: "local-real-asset-library-v1",
        source: entry.source,
        license: entry.license,
        imageBacked: true,
        fallback: false,
        tags: entry.tags,
        animationMode: entry.animationMode,
      },
    };
  },
};

export const localAssetProvider: AssetProvider = {
  name: "local-fallback",
  supports: [
    "character",
    "npc",
    "enemy",
    "companion",
    "environment",
    "prop",
    "effect",
    "ui",
  ],
  async generate(asset) {
    return {
      uri: `asset://placeholder/${encodeURIComponent(asset.id)}`,
      metadata: {
        provider: "local-fallback",
        identityPreserved: true,
      },
    };
  },
};
