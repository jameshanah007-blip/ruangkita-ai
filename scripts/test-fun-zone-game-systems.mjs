import assert from "node:assert/strict";
import { buildGameSystemPlan } from "../app/fun-zone/engine/gameSystemFactory.ts";
import { composeGamePlan } from "../app/fun-zone/engine/gameComposer.ts";
import { buildVisualBlueprint } from "../app/fun-zone/engine/visualBlueprint.ts";
import { buildAutonomousGameHtml } from "../app/fun-zone/engine/jamesAutonomousGameEngine.ts";
import { normalizeGameGenre } from "../app/fun-zone/engine/normalizeGameGenre.ts";
import { buildAssetRegistry } from "../app/fun-zone/engine/assetRegistry.ts";
import { generateGameAssets, generateLocalGameAssets } from "../app/fun-zone/engine/assetGenerator.ts";
import { materializeGameAssets } from "../app/fun-zone/engine/assetMaterializer.ts";
import { buildCharacterAssetPlan } from "../app/fun-zone/engine/characterAssetPipeline.ts";
import { createAssetProviderRouter } from "../app/fun-zone/engine/assetProviderRouter.ts";
import { validatePlayableRuntimeContract } from "../app/fun-zone/engine/runtimeContract.ts";
import { getPhaserGenreAdapter } from "../app/fun-zone/phaser/runtimeAdapters.ts";
import { buildFarmingGameHtml } from "../app/fun-zone/phaser/farmingRuntime.ts";
import { buildPlatformerGameHtml } from "../app/fun-zone/phaser/platformerRuntime.ts";
import { createLocalPlatformerBlueprint } from "../app/fun-zone/engine/localPlatformerDirector.ts";
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
const visual = buildVisualBlueprint(pokemonLike);
const characterPlan = buildCharacterAssetPlan(visual.characters, visual.artDirection.style);
const registry = buildAssetRegistry(visual);
const generated = await generateGameAssets(registry);
const materialized = materializeGameAssets(generated);
assert.ok(characterPlan.characters.length > 0);
assert.ok(characterPlan.consistencyRules.length >= 3);
assert.ok(characterPlan.characters[0].identityKey.length > 10);
assert.ok(registry.requiredAssetIds.length > 0);
assert.equal(materialized.assets.length, registry.assets.length);
assert.ok(materialized.assets.every((asset) => asset.uri.startsWith("data:image/svg+xml")));
assert.ok(materialized.assets.every((asset) => asset.status === "ready"));
const protagonistAsset = materialized.assets.find((asset) => asset.id === visual.protagonist.id);
assert.ok(protagonistAsset);
assert.equal(
  validatePlayableRuntimeContract(pokemonLike, materialized, visual.protagonist.id).valid,
  true,
);
assert.ok(getPhaserGenreAdapter("farming"));
assert.equal(getPhaserGenreAdapter("platformer")?.runtimeId, "rk-platformer-2d-v1");

const localPlatformer = createLocalPlatformerBlueprint("Buat game sederhana 2D yang bisa dimainkan tanpa provider AI.");
assert.ok(localPlatformer, "a simple 2D request should select the quota-independent platformer template");
assert.equal(localPlatformer?.genre, "platformer");
assert.equal(
  createLocalPlatformerBlueprint("Buat game farming 2D sederhana."),
  null,
  "explicitly different genres must not silently become platformers",
);
const localPlatformerVisual = buildVisualBlueprint(localPlatformer);
const localPlatformerRegistry = buildAssetRegistry(localPlatformerVisual);
const localPlatformerGenerated = await generateGameAssets(localPlatformerRegistry);
const localPlatformerMaterialized = materializeGameAssets(localPlatformerGenerated);
const localPlayer = localPlatformerMaterialized.assets.find((asset) => asset.id === localPlatformerVisual.protagonist.id);
assert.ok(localPlayer?.uri.startsWith("data:image/svg+xml"), "local character must be an image asset, not geometry");
assert.equal(localPlayer?.status, "ready");
const localSpriteSheet = localPlayer?.metadata.providerMetadata?.spriteSheet;
assert.ok(localSpriteSheet && typeof localSpriteSheet === "object" && Number(localSpriteSheet.rowCount) >= 2,
  "local player asset must carry multi-row sprite-sheet animation metadata");


assert.throws(
  () => buildAutonomousGameHtml(blueprint({ genre: "farming" })),
  /Implicit local\/legacy asset fallback is disabled for every genre/,
  "runtime must refuse to substitute fallback assets for any genre",
);

// Genre normalization regression: casing and common aliases must preserve asset identity.
assert.equal(normalizeGameGenre("Racing"), "racing");
assert.equal(normalizeGameGenre("racing"), "racing");
assert.equal(normalizeGameGenre("Balap"), "racing");
const racingBlueprintUpper = buildVisualBlueprint(blueprint({
  title: "Test Racing", genre: "Racing", concept: "Mobile racing game", mechanics: ["race"],
}));
const racingBlueprintLower = buildVisualBlueprint(blueprint({
  title: "Test Racing", genre: "racing", concept: "Mobile racing game", mechanics: ["race"],
}));
assert.equal(racingBlueprintUpper.artDirection.genre, "racing");
assert.equal(racingBlueprintLower.artDirection.genre, "racing");
for (const racingVisual of [racingBlueprintUpper, racingBlueprintLower]) {
  const racingRegistry = buildAssetRegistry(racingVisual);
  const vehicle = racingRegistry.assets.find((asset) => asset.id === "protagonist");
  const track = racingRegistry.assets.find((asset) => asset.id === "world-primary");
  assert.equal(vehicle?.entityKind, "vehicle", "racing protagonist must be classified as a vehicle");
  assert.ok(vehicle?.tags.includes("racing-vehicle"), "racing vehicle tag must be preserved");
  assert.ok(track?.tags.includes("racing-track"), "world-primary must be classified as racing track");
}

const mixedCaseRegistry = buildAssetRegistry({
  ...racingBlueprintUpper,
  artDirection: { ...racingBlueprintUpper.artDirection, genre: "Racing" },
});
assert.ok(
  mixedCaseRegistry.assets.find((asset) => asset.id === "world-primary")?.tags.includes("racing-track"),
  "asset registry must classify racing tracks even when the incoming genre has mixed capitalization",
);

const farmingRuntimeSpec = {
  version: "ruangkita-game-spec-v1",
  title: "Farming Runtime Regression",
  concept: "2D farming game",
  genre: "farming",
  objective: "Reach 1000 money",
  winCondition: "Reach 1000 money",
  loseCondition: "None",
  scenes: [{ id: "farm", name: "Farm", role: "world" }],
  systems: ["movement", "farming", "economy", "npc"],
  actions: ["till", "plant", "water", "harvest", "sell"],
  controls: {
    keyboard: ["WASD", "Arrow keys"],
    touch: ["4-direction D-pad", "Action buttons"],
  },
  visual: {
    mode: "cozy-farm",
    palette: {
      background: "#5c4033",
      ground: "#8bb174",
      accent: "#f6bd60",
      danger: "#d1495b",
      light: "#fff8e7",
    },
  },
  sourcePrompt: "farming",
  runtimeId: "rk-phaser-farming-v1",
  assets: [
    {
      id: "protagonist",
      kind: "character",
      uri: "data:image/svg+xml,test-player",
      animationNeeds: ["idle", "walk"],
      animationMode: "sprite-sheet",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 40,
      rowCount: 10,
      characterDNA: null,
    },
    {
      id: "world-primary",
      kind: "environment",
      uri: "data:image/svg+xml,test-environment",
      animationNeeds: [],
      animationMode: "single-image",
    },
    {
      id: "npc-primary",
      kind: "npc",
      uri: "data:image/svg+xml,test-npc",
      animationNeeds: ["idle", "talk"],
      animationMode: "sprite-sheet",
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 40,
      rowCount: 10,
      characterDNA: null,
    },
  ],
  player: {
    assetId: "protagonist",
    entityKind: "character",
    requiredAnimations: ["idle", "walk"],
  },
};

const farmingRuntimeHtml = buildFarmingGameHtml(farmingRuntimeSpec);
assert.ok(farmingRuntimeHtml.includes("phaser@4.2.1"));
assert.ok(farmingRuntimeHtml.includes("Phaser.CANVAS"));
assert.ok(farmingRuntimeHtml.includes("FARMER_ASSET="));
assert.ok(!farmingRuntimeHtml.includes("\\${"));
assert.ok(!farmingRuntimeHtml.includes("this.this.moveState"));

assert.ok(farmingRuntimeHtml.includes("performTestAction"));

// Platformer has its own asset-backed runtime and requires real sprite-sheet metadata.
const platformerRuntimeSpec = {
  ...farmingRuntimeSpec,
  title: "Platformer Runtime Regression",
  concept: "2D platformer with running, jumping, and collectible coins",
  genre: "platformer",
  runtimeId: "rk-phaser-platformer-v1",
  systems: ["movement", "platform", "collision", "progression"],
  actions: ["move", "jump", "collect", "reach_goal"],
  assets: [
    ...farmingRuntimeSpec.assets,
    { id: "platformer-platform-art", kind: "prop", uri: "data:image/svg+xml,platform", tags: ["platform-image"], animationNeeds: [], animationMode: "single-image" },
    { id: "platformer-coin-art", kind: "prop", uri: "data:image/svg+xml,coin", tags: ["coin-image"], animationNeeds: [], animationMode: "single-image" },
    { id: "platformer-finish-art", kind: "prop", uri: "data:image/svg+xml,finish", tags: ["finish-image"], animationNeeds: [], animationMode: "single-image" },
  ],
};
const platformerRuntimeHtml = buildPlatformerGameHtml(platformerRuntimeSpec);
assert.ok(platformerRuntimeHtml.includes("phaser@4.2.1"));
assert.ok(platformerRuntimeHtml.includes("const CFG="));
assert.ok(platformerRuntimeHtml.includes("hero-run"));
assert.ok(platformerRuntimeHtml.includes('start:rowFrames'), "platformer run animation must use a separate animation row, not replay idle frames");
assert.ok(platformerRuntimeHtml.includes("window.__RK_GAME_TEST__"));
assert.ok(platformerRuntimeHtml.includes("const activePointers=new Map()"), "touch input must track individual pointer IDs for multitouch");
assert.ok(platformerRuntimeHtml.includes("const activeTouches=new Map()"), "touch input must track individual touch identifiers");
assert.ok(platformerRuntimeHtml.includes("this.events.once(Phaser.Scenes.Events.SHUTDOWN,onShutdown)"), "scene shutdown must clean touch DOM and listeners");
assert.ok(platformerRuntimeHtml.includes('window.removeEventListener("pointerup",onPointerUp)'), "pointer listeners must be removed when a scene shuts down");
assert.ok(platformerRuntimeHtml.includes('this.input.keyboard.off("keydown-R",this._sceneRestartKeyHandler)'), "scene restart keyboard handler must be removed on shutdown");
assert.ok(platformerRuntimeHtml.includes('if(oldTouchPad)oldTouchPad.remove()'), "restart must not duplicate the DOM touch pad");
assert.ok(platformerRuntimeHtml.includes('if(action==="restart")return restartGame()'), "test protocol must expose restart as a supported action");
assert.ok(platformerRuntimeHtml.includes("window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;restartButton.style.display"), "restart must clear stale readiness evidence before the scene reloads");
assert.ok(platformerRuntimeHtml.includes('return beforeY!==sceneRef.player.body.velocity.y&&sceneRef.player.body.velocity.y<0'), "jump action only succeeds when vertical velocity actually changes upward");
assert.ok(platformerRuntimeHtml.includes("this._assetLoadErrors.push(message)"), "asset load errors must be retained");
assert.ok(platformerRuntimeHtml.includes("Required Phaser textures unavailable"), "runtime readiness must fail when a required texture is missing");
assert.ok(platformerRuntimeHtml.includes("if((this._assetLoadErrors||[]).length)"), "runtime must not mark READY after asset load failure");
assert.ok(platformerRuntimeHtml.includes("Coins: "));
assert.ok(platformerRuntimeHtml.includes("placePlatform(1100,628,2200)"), "platformer floor must use an image-backed physics collider");
assert.ok(!platformerRuntimeHtml.includes("add.rectangle("), "platformer runtime must not draw geometric platforms");
assert.ok(!platformerRuntimeHtml.includes("add.circle("), "platformer runtime must not draw geometric coins");
assert.throws(
  () => buildPlatformerGameHtml({
    ...platformerRuntimeSpec,
    assets: platformerRuntimeSpec.assets.map((asset) =>
      asset.id === "protagonist" ? { ...asset, animationMode: "single-image" } : asset,
    ),
  }),
  /requires a valid animated player sprite sheet/,
  "platformer must not replace missing animation assets with a geometric character",
);
assert.throws(
  () => buildPlatformerGameHtml({
    ...platformerRuntimeSpec,
    assets: platformerRuntimeSpec.assets.filter((asset) => asset.id !== "platformer-coin-art"),
  }),
  /materialized image asset tagged "coin-image"/,
  "platformer must fail closed when a required collectible image is absent",
);
assert.throws(
  () => buildPlatformerGameHtml({
    ...platformerRuntimeSpec,
    assets: platformerRuntimeSpec.assets.map((asset) =>
      asset.id === "protagonist" ? { ...asset, rowCount: 1 } : asset,
    ),
  }),
  /requires a valid animated player sprite sheet/,
  "platformer must reject sprite sheets that cannot provide distinct idle and walk animations",
);

const provider = {
  name: "test-image-provider",
  supports: ["character", "npc", "enemy", "companion", "environment", "prop", "effect", "ui"],
  async generate(asset) {
    return {
      uri: `data:image/test,${asset.id}`,
      metadata: {
        identityKey: asset.id,
        promptEcho: asset.prompt,
        ...(asset.animationNeeds.length > 0
          ? {
              spriteSheet: {
                frameWidth: 256,
                frameHeight: 256,
                frameCount: Math.max(2, asset.animationNeeds.length * 2),
                rowCount: Math.max(1, asset.animationNeeds.length),
              },
            }
          : {}),
      },
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

const routerProvider = {
  name: "router-image-provider",
  supports: ["character", "environment"],
  async generate(asset) {
    return {
      uri: `data:image/router,${asset.id}`,
      metadata: {
        identityKey: asset.id,
        ...(asset.animationNeeds.length > 0
          ? {
              spriteSheet: {
                frameWidth: 256,
                frameHeight: 256,
                frameCount: Math.max(2, asset.animationNeeds.length * 2),
                rowCount: Math.max(1, asset.animationNeeds.length),
              },
            }
          : {}),
      },
    };
  },
};
const router = createAssetProviderRouter([routerProvider]);
const characterAsset = registry.assets.find((asset) => asset.kind === "character");
assert.ok(characterAsset);
assert.equal(router.select(characterAsset).name, "router-image-provider");
const routedCharacter = await router.generate(characterAsset);
assert.equal(routedCharacter.provider, "router-image-provider");
assert.equal(routedCharacter.fallback, false);

const unsupportedAsset = registry.assets.find((asset) => !routerProvider.supports.includes(asset.kind));
assert.ok(unsupportedAsset);
assert.equal(router.select(unsupportedAsset).name, "local-fallback");
const routedUnsupported = await router.generate(unsupportedAsset);
assert.equal(routedUnsupported.fallback, true);

const failingProvider = {
  name: "failing-provider",
  supports: ["character", "npc", "enemy", "companion", "environment", "prop", "effect", "ui"],
  async generate() {
    throw new Error("simulated provider outage");
  },
};
const fallbackGenerated = await generateGameAssets(registry, failingProvider);
assert.ok(fallbackGenerated.assets.every((asset) => asset.status === "ready"));
assert.ok(
  fallbackGenerated.assets.every(
    (asset) => asset.metadata.provider === "james-native-visual-engine-v2",
  ),
  "James Native Visual Engine may be selected as an explicit provider, but materialization must not silently replace its failed assets",
);
const placeholderGenerated = generateLocalGameAssets(registry);
assert.throws(
  () => materializeGameAssets(placeholderGenerated),
  /placeholder assets are not promoted to ready/,
  "materializer must fail closed instead of converting placeholder assets into ready assets",
);

const composed = composeGamePlan(pokemonLike);
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

const composedFarming = composeGamePlan(blueprint({
  concept: "A farming life simulation where the player tills soil, plants seeds, waters crops, harvests wheat and sells crops for money.",
  genre: "Farming",
  mechanics: ["till", "plant", "water", "harvest", "sell"],
}));
for (const required of ["till", "plant", "water", "harvest", "sell"]) {
  assert.ok(composedFarming.requiredActions.includes(required), "farming test plan should include " + required);
}

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
  characterPipeline: {
    characters: characterPlan.characters.length,
    identityKey: characterPlan.characters[0].identityKey,
  },
  visualAssets: {
    count: materialized.assets.length,
    ready: materialized.assets.filter((asset) => asset.status === "ready").length,
  },
  creatureRuntime: {
    partyIndex: state.party.activeIndex,
    xp: state.progression.xp,
    level: evolved?.level,
    form: evolved?.form,
  },
}, null, 2));
