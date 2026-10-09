import assert from "node:assert/strict";
import { buildVisualBlueprint } from "../app/fun-zone/engine/visualBlueprint.ts";
import { buildAssetRegistry } from "../app/fun-zone/engine/assetRegistry.ts";
import { generateGameAssets } from "../app/fun-zone/engine/assetGenerator.ts";
import { materializeGameAssets } from "../app/fun-zone/engine/assetMaterializer.ts";
import { assertPhaserGenreAdapter } from "../app/fun-zone/phaser/runtimeAdapters.ts";

const blueprint = {
  title: "Racing Asset Integration Test",
  concept: "A mobile top-down 2D car racing game with a real car image and a real circuit image.",
  genre: "Racing",
  mood: "arcade",
  difficulty: "normal",
  theme: "circuit racing",
  world: "race circuit",
  coreLoop: "drive, pass checkpoints, finish laps",
  objective: "Finish the race",
  mechanics: ["racing", "steering", "checkpoints", "laps"],
  playerActions: ["accelerate", "steer", "checkpoint", "finish"],
  controls: ["keyboard", "touch"],
  progression: "finish laps",
  replayability: "best lap time",
  winCondition: "finish all laps",
  loseCondition: "time out",
  visualStyle: ["top-down racing"],
  mobileNotes: "support touch controls",
  testRequirements: ["load vehicle image", "load track image", "start game loop"],
};

const visual = buildVisualBlueprint(blueprint);
assert.equal(visual.artDirection.genre, "racing");
const registry = buildAssetRegistry(visual);
const generated = await generateGameAssets(registry);
const materialized = materializeGameAssets(generated);
const player = materialized.assets.find((asset) => asset.id === visual.protagonist.id);
const track = materialized.assets.find((asset) => asset.id === "world-primary");

assert.ok(player, "racing protagonist must exist");
assert.ok(track, "racing track must exist");
for (const asset of [player, track]) {
  assert.equal(asset.status, "ready", asset.id + " must be ready");
  assert.match(asset.uri, /^data:image\//, asset.id + " must contain downloaded image bytes");
  assert.ok(asset.metadata.imageBacked, asset.id + " must be marked image-backed");
  assert.ok(asset.metadata.provider && !/local-fallback|james-native/i.test(asset.metadata.provider));
}
assert.equal(player.entityKind, "vehicle");
assert.equal(player.metadata.providerMetadata?.animationMode, "single-image");
assert.deepEqual(track.metadata.providerMetadata?.imageCrop, { x: 35, y: 18, width: 225, height: 180 });
assert.equal(track.metadata.providerMetadata?.racingTrackLayout, "square-loop");

const spec = {
  version: "ruangkita-game-spec-v1",
  title: blueprint.title,
  concept: blueprint.concept,
  genre: "racing",
  objective: blueprint.objective,
  winCondition: blueprint.winCondition,
  loseCondition: blueprint.loseCondition,
  scenes: [{ id: "circuit", name: "Circuit", role: "world" }],
  systems: ["movement", "racing", "collision", "progression"],
  actions: blueprint.playerActions,
  controls: { keyboard: ["Arrow keys", "WASD"], touch: ["Steer", "Accelerate"] },
  visual: {
    mode: "top-down-racing",
    palette: { background: "#101820", ground: "#3b3f46", accent: "#00d4ff", danger: "#ff4d6d", light: "#f5f7fa" },
  },
  sourcePrompt: blueprint.concept,
  runtimeId: "rk-racing-2d-v1",
  assets: materialized.assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    uri: asset.uri,
    animationNeeds: asset.metadata.animationNeeds,
    animationMode: asset.metadata.providerMetadata?.animationMode,
    frameWidth: asset.metadata.providerMetadata?.spriteSheet?.frameWidth,
    frameHeight: asset.metadata.providerMetadata?.spriteSheet?.frameHeight,
    frameCount: asset.metadata.providerMetadata?.spriteSheet?.frameCount,
    rowCount: asset.metadata.providerMetadata?.spriteSheet?.rowCount,
    imageCrop: asset.metadata.providerMetadata?.imageCrop,
    racingTrackLayout: asset.metadata.providerMetadata?.racingTrackLayout,
    entityKind: asset.entityKind,
    tags: asset.metadata.tags,
    provider: asset.metadata.provider,
  })),
  player: { assetId: player.id, entityKind: "vehicle", requiredAnimations: [] },
  racing: {
    laps: 2,
    checkpointCount: 4,
    trackAssetId: track.id,
    trackDescription: "Curated real image circuit",
    vehicleDescription: "Curated real car image",
    maxSpeed: 8,
    upgradeEnabled: true,
    trackStyle: "square-loop",
    checkpointAnchors: [{x:480,y:100},{x:800,y:330},{x:480,y:560},{x:160,y:330}],
  },
};
const adapter = assertPhaserGenreAdapter(spec);
const html = adapter.build(spec);
assert.ok(html.includes("data:image/"), "runtime HTML must embed the materialized real images");
assert.ok(html.includes("__RK_GAME_READY__"), "runtime must expose its readiness signal");
assert.ok(html.includes("__RK_GAME_TEST__"), "runtime must expose gameplay test hooks");
assert.ok(html.includes("track-environment"), "runtime must load the track environment");
console.log("Racing asset integration checks passed. Browser gameplay still requires a real browser smoke test.");
