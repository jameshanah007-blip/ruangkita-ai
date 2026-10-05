import assert from "node:assert/strict";
import { buildGameSystemPlan } from "../app/fun-zone/engine/gameSystemFactory.ts";
import { composeGamePlan } from "../app/fun-zone/engine/gameComposer.ts";
import { buildVisualBlueprint } from "../app/fun-zone/engine/visualBlueprint.ts";
import { buildAssetRegistry } from "../app/fun-zone/engine/assetRegistry.ts";
import { generateGameAssets, generateLocalGameAssets } from "../app/fun-zone/engine/assetGenerator.ts";
import { materializeGameAssets } from "../app/fun-zone/engine/assetMaterializer.ts";
import { buildCharacterAssetPlan } from "../app/fun-zone/engine/characterAssetPipeline.ts";
import {
  createModularGameState,
  captureCreature,
  addToParty,
  switchPartyMember,
  startTurnBattle,
  performBattleAttack,
  gainCreatureExperience,
  evolveCreature,
} from "../app/fun-zone/engine/gameplayModules.ts";

function blueprint(overrides = {}) {
  return {
    title: "System Factory Test",
    concept: "",
    genre: "Adventure",
    mood: "fun",
    difficulty: "normal",
    theme: "test",
    world: "test world",
    coreLoop: "explore, interact, progress",
    objective: "complete the objective",
    mechanics: [],
    playerActions: ["move", "interact"],
    controls: ["keyboard"],
    progression: "progress",
    replayability: "replay",
    winCondition: "win",
    loseCondition: "lose",
    visualStyle: "procedural",
    mobileNotes: "mobile friendly",
    testRequirements: [],
    ...overrides,
  };
}

const pokemonLike = blueprint({
  concept: "Creature collection RPG adventure with turn based creature battle, team of creatures, capture, leveling and evolution.",
  genre: "RPG",
  mechanics: ["capture creatures", "turn based battle", "party", "evolution"],
  playerActions: ["explore", "capture", "battle", "switch team", "evolve"],
});

const pokemonPlan = buildGameSystemPlan(pokemonLike);
for (const required of ["exploration", "collection", "party", "turnBasedCombat", "progression", "evolution"]) {
  assert.ok(pokemonPlan.systems.includes(required), `creature RPG should include ${required}`);
}
const visual = buildVisualBlueprint(pokemonLike);\nconst characterPlan = buildCharacterAssetPlan(visual.characters, visual.artDirection.style);\nconst registry = buildAssetRegistry(visual);\nconst generated = generateLocalGameAssets(registry);\nconst materialized = materializeGameAssets(generated);\nassert.ok(characterPlan.characters.length > 0);\nassert.ok(characterPlan.consistencyRules.length >= 3);\nassert.ok(characterPlan.characters[0].identityKey.length > 10);\nassert.ok(registry.requiredAssetIds.length > 0);\nassert.equal(materialized.assets.length, registry.assets.length);\nassert.ok(materialized.assets.every((asset) => asset.uri.startsWith("data:image/svg+xml")));\nassert.ok(materialized.assets.every((asset) => asset.status === "ready"));

const provider = {
  name: "test-image-provider",
  supports: ["character", "npc", "enemy", "companion", "environment", "prop", "effect", "ui"],
  async generate(asset) {
    return {
      uri: `data:image/test,${asset.id}`,
      metadata: { identityKey: asset.id, promptEcho: asset.prompt },
    };
  },
};
const providerGenerated = await generateGameAssets(registry, provider);
assert.ok(providerGenerated.assets.every((asset) => asset.status === "ready"));
assert.ok(providerGenerated.assets.every((asset) => asset.metadata.provider === "test-image-provider"));
assert.equal(providerGenerated.assets[0].metadata.providerMetadata.identityKey, providerGenerated.assets[0].id);
const providerMaterialized = materializeGameAssets(providerGenerated);
assert.ok(providerMaterialized.assets.every((asset) => asset.materializer === "provider"));
assert.ok(providerMaterialized.assets.every((asset) => asset.uri.startsWith("data:image/test,")));

const failingProvider = {
  name: "failing-provider",
  supports: ["character", "npc", "enemy", "companion", "environment", "prop", "effect", "ui"],
  async generate() {
    throw new Error("simulated provider outage");
  },
};
const fallbackGenerated = await generateGameAssets(registry, failingProvider);
assert.ok(fallbackGenerated.warnings.some((warning) => warning.includes("failing-provider")));
assert.ok(fallbackGenerated.assets.every((asset) => asset.status === "placeholder"));
assert.ok(fallbackGenerated.assets.every((asset) => asset.metadata.provider === "local-fallback"));\n\nconst composed = composeGamePlan(pokemonLike);
assert.ok(composed.requiredActions.includes("capture"));
assert.ok(composed.requiredActions.includes("switchMember"));
assert.ok(composed.requiredActions.includes("chooseAction"));
assert.ok(composed.testGoals.some((goal) => goal.includes("collection")));
assert.ok(composed.testGoals.some((goal) => goal.includes("form")));

const farming = buildGameSystemPlan(blueprint({
  concept: "A farming life simulation where the player plants, harvests, crafts and sells crops.",
  genre: "Simulation",
  mechanics: ["plant", "harvest", "craft", "shop"],
}));
assert.ok(farming.systems.includes("farming"));
assert.ok(farming.systems.includes("crafting"));
assert.ok(farming.systems.includes("economy"));

const racing = buildGameSystemPlan(blueprint({
  concept: "Fast mobile racing game with checkpoints, laps and vehicle upgrades.",
  genre: "Racing",
  mechanics: ["race", "checkpoint", "upgrade"],
}));
assert.ok(racing.systems.includes("racing"));
assert.ok(racing.systems.includes("progression"));

const puzzle = buildGameSystemPlan(blueprint({
  concept: "A grid puzzle where the player solves logic patterns.",
  genre: "Puzzle",
  mechanics: ["grid", "logic", "solve"],
}));
assert.ok(puzzle.systems.includes("puzzle"));

let state = createModularGameState();
const hero = {
  id: "hero-creature",
  name: "Testling",
  level: 1,
  hp: 30,
  maxHp: 30,
  attack: 12,
  defense: 5,
  form: "base",
};
const enemy = {
  id: "enemy-creature",
  name: "Training Beast",
  level: 1,
  hp: 8,
  maxHp: 8,
  attack: 5,
  defense: 2,
};
state = captureCreature(state, hero);
state = captureCreature(state, enemy);
state = addToParty(state, hero.id);
state = addToParty(state, enemy.id);
state = switchPartyMember(state, 1);
assert.equal(state.party.activeIndex, 1);

state = startTurnBattle(state, hero.id, enemy.id);
state = performBattleAttack(state);
assert.equal(state.battle.active, false);
assert.equal(state.progression.xp, 50);

state = gainCreatureExperience(state, hero.id, 450);
const leveled = state.collection.creatures.find((c) => c.id === hero.id);
assert.ok(leveled && leveled.level >= 5);

state = evolveCreature(state, hero.id, "Testling Ascended");
const evolved = state.collection.creatures.find((c) => c.id === hero.id);
assert.equal(evolved?.form, "Testling Ascended");
assert.ok(state.evolution.evolvedCreatureIds.includes(hero.id));

console.log("Fun Zone Game System Factory stress test: PASS");
console.log(JSON.stringify({
  creatureRpg: pokemonPlan.systems,
  farming: farming.systems,
  racing: racing.systems,
  puzzle: puzzle.systems,
  characterPipeline: {\n    characters: characterPlan.characters.length,\n    identityKey: characterPlan.characters[0].identityKey,\n  },\n  visualAssets: {\n    count: materialized.assets.length,\n    ready: materialized.assets.filter((asset) => asset.status === "ready").length,\n  },\n  creatureRuntime: {
    partyIndex: state.party.activeIndex,
    xp: state.progression.xp,
    level: evolved?.level,
    form: evolved?.form,
  },
}, null, 2));
