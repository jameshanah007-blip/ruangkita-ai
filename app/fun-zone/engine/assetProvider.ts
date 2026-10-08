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
  source: "curated-public";
  license: "CC0";
  animationMode?: "sprite-sheet" | "single-image";
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  rowCount?: number;
};

const LOCAL_REAL_ASSETS: LocalRealAssetEntry[] = [
  {
    uri: "https://lpc.opengameart.org/sites/default/files/car_frames.png",
    entityKind: "vehicle",
    tags: ["racing-vehicle", "sprite-asset", "top-down", "racing", "animated"],
    source: "curated-public",
    license: "CC0",
    animationMode: "sprite-sheet",
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 65,
    rowCount: 65,
  },
  {
    uri: "https://opengameart.org/sites/default/files/trackselectbackground_0.png",
    tags: ["racing-track", "track", "environment-asset", "top-down", "racing"],
    source: "curated-public",
    license: "CC0",
    animationMode: "single-image",
  },
];

async function materializePublicImage(uri: string): Promise<string> {
  const response = await fetch(uri, {
    headers: { Accept: "image/png,image/*;q=0.9,*/*;q=0.1" },
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error(`Curated image fetch failed (${response.status}) for ${uri}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Curated asset did not return an image (${contentType}) for ${uri}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const maxBytes = 3 * 1024 * 1024;
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
    throw new Error(`Curated image size is invalid (${bytes.byteLength} bytes) for ${uri}`);
  }

  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

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
  name: "curated-real-asset-library-v1",
  supports: ["character", "environment"],
  async generate(asset) {
    if (!isRacingAsset(asset)) {
      throw new Error("Local real asset library currently has no non-racing catalog entry for asset: " + asset.id);
    }
    const entry = LOCAL_REAL_ASSETS.find((candidate) => matches(candidate, asset));
    if (!entry) {
      throw new Error("No matching curated real image asset exists for: " + asset.id);
    }
    const dataUri = await materializePublicImage(entry.uri);
    return {
      uri: dataUri,
      metadata: {
        provider: "curated-real-asset-library-v1",
        source: entry.source,
        license: entry.license,
        imageBacked: true,
        fallback: false,
        tags: entry.tags,
        animationMode: entry.animationMode,
        ...(entry.frameWidth ? { spriteSheet: {
          frameWidth: entry.frameWidth,
          frameHeight: entry.frameHeight,
          frameCount: entry.frameCount,
          rowCount: entry.rowCount,
        } } : {}),
        sourceUri: entry.uri,
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
