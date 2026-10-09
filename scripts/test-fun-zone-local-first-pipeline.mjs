import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [route, sandbox, runtime, materializer, generator] = await Promise.all([
  read("../app/api/fun-zone/laboratory/route.ts"),
  read("../app/fun-zone/engine/AIGameSandbox.tsx"),
  read("../app/fun-zone/phaser/platformerRuntime.ts"),
  read("../app/fun-zone/engine/assetMaterializer.ts"),
  read("../app/fun-zone/engine/assetGenerator.ts"),
]);

// Director selection must be explicit. Unsupported prompts cannot silently become platformers.
assert.match(route, /createLocalPlatformerBlueprint\(prompt\)/);
assert.match(route, /No supported local template matched the prompt/);
assert.match(route, /const isLocalPlatformer = directorProvider === "local" && normalizedBlueprint\.genre === "platformer"/);

// The local route must bypass all known quota-bound enrichment and image-provider calls.
assert.match(route, /if \(isLocalPlatformer\) \{\s*learnedBlueprint = normalizedBlueprint;/);
assert.match(route, /if \(!isLocalPlatformer && visualQa\.refinement\.required/);
assert.match(route, /isLocalPlatformer \? \[\] : realAssetProviders/);
assert.match(route, /localPlatformerBlueprint\s*\? await analyzeReferenceImage\(\{ \.\.\.validReferenceImage, dataUrl: undefined \}, prompt\)/);

// The same materialized asset contract must feed the authoritative Phaser compiler.
assert.match(route, /materializeGameAssets\(generatedAssets\)/);
assert.match(route, /buildAutonomousGameHtml\(composedBlueprint, materializedAssets, protagonistId\)/);
assert.match(route, /gameplayVerified: false/);
assert.match(route, /scope: "static-contract"/);

// A failed local browser test must preserve the artifact and never call the AI debugger endpoint.
assert.match(sandbox, /blueprint\?\.genre === "platformer"/);
assert.match(sandbox, /Template lokal Phaser: debugging AI dilewati/);
assert.match(sandbox, /if \(isLocalPlatformer\)[\s\S]{0,1200}return;/);
const localFailureBranch = sandbox.match(/if \(isLocalPlatformer\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
assert.ok(localFailureBranch.length > 0, "local browser-test failure branch must exist");
assert.doesNotMatch(localFailureBranch, /fetch\(|\/api\/fun-zone\/debug/);

// Phaser must fail closed when the protagonist is missing or has no actual animation sheet.
assert.match(runtime, /requires the declared player asset/);
assert.match(runtime, /requires a valid animated player sprite sheet/);
assert.match(runtime, /platform-image/);\nassert.match(runtime, /coin-image/);\nassert.match(runtime, /finish-image/);\nassert.match(runtime, /Geometry fallback is disabled/);\nassert.doesNotMatch(runtime, /add\\.rectangle\\(/);\nassert.doesNotMatch(runtime, /add\\.circle\\(/);
assert.match(runtime, /preserveDrawingBuffer:true/);
assert.match(sandbox, /canvas\\.getContext\\("webgl2"\\)/);
assert.match(sandbox, /gl\\.readPixels/);
assert.match(runtime, /window\.__RK_GAME_TEST__/);
assert.match(runtime, /const touch=/);

// Materializer and generator remain explicit stages; no implicit placeholder promotion.
assert.match(materializer, /placeholder assets are not promoted to ready/);
assert.match(generator, /james-native-visual-engine-v2/);

console.log("Fun Zone local-first pipeline architecture regression: PASS");
console.log(JSON.stringify({
  directorIsolation: true,
  assetProviderIsolation: true,
  materializerBeforeRuntime: true,
  phaserAssetContract: true,
  localBrowserFailureSkipsAiDebugger: true,
  gameplayStillRequiresBrowserEvidence: true,
}, null, 2));
