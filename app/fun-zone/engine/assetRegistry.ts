export type AssetKind =
  | "character"
  | "npc"
  | "enemy"
  | "companion"
  | "environment"
  | "prop"
  | "effect"
  | "ui";

export type AssetSource =
  | "generated"
  | "procedural"
  | "provider"
  | "user"
  | "placeholder";

export type GameAssetSpec = {
  id: string;
  kind: AssetKind;
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

export function buildAssetRegistry(visual: {
  protagonist: { id: string; appearance: string[]; outfit: string[]; equipment: string[]; animationNeeds: string[] };
  characters: Array<{ id: string; role: AssetKind | "protagonist"; archetype: string; appearance: string[]; outfit: string[]; equipment: string[]; animationNeeds: string[] }>;
  environments: Array<{ id: string; description: string; props: string[] }>;
  props: string[];
  effects: string[];
  ui: string[];
}): AssetRegistry {
  const assets: GameAssetSpec[] = [];

  for (const character of visual.characters) {
    const kind: AssetKind = character.role === "protagonist" ? "character" : character.role;
    assets.push({
      id: character.id,
      kind,
      role: character.role,
      prompt: [
        character.archetype,
        ...character.appearance,
        ...character.outfit,
        ...character.equipment,
      ].join(", "),
      tags: [character.archetype, ...character.appearance],
      animationNeeds: character.animationNeeds,
      source: "generated",
      required: true,
    });
  }

  for (const environment of visual.environments) {
    assets.push({
      id: environment.id,
      kind: "environment",
      role: "world environment",
      prompt: [environment.description, ...environment.props].join(", "),
      tags: [environment.id],
      animationNeeds: [],
      source: "generated",
      required: true,
    });
  }

  visual.props.forEach((prop, index) => {
    assets.push({
      id: `prop-${index + 1}`,
      kind: "prop",
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
