import type { VisualCharacterSpec } from "./visualBlueprint";

export type CharacterIdentity = {
  id: string;
  archetype: string;
  identityKey: string;
  description: string;
  visualTraits: string[];
  equipment: string[];
  expression: string;
  animationNeeds: string[];
};

export type CharacterAssetPlan = {
  characters: CharacterIdentity[];
  sharedStyle: string;
  consistencyRules: string[];
};

function stableKey(character: VisualCharacterSpec): string {
  return [
    character.id,
    character.archetype,
    ...character.appearance,
    ...character.outfit,
    ...character.equipment,
  ].join("|").toLowerCase().replace(/[^a-z0-9|]+/g, "-");
}

export function buildCharacterAssetPlan(
  characters: VisualCharacterSpec[],
  style: string,
): CharacterAssetPlan {
  const normalized = characters.map((character) => ({
    id: character.id,
    archetype: character.archetype,
    identityKey: stableKey(character),
    description: [
      character.archetype,
      ...character.appearance,
      ...character.outfit,
      ...character.equipment,
    ].join(", "),
    visualTraits: [...character.appearance, ...character.outfit],
    equipment: character.equipment,
    expression: character.expression,
    animationNeeds: [...character.animationNeeds],
  }));

  return {
    characters: normalized,
    sharedStyle: style,
    consistencyRules: [
      "Keep the same character identity across every generated pose.",
      "Preserve hair, eyes, outfit, silhouette and equipment unless the blueprint explicitly changes them.",
      "Generate animation frames from the same identity rather than creating a new character per frame.",
      "Never substitute a fixed repository character for a prompt-derived character.",
    ],
  };
}
