import type { AssetGenerationResult, GeneratedAsset } from "./assetGenerator";

export type MaterializedAsset = GeneratedAsset & {
  status: "ready" | "placeholder";
  materializer: "svg-fallback-v1" | "provider";
};

export type AssetMaterializationResult = {
  assets: MaterializedAsset[];
  warnings: string[];
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[c] || c));
}

function svgForAsset(asset: GeneratedAsset): string {
  const label = escapeXml(asset.id.replace(/[-_]/g, " "));
  const kind = escapeXml(asset.kind);
  const prompt = escapeXml(asset.metadata.prompt.slice(0, 90));

  let body = '<circle cx="128" cy="104" r="54" fill="#38bdf8"/><circle cx="108" cy="94" r="7" fill="#07111f"/><circle cx="148" cy="94" r="7" fill="#07111f"/><path d="M105 122 Q128 140 151 122" fill="none" stroke="#07111f" stroke-width="7" stroke-linecap="round"/>';

  if (asset.kind === "environment") {
    body = '<rect width="256" height="160" y="32" rx="20" fill="#172554"/><circle cx="202" cy="72" r="25" fill="#fde68a"/><path d="M0 160 L65 92 L110 135 L160 76 L256 160Z" fill="#166534"/>';
  } else if (asset.kind === "enemy") {
    body = '<path d="M55 145 L75 55 L105 78 L128 38 L151 78 L181 55 L201 145Z" fill="#fb7185"/><circle cx="105" cy="105" r="8" fill="#fff"/><circle cx="151" cy="105" r="8" fill="#fff"/>';
  } else if (asset.kind === "npc" || asset.kind === "companion") {
    body = '<circle cx="128" cy="72" r="38" fill="#fbbf24"/><path d="M70 166 Q128 105 186 166Z" fill="#a78bfa"/>';
  } else if (asset.kind === "effect") {
    body = '<path d="M128 20 L150 94 L224 128 L150 150 L128 228 L106 150 L32 128 L106 94Z" fill="#facc15"/>';
  } else if (asset.kind === "prop") {
    body = '<rect x="58" y="58" width="140" height="120" rx="18" fill="#a78bfa"/><path d="M78 88 H178 M78 118 H178 M78 148 H150" stroke="#fff" stroke-width="10" stroke-linecap="round"/>';
  } else if (asset.kind === "ui") {
    body = '<rect x="30" y="70" width="196" height="116" rx="20" fill="#0f172a" stroke="#38bdf8" stroke-width="5"/><circle cx="70" cy="112" r="16" fill="#38bdf8"/><rect x="96" y="96" width="94" height="12" rx="6" fill="#94a3b8"/><rect x="96" y="122" width="70" height="12" rx="6" fill="#64748b"/>';
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0ea5e9"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="256" height="256" rx="28" fill="url(#g)" opacity=".18"/>${body}<text x="128" y="218" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="13" font-weight="700">${label}</text><title>${kind}: ${prompt}</title></svg>`;
}

export function materializeGameAssets(
  generation: AssetGenerationResult,
): AssetMaterializationResult {
  const assets = generation.assets.map((asset) => ({
    ...asset,
    status: "ready" as const,
    uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgForAsset(asset))}`,
    materializer: "svg-fallback-v1" as const,
  }));

  return {
    assets,
    warnings: [
      ...generation.warnings,
      "Assets are materialized as deterministic SVG fallbacks; a provider can replace them later without changing the asset registry contract.",
    ],
  };
}
