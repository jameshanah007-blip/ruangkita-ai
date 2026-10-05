import type { AssetKind, GameAssetSpec } from "./assetRegistry";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[c] || c));
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function palette(seed: number) {
  const sets = [
    { hair: "#172554", skin: "#ffd7c2", suit: "#7c3aed", accent: "#38bdf8" },
    { hair: "#6b21a8", skin: "#f4c7ab", suit: "#0f766e", accent: "#f59e0b" },
    { hair: "#1e293b", skin: "#e8b89f", suit: "#be123c", accent: "#facc15" },
    { hair: "#78350f", skin: "#f2c4a8", suit: "#1d4ed8", accent: "#a7f3d0" },
  ];
  return sets[seed % sets.length];
}

function characterSvg(asset: GameAssetSpec): string {
  const p = palette(hash(asset.prompt + asset.id));
  const enemy = asset.kind === "enemy";
  const companion = asset.kind === "companion";
  const accent = enemy ? "#ef4444" : p.accent;
  const hair = enemy ? "#111827" : p.hair;
  const skin = enemy ? "#fca5a5" : p.skin;
  const suit = enemy ? "#7f1d1d" : companion ? "#0369a1" : p.suit;
  const weapon = /sword|katana|blade|weapon/i.test(asset.prompt)
    ? '<path d="M174 142 L225 66" stroke="#e5e7eb" stroke-width="8" stroke-linecap="round"/><path d="M163 151 L181 133" stroke="#f59e0b" stroke-width="9" stroke-linecap="round"/>'
    : '<path d="M178 143 Q207 132 220 150" fill="none" stroke="#e5e7eb" stroke-width="8" stroke-linecap="round"/>';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#312e81"/></linearGradient><linearGradient id="hair" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hair}"/><stop offset="1" stop-color="${enemy ? "#374151" : p.accent}"/></linearGradient></defs>
  <rect width="256" height="256" rx="28" fill="url(#bg)"/>
  <ellipse cx="128" cy="228" rx="76" ry="13" fill="#020617" opacity=".55"/>
  <path d="M78 218 Q82 156 128 150 Q174 156 178 218Z" fill="${suit}" stroke="#0f172a" stroke-width="5"/>
  <path d="M95 163 L76 204 L96 211 L112 174Z" fill="${suit}" stroke="#0f172a" stroke-width="5"/>
  <path d="M161 163 L180 204 L160 211 L144 174Z" fill="${suit}" stroke="#0f172a" stroke-width="5"/>
  <path d="M103 204 L92 236 L114 236 L128 211 L142 236 L164 236 L153 204Z" fill="#111827" stroke="#020617" stroke-width="5"/>
  <path d="M91 105 Q92 52 128 48 Q164 52 165 105 L151 145 Q128 160 105 145Z" fill="${skin}" stroke="#111827" stroke-width="5"/>
  <path d="M91 105 Q83 61 111 39 Q143 19 169 50 Q179 70 165 113 L151 82 Q131 96 106 77 L99 112Z" fill="url(#hair)" stroke="#111827" stroke-width="5"/>
  <path d="M101 84 Q110 67 128 70 Q146 67 155 84" fill="none" stroke="${hair}" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="113" cy="105" rx="9" ry="12" fill="#fff"/><ellipse cx="143" cy="105" rx="9" ry="12" fill="#fff"/>
  <circle cx="114" cy="107" r="4" fill="#111827"/><circle cx="142" cy="107" r="4" fill="#111827"/>
  <path d="M119 127 Q128 133 137 127" fill="none" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>
  <path d="M96 151 L128 174 L160 151" fill="none" stroke="${accent}" stroke-width="7"/>
  <circle cx="128" cy="171" r="7" fill="${accent}" stroke="#fff" stroke-width="2"/>
  ${weapon}
  <path d="M74 178 L53 158" stroke="${skin}" stroke-width="14" stroke-linecap="round"/><path d="M182 178 L202 158" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
  <title>${esc(asset.kind)}: ${esc(asset.prompt.slice(0, 140))}</title>
</svg>`;
}

function environmentSvg(asset: GameAssetSpec): string {
  const seed = hash(asset.prompt);
  const night = seed % 2 === 0;
  const sky = night ? "#111827" : "#7dd3fc";
  const ground = night ? "#14532d" : "#65a30d";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 288">
  <rect width="512" height="288" fill="${sky}"/><circle cx="430" cy="55" r="30" fill="${night ? "#e2e8f0" : "#fde68a"}"/>
  <path d="M0 188 L85 102 L155 172 L235 78 L330 175 L414 110 L512 190 V288 H0Z" fill="${night ? "#1e3a2a" : "#166534"}"/>
  <path d="M0 226 Q90 184 178 224 T350 220 T512 230 V288 H0Z" fill="${ground}"/>
  <path d="M40 252 Q130 218 205 255 T360 250 T512 258" fill="none" stroke="#d6d3d1" stroke-width="13" opacity=".8"/>
  <circle cx="100" cy="174" r="18" fill="#854d0e"/><circle cx="100" cy="145" r="34" fill="#166534"/>
  <circle cx="410" cy="175" r="18" fill="#854d0e"/><circle cx="410" cy="142" r="36" fill="#166534"/>
  <title>${esc(asset.prompt.slice(0, 180))}</title>
</svg>`;
}

function propSvg(asset: GameAssetSpec): string {
  const seed = hash(asset.prompt);
  const type = seed % 3;
  const body = type === 0
    ? '<rect x="72" y="78" width="112" height="108" rx="14" fill="#92400e" stroke="#451a03" stroke-width="8"/><path d="M72 105 H184 M72 132 H184" stroke="#fbbf24" stroke-width="7"/>'
    : type === 1
      ? '<path d="M128 48 L190 92 L174 198 H82 L66 92Z" fill="#2563eb" stroke="#172554" stroke-width="8"/><path d="M100 112 H156 M100 142 H156" stroke="#bfdbfe" stroke-width="9"/>'
      : '<path d="M128 38 L151 92 L211 98 L166 137 L180 197 L128 164 L76 197 L90 137 L45 98 L105 92Z" fill="#facc15" stroke="#854d0e" stroke-width="7"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="28" fill="#0f172a"/>${body}<title>${esc(asset.prompt.slice(0, 160))}</title></svg>`;
}

export function generateJamesNativeVisual(asset: GameAssetSpec): { uri: string; metadata: Record<string, unknown> } {
  const svg = asset.kind === "environment"
    ? environmentSvg(asset)
    : ["character", "npc", "enemy", "companion"].includes(asset.kind)
      ? characterSvg(asset)
      : propSvg(asset);
  return {
    uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    metadata: {
      provider: "james-native-visual-engine-v1",
      identityPreserved: ["character", "npc", "enemy", "companion"].includes(asset.kind),
      deterministic: true,
      style: /anime/i.test(asset.prompt) ? "anime-inspired-2d" : "stylized-2d",
    },
  };
}

export const JAMES_NATIVE_VISUAL_PROVIDER = {
  name: "james-native-visual-engine-v1",
  supports: ["character", "npc", "enemy", "companion", "environment", "prop", "effect", "ui"] as AssetKind[],
};
