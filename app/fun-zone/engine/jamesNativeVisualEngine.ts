import type { AssetKind, GameAssetSpec } from "./assetRegistry";
import { buildCharacterDNA, characterDNAPrompt } from "./characterDNA";

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
    { hair: "#26356b", hair2: "#6478d8", skin: "#ffd9c7", suit: "#5b3cc4", accent: "#55c7ff", eye: "#4f8cff" },
    { hair: "#5b235f", hair2: "#c45ca8", skin: "#f3c6b0", suit: "#087f78", accent: "#ffd166", eye: "#40b7c9" },
    { hair: "#172033", hair2: "#58627a", skin: "#e8b49c", suit: "#b52d55", accent: "#ffe066", eye: "#55aaff" },
    { hair: "#6d3b21", hair2: "#c98b5b", skin: "#f2c6a8", suit: "#2458b8", accent: "#9ef0d0", eye: "#45b7ff" },
  ];
  return sets[seed % sets.length];
}

function characterSvg(asset: GameAssetSpec): string {
  const dna = buildCharacterDNA(asset);
  const seed = dna?.paletteSeed ?? hash(asset.prompt + asset.id);
  const p = palette(seed);
  const enemy = asset.kind === "enemy";
  const companion = asset.kind === "companion";
  const dnaPrompt = dna ? characterDNAPrompt(dna) : asset.prompt;
  const female = dna?.gender === "female" || /female|girl|woman|princess|heroine|perempuan|wanita/i.test(asset.prompt);
  const hasSword = /sword|katana|blade|weapon|pedang|samurai/i.test(dnaPrompt);
  const hasArmor = /armor|armour|knight|warrior|ksatria/i.test(dnaPrompt);
  const longHair = female || /long hair|rambut panjang/i.test(dnaPrompt);
  const suit = enemy ? "#7f243d" : companion ? "#087c9b" : p.suit;
  const accent = enemy ? "#ff5b7d" : p.accent;
  const hair = enemy ? "#182033" : p.hair;
  const hair2 = enemy ? "#596273" : p.hair2;
  const skin = enemy ? "#f4b1ad" : p.skin;
  const eye = enemy ? "#ff465f" : p.eye;
  const armor = hasArmor
    ? '<path d="M84 160 L104 150 L128 176 L152 150 L172 160 L164 202 L92 202Z" fill="#64748b" stroke="#1e293b" stroke-width="5"/><path d="M99 166 L128 186 L157 166" fill="none" stroke="#cbd5e1" stroke-width="5"/>'
    : '<path d="M91 158 Q128 177 165 158 L176 218 Q128 233 80 218Z" fill="' + suit + '" stroke="#182033" stroke-width="5"/><path d="M96 177 Q128 190 160 177" fill="none" stroke="' + accent + '" stroke-width="5"/>';

  const hairBack = longHair
    ? '<path d="M88 103 Q78 57 111 35 Q145 13 174 47 Q190 69 168 142 L150 126 L139 153 L105 142 L94 122Z" fill="' + hair + '" stroke="#172033" stroke-width="6"/>'
    : '<path d="M90 105 Q83 57 112 38 Q145 17 170 49 Q180 72 165 112 L150 84 Q128 95 106 78 L99 112Z" fill="url(#hair)" stroke="#172033" stroke-width="6"/>';

  const weapon = hasSword
    ? '<g><path d="M168 153 L224 72" stroke="#e5e7eb" stroke-width="8" stroke-linecap="round"/><path d="M162 157 L180 139" stroke="#f5b942" stroke-width="10" stroke-linecap="round"/><path d="M219 78 L228 66" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>'
    : '<path d="M175 161 Q203 148 220 165" fill="none" stroke="' + accent + '" stroke-width="8" stroke-linecap="round"/>';

  const eyeStyle = seed % 2 === 0
    ? '<ellipse cx="112" cy="105" rx="10" ry="14" fill="#fff"/><ellipse cx="144" cy="105" rx="10" ry="14" fill="#fff"/><ellipse cx="113" cy="107" rx="5" ry="8" fill="' + eye + '"/><ellipse cx="143" cy="107" rx="5" ry="8" fill="' + eye + '"/><circle cx="114" cy="104" r="2.5" fill="#fff"/><circle cx="144" cy="104" r="2.5" fill="#fff"/>'
    : '<path d="M103 104 Q112 96 121 104" fill="none" stroke="#172033" stroke-width="5" stroke-linecap="round"/><path d="M135 104 Q144 96 153 104" fill="none" stroke="#172033" stroke-width="5" stroke-linecap="round"/><circle cx="113" cy="105" r="5" fill="' + eye + '"/><circle cx="143" cy="105" r="5" fill="' + eye + '"/>';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hair}"/><stop offset="1" stop-color="${hair2}"/></linearGradient>
    <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${suit}"/><stop offset="1" stop-color="${accent}"/></linearGradient>
    <radialGradient id="skin"><stop stop-color="${skin}"/><stop offset="1" stop-color="${skin}"/></radialGradient>
  </defs>
  <ellipse cx="128" cy="239" rx="54" ry="8" fill="#020617" opacity=".35"/>
  ${hairBack}
  <path d="M84 213 Q84 169 104 151 L128 174 L152 151 Q172 169 172 213 L153 228 L103 228Z" fill="url(#cloth)" stroke="#172033" stroke-width="6"/>
  ${armor}
  <path d="M102 151 L83 187" stroke="${skin}" stroke-width="15" stroke-linecap="round"/><path d="M154 151 L176 185" stroke="${skin}" stroke-width="15" stroke-linecap="round"/>
  <path d="M102 204 L91 235 L114 235 L128 210 L142 235 L165 235 L154 204Z" fill="#182033" stroke="#0b1020" stroke-width="5"/>
  <path d="M93 101 Q94 59 128 54 Q162 59 163 101 L153 141 Q128 158 103 141Z" fill="url(#skin)" stroke="#172033" stroke-width="6"/>
  ${eyeStyle}
  <path d="M119 127 Q128 133 137 127" fill="none" stroke="#9f3e52" stroke-width="4" stroke-linecap="round"/>
  <path d="M96 83 Q111 69 128 74 Q145 69 158 83" fill="none" stroke="${hair2}" stroke-width="8" stroke-linecap="round"/>
  <path d="M96 151 Q128 176 160 151" fill="none" stroke="${accent}" stroke-width="6"/>
  <circle cx="128" cy="171" r="7" fill="${accent}" stroke="#fff" stroke-width="2"/>
  ${weapon}
  <title>${esc(asset.kind)}: ${esc(asset.prompt.slice(0, 180))}</title>
</svg>`;
}

function environmentSvg(asset: GameAssetSpec): string {
  const seed = hash(asset.prompt);
  const night = /night|malam|dark/i.test(asset.prompt) || seed % 2 === 0;
  const sky = night ? "#10172a" : "#87ceeb";
  const ground = night ? "#164e3b" : "#4d9b45";
  const water = /water|river|lake|laut|sungai/i.test(asset.prompt);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 288">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${night ? "#312e81" : "#dbeafe"}"/></linearGradient></defs>
  <rect width="512" height="288" fill="url(#sky)"/>
  <circle cx="430" cy="52" r="27" fill="${night ? "#f8fafc" : "#fde68a"}"/>
  <path d="M0 188 L72 111 L137 170 L220 77 L302 170 L386 106 L512 191 V288 H0Z" fill="${night ? "#1f3b38" : "#24613d"}"/>
  <path d="M0 222 Q90 180 178 222 T350 218 T512 225 V288 H0Z" fill="${ground}"/>
  ${water ? '<path d="M0 242 Q80 220 160 244 T320 241 T512 247 V288 H0Z" fill="#2563a8"/><path d="M25 257 Q100 244 176 258 T330 257 T490 260" fill="none" stroke="#bfdbfe" stroke-width="5"/>' : ''}
  <g fill="#14532d"><circle cx="75" cy="160" r="34"/><circle cx="430" cy="158" r="38"/></g>
  <g stroke="#78350f" stroke-width="14"><path d="M75 157 V205"/><path d="M430 155 V204"/></g>
  <path d="M36 250 Q120 220 202 254 T365 248 T500 256" fill="none" stroke="#d6d3d1" stroke-width="11" opacity=".8"/>
  <title>${esc(asset.prompt.slice(0, 180))}</title>
</svg>`;
}

function propSvg(asset: GameAssetSpec): string {
  const seed = hash(asset.prompt);
  const body = /chest|treasure|peti/i.test(asset.prompt)
    ? '<rect x="62" y="96" width="132" height="92" rx="16" fill="#8b4513" stroke="#3f2412" stroke-width="8"/><path d="M62 115 Q128 55 194 115" fill="#a86624" stroke="#3f2412" stroke-width="8"/><circle cx="128" cy="137" r="10" fill="#facc15"/>'
    : /tree|pohon/i.test(asset.prompt)
      ? '<path d="M112 205 L122 128 H134 L144 205Z" fill="#78350f"/><circle cx="128" cy="92" r="55" fill="#166534"/><circle cx="90" cy="120" r="34" fill="#15803d"/><circle cx="167" cy="119" r="36" fill="#15803d"/>'
      : seed % 3 === 0
        ? '<path d="M128 36 L152 91 L212 98 L166 136 L181 199 L128 164 L75 199 L90 136 L44 98 L104 91Z" fill="#facc15" stroke="#854d0e" stroke-width="7"/>'
        : '<path d="M74 83 Q128 40 182 83 V184 H74Z" fill="#2563eb" stroke="#172554" stroke-width="8"/><path d="M96 112 H160 M96 143 H160" stroke="#bfdbfe" stroke-width="9"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><!-- James Native prop --><rect width="256" height="256" rx="28" fill="#0f172a"/>${body}<title>${esc(asset.prompt.slice(0, 160))}</title></svg>`;
}

function effectSvg(asset: GameAssetSpec): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><radialGradient id="e"><stop stop-color="#fff7ae"/><stop offset=".35" stop-color="#facc15"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></radialGradient></defs><circle cx="128" cy="128" r="112" fill="url(#e)"/><path d="M128 22 L145 94 L220 112 L151 132 L128 224 L106 136 L36 112 L110 94Z" fill="#fff" opacity=".85"/><title>${esc(asset.prompt.slice(0, 160))}</title></svg>`;
}

function characterSpriteSheetSvg(asset: GameAssetSpec): string {
  const single = characterSvg(asset);
  const start = single.indexOf(">") + 1;
  const end = single.lastIndexOf("</svg>");
  const body = single.slice(start, end);
  const rows = [
    { name: "idle-down", flip: false, bob: [0, -2, 0, -1] },
    { name: "walk-down", flip: false, bob: [0, -3, 1, -2] },
    { name: "walk-up", flip: false, bob: [-1, 1, -1, 1] },
    { name: "walk-left", flip: true, bob: [0, -2, 0, 2] },
    { name: "walk-right", flip: false, bob: [0, 2, 0, -2] },
    { name: "action", flip: false, bob: [0, -4, 2, -2] },
    { name: "attack", flip: false, bob: [0, -5, 3, -1] },
    { name: "hit", flip: false, bob: [2, -1, -2, 1] },
    { name: "talk", flip: false, bob: [0, -2, 1, -1] },
    { name: "defeat", flip: false, bob: [3, 5, 8, 10] },
  ];
  const frameGroups = rows.map((row, rowIndex) => {
    return [0, 1, 2, 3].map((frame) => {
      const x = frame * 256;
      const y = rowIndex * 256;
      const bob = row.bob[frame];
      const sx = row.flip ? -1 : 1;
      const tx = row.flip ? x + 256 : x;
      return `<g transform="translate(${tx} ${y})"><g transform="translate(128 ${128 + bob}) scale(${sx} 1) translate(-128 -128)">${body}</g></g>`;
    }).join("");
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="2560" viewBox="0 0 1024 2560">${frameGroups}</svg>`;
}
export function generateJamesNativeVisual(asset: GameAssetSpec): { uri: string; metadata: Record<string, unknown> } {
  const dna = buildCharacterDNA(asset);
  const isCharacter = ["character", "npc", "enemy", "companion"].includes(asset.kind);
  const svg = asset.kind === "environment"
    ? environmentSvg(asset)
    : isCharacter
      ? characterSpriteSheetSvg(asset)
      : asset.kind === "effect"
        ? effectSvg(asset)
        : propSvg(asset);

  return {
    uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    metadata: {
      provider: "james-native-visual-engine-v2",
      identityPreserved: isCharacter,
      deterministic: true,
      style: /anime/i.test(asset.prompt) ? "anime-inspired-2d-v2" : "stylized-2d-v2",
      poseSet: dna?.animationNeeds ?? (asset.animationNeeds.length ? asset.animationNeeds : ["idle", "move", "action", "hit", "talk"]),
      assetPrompt: asset.prompt,
      characterDNA: dna,
      identityKey: dna?.identityKey ?? asset.id,
      spriteSheet: isCharacter ? { frameWidth: 256, frameHeight: 256, frameCount: 4, rowCount: 10, states: ["idle-down","walk-down","walk-up","walk-left","walk-right","action","attack","hit","talk","defeat"], fps: 8 } : null,
    },
  };
}

export const JAMES_NATIVE_VISUAL_PROVIDER = {
  name: "james-native-visual-engine-v2",
  supports: ["character", "npc", "enemy", "companion", "environment", "prop", "effect", "ui"] as AssetKind[],
};
