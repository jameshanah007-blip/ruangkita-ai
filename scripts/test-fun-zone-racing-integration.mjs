import assert from "node:assert/strict";
import { buildVisualBlueprint } from "../app/fun-zone/engine/visualBlueprint.ts";
import { buildAssetRegistry } from "../app/fun-zone/engine/assetRegistry.ts";
import { generateGameAssets } from "../app/fun-zone/engine/assetGenerator.ts";
import { materializeGameAssets } from "../app/fun-zone/engine/assetMaterializer.ts";
import { buildAutonomousGameHtml } from "../app/fun-zone/engine/jamesAutonomousGameEngine.ts";

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
  mobileNotes: ["support touch controls"],
  testRequirements: ["load vehicle image", "load track image", "start game loop"],
};

const visual = buildVisualBlueprint(blueprint);
assert.equal(visual.artDirection.genre, "racing");
const registry = buildAssetRegistry(visual);
assert.ok(registry.assets.find((asset) => asset.id === "protagonist")?.tags.includes("racing-vehicle"));
assert.ok(registry.assets.find((asset) => asset.id === "world-primary")?.tags.includes("racing-track"));

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
  assert.ok(Number(asset.metadata.providerMetadata?.byteLength) > 0, asset.id + " must record non-zero downloaded image bytes");
}
assert.equal(player.entityKind, "vehicle");
assert.equal(player.metadata.providerMetadata?.animationMode, "single-image");
assert.deepEqual(track.metadata.providerMetadata?.imageCrop, { x: 35, y: 18, width: 225, height: 180 });
assert.equal(track.metadata.providerMetadata?.racingTrackLayout, "square-loop");

// Exercise the real production compiler path: materialized assets -> Phaser manifest -> racing adapter -> HTML.
const html = buildAutonomousGameHtml(blueprint, materialized, visual.protagonist.id);
assert.ok(html.includes("data:image/"), "runtime HTML must embed the materialized real images");
assert.ok(html.includes("__RK_GAME_READY__"), "runtime must expose its readiness signal");
assert.ok(html.includes("__RK_GAME_TEST__"), "runtime must expose gameplay test hooks");
assert.ok(html.includes("track-environment"), "runtime must load the track environment");
assert.ok(html.includes("trackCrop"), "runtime must receive track crop metadata");
console.log("Racing asset integration checks passed: real image downloads, registry, materializer, production Phaser compiler, and HTML generation.");
