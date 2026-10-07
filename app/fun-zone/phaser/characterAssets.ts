import type { PhaserGenre, PhaserGameSpec } from "./types";

type Palette = PhaserGameSpec["visual"]["palette"];

export type CharacterSpriteSet = {
  player: string[];
  creature?: string[];
};

function dataUri(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function playerFrame(role: "trainer" | "farmer" | "hero", frame: number, palette: Palette): string {
  const step = frame % 4;
  const leftLeg = step === 1 ? -3 : step === 3 ? 3 : 0;
  const rightLeg = step === 1 ? 3 : step === 3 ? -3 : 0;
  const leftArm = step === 1 ? -2 : step === 3 ? 2 : 0;
  const rightArm = step === 1 ? 2 : step === 3 ? -2 : 0;
  const body = role === "farmer" ? palette.ground : palette.accent;
  const accent = role === "farmer" ? palette.accent : "#4cc9f0";
  const hair = role === "farmer" ? "#6b3e26" : "#263238";
  const hat = role === "farmer"
    ? '<path d="M17 17h30v6H17zM11 23h42v5H11z" fill="#e9c46a"/><path d="M22 10h20v8H22z" fill="#c98b36"/>' 
    : '<path d="M20 10h25v6H20zM16 16h32v5H16z" fill="#263238"/><path d="M31 10h7v5h-7z" fill="#ffd166"/>';
  const outfit = role === "farmer"
    ? '<path d="M20 35h24v19H20z" fill="' + body + '"/><path d="M23 34h6v20h-6zM35 34h6v20h-6z" fill="#f4e7c5"/>'
    : '<path d="M19 34h26v22H19z" fill="' + body + '"/><path d="M28 35h8v20h-8z" fill="' + accent + '"/>';
  const shoes = role === "farmer" ? "#5b3a29" : "#263238";
  const armBand = role === "trainer" ? '<path d="M14 38h7v6h-7z" fill="#ffd166"/>' : "";
  const badge = role === "trainer" ? '<circle cx="40" cy="43" r="3" fill="#fefefe"/><circle cx="40" cy="43" r="1.3" fill="' + palette.danger + '"/>' : "";

  return dataUri('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80" shape-rendering="crispEdges">
    <g style="image-rendering:pixelated">
      <ellipse cx="32" cy="75" rx="17" ry="3" fill="#000" opacity=".28"/>
      <path d="M23 ' + (55 + leftLeg) + 'h8v13h-8zM33 ' + (55 + rightLeg) + 'h8v13h-8z" fill="' + shoes + '"/>
      <path d="M22 67h10v4H22zM32 67h10v4H32z" fill="#111827"/>
      ' + outfit + '
      <path d="M15 ' + (36 + leftArm) + 'h6v17h-6zM43 ' + (36 + rightArm) + 'h6v17h-6z" fill="' + body + '"/>
      ' + armBand + '
      <rect x="18" y="20" width="28" height="17" rx="4" fill="#f1c27d"/>
      <path d="M18 22h5v13h-5zM41 22h5v13h-5z" fill="#e0a46b"/>
      <path d="M22 20h22v5H22zM25 16h16v5H25z" fill="' + hair + '"/>
      ' + hat + '
      <rect x="25" y="28" width="4" height="4" fill="#1f2937"/>
      <rect x="36" y="28" width="4" height="4" fill="#1f2937"/>
      <rect x="29" y="35" width="8" height="3" fill="#7f1d1d"/>
      ' + badge + '
    </g>
  </svg>');
}

function creatureFrame(frame: number, palette: Palette): string {
  const bob = frame === 1 ? -2 : frame === 3 ? 2 : 0;
  const ear = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  return dataUri('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="64" viewBox="0 0 72 64" shape-rendering="crispEdges">
    <g transform="translate(0 ' + bob + ')" style="image-rendering:pixelated">
      <ellipse cx="36" cy="58" rx="20" ry="3" fill="#000" opacity=".25"/>
      <path d="M17 25h8v-8h7v8h8v-8h7v8h8v22H17z" fill="' + palette.accent + '"/>
      <path d="M18 22h8v' + (8 + ear) + 'h-8zM46 22h8v' + (8 - ear) + 'h-8z" fill="' + palette.danger + '"/>
      <path d="M25 34h7v7h-7zM40 34h7v7h-7z" fill="#fff"/>
      <rect x="27" y="36" width="3" height="3" fill="#172033"/>
      <rect x="42" y="36" width="3" height="3" fill="#172033"/>
      <path d="M29 47h14v4H29z" fill="#172033"/>
      <path d="M31 24h10v4H31z" fill="#fff" opacity=".35"/>
      <path d="M55 39h8v5h-8zM61 34h6v6h-6z" fill="' + palette.danger + '"/>
    </g>
  </svg>');
}

export function getCharacterSpriteSet(
  genre: PhaserGenre,
  palette: Palette,
): CharacterSpriteSet {
  const role = genre === "farming" ? "farmer" : genre === "monster_tamer" ? "trainer" : "hero";
  return {
    player: [0, 1, 2, 3].map((frame) => playerFrame(role, frame, palette)),
    ...(genre === "monster_tamer"
      ? { creature: [0, 1, 2, 3].map((frame) => creatureFrame(frame, palette)) }
      : {}),
  };
}
