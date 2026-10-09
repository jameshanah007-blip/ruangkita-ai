import type { VisualBlueprint } from "./visualBlueprint";
import { normalizeGameGenre } from "./normalizeGameGenre";

export type AssetKind =
  | "character"
  | "npc"
  | "enemy"
  | "companion"
  | "environment"
  | "prop"
  | "effect"
  | "ui";

export type AssetEntityKind = "character" | "vehicle";

export type AssetSource =
  | "generated"
  | "procedural"
  | "provider"
  | "user"
  | "placeholder";

export type GameAssetSpec = {
  id: string;
  kind: AssetKind;
  entityKind?: AssetEntityKind;
  role: string;
  prompt: string;
  tags: string[];
  animationNeeds: string[];
  source: AssetSource;
  required: boolean;
};

export type CharacterAssetPlan = {
  characters: Array<{ id: string; identityKey: string; description: string; animationNeeds: string[] }>;
  sharedStyle: string;
  consistencyRules: string[];
};

export type AssetRegistry = {
  version: 1;
  assets: GameAssetSpec[];
  requiredAssetIds: string[];
};

export function buildAssetRegistry(visual: VisualBlueprint): AssetRegistry {
  const assets: GameAssetSpec[] = [];
  const isRacing = normalizeGameGenre(visual.artDirection.genre) === "racing";
  const isPlatformer = normalizeGameGenre(visual.artDirection.genre) === "platformer";

  // The protagonist is the authoritative player identity. Keep it explicit in the registry even if a refinement/provider omits it from the generic characters array.
  const characterSpecs = [visual.protagonist, ...visual.characters.filter((character) => character.id !== visual.protagonist.id)];

  for (const character of characterSpecs) {
    const kind: AssetKind = character.role === "protagonist" ? "character" : character.role;
    const entityKind: AssetEntityKind =
      character.role === "protagonist" && isRacing
        ? "vehicle"
        : "character";

    assets.push({
      id: character.id,
      kind,
      entityKind,
      role: character.role,
      prompt: [
        character.archetype,
        ...character.appearance,
        ...character.outfit,
        ...character.equipment,
      ].join(", "),
      tags: [character.archetype, ...character.appearance, ...(entityKind === "vehicle" ? ["racing-vehicle", "sprite-asset"] : [])],
      animationNeeds: character.animationNeeds,
      source: "generated",
      required: true,
    });
  }

  for (const environment of visual.environments) {
    assets.push({
      id: environment.id,
      kind: "environment",
      entityKind: undefined,
      role: "world environment",
      prompt: [environment.description, ...environment.props].join(", "),
      tags: [environment.id, ...(isRacing ? ["racing-track", "track", "environment-asset"] : []), ...(isPlatformer && environment.id === "world-primary" ? ["platformer-environment"] : [])],
      animationNeeds: [],
      source: "generated",
      required: true,
    });
  }

  visual.props.forEach((prop, index) => {
    assets.push({
      id: `prop-${index + 1}`,
      kind: "prop",
      entityKind: undefined,
      role: "gameplay prop",
      prompt: prop,
      tags: ["gameplay", "interactive"],
      animationNeeds: [],
      source: "generated",
      required: false,
    });
  });

  visual.effects.forEach((effect, index) => {
    assets.push({
      id: `effect-${index + 1}`,
      kind: "effect",
      entityKind: undefined,
      role: "gameplay effect",
      prompt: effect,
      tags: ["gameplay", "feedback"],
      animationNeeds: ["trigger", "complete"],
      source: "generated",
      required: false,
    });
  });

  visual.ui.forEach((ui, index) => {
    assets.push({
      id: `ui-${index + 1}`,
      kind: "ui",
      entityKind: undefined,
      role: "interface",
      prompt: ui,
      tags: ["ui", "mobile"],
      animationNeeds: [],
      source: "generated",
      required: true,
    });
  });

  return {
    version: 1,
    assets,
    requiredAssetIds: assets.filter((asset) => asset.required).map((asset) => asset.id),
  };
}
