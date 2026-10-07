import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const root = process.cwd();
const outDir = join(root, ".tmp", "fun-zone-phaser-golden");
const requireFromTest = createRequire(import.meta.url);
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

execFileSync(
  process.execPath,
  [
    tsc,
    "--target", "ES2022",
    "--module", "CommonJS",
    "--moduleResolution", "Node",
    "--rootDir", root,
    "--skipLibCheck",
    "--esModuleInterop",
    "--outDir", outDir,
    join(root, "app/fun-zone/laboratory/types.ts"),
    join(root, "app/fun-zone/phaser/types.ts"),
    join(root, "app/fun-zone/phaser/genreDefinitions.ts"),
    join(root, "app/fun-zone/phaser/contracts.ts"),
    join(root, "app/fun-zone/phaser/runtime.ts"),
    join(root, "app/fun-zone/phaser/builder.ts"),
  ],
  { stdio: "inherit" },
);

const builderPath = join(outDir, "app/fun-zone/phaser/builder.js");
const definitionsPath = join(outDir, "app/fun-zone/phaser/genreDefinitions.js");
const contractsPath = join(outDir, "app/fun-zone/phaser/contracts.js");

if (!existsSync(builderPath) || !existsSync(definitionsPath) || !existsSync(contractsPath)) {
  throw new Error("Golden suite gagal menghasilkan JavaScript Phaser modules.");
}

const { buildAuthoritativePhaserGame } = requireFromTest(builderPath);
const { getGenreDefinition } = requireFromTest(definitionsPath);
const { PHASER_GENRE_CONTRACTS } = requireFromTest(contractsPath);

const expectedGenres = Object.keys(PHASER_GENRE_CONTRACTS);

function blueprintFor(genre) {
  const definition = getGenreDefinition(genre);
  return {
    title: "Golden " + genre,
    concept: genre + " 2D golden runtime test",
    genre,
    mood: "playful",
    difficulty: "normal",
    theme: genre,
    world: "test world",
    coreLoop: "interact, progress, complete",
    objective: "Complete the genre contract.",
    mechanics: definition.systems,
    playerActions: definition.actions,
    controls: definition.keyboard,
    progression: "contract completion",
    replayability: "repeatable test",
    winCondition: "Complete all required actions.",
    loseCondition: "runtime failure",
    visualStyle: definition.visualMode,
    mobileNotes: ["touch"],
    testRequirements: ["runtime", "genre contract", "restart"],
  };
}

function makeGameObject() {
  return {
    x: 0,
    y: 0,
    setStrokeStyle() { return this; },
    setInteractive() { return this; },
    on() { return this; },
  };
}

function createSceneBase() {
  const noOp = () => undefined;
  const object = () => makeGameObject();
  return {
    cameras: { main: { setBackgroundColor: noOp } },
    add: {
      text: object,
      rectangle: object,
      circle: object,
      triangle: object,
    },
    input: {
      on: noOp,
      keyboard: {
        createCursorKeys() {
          return {
            left: { isDown: false },
            right: { isDown: false },
            up: { isDown: false },
            down: { isDown: false },
          };
        },
        addKeys() {
          return {
            A: { isDown: false },
            D: { isDown: false },
            W: { isDown: false },
            S: { isDown: false },
          };
        },
      },
    },
  };
}

class MockScene {
  constructor(config) {
    Object.assign(this, createSceneBase());
    this.key = config?.key || "main";
    this.rkKey = this.key;
  }
}

class MockGame {
  constructor(config) {
    this.config = config;
    const instances = (config.scene || []).map((SceneClass) => new SceneClass());
    const start = (key) => {
      const instance = instances.find((scene) => scene.rkKey === key) || instances[0];
      if (!instance) return;
      if (instance.create) instance.create();
      if (instance.update) instance.update();
    };
    this.scene = { start };
    if (instances.length) start(instances[0].rkKey);
  }
}

function createContext() {
  const window = {};
  const document = {
    querySelector() {
      return null;
    },
  };

  const context = {
    window,
    document,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Phaser: {
      Scene: MockScene,
      Game: MockGame,
      AUTO: 1,
      Scale: { FIT: 1, CENTER_BOTH: 1 },
    },
  };

  context.globalThis = context;
  return context;
}

function extractRuntime(html) {
  const match = html.match(/<script>\(function\(\)\{try\{([\\s\\S]*)\}catch\(error\)/);
  if (!match) throw new Error("Tidak menemukan bootstrap runtime Phaser.");
  return match[1];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const visualModes = new Set();

for (const genre of expectedGenres) {
  const definition = getGenreDefinition(genre);
  const contract = PHASER_GENRE_CONTRACTS[genre];
  const blueprint = blueprintFor(genre);
  const build = buildAuthoritativePhaserGame(blueprint, blueprint.concept);

  assert(build, genre + ": builder mengembalikan null.");
  assert(build.engine === "phaser", genre + ": engine bukan Phaser.");
  assert(build.phaserVersion === "3.90.0", genre + ": versi Phaser salah.");
  assert(build.genre === genre, genre + ": genre hasil builder salah.");
  assert(build.runtimeId === "rk-phaser-" + genre + "-v1", genre + ": runtimeId salah.");
  assert(JSON.stringify(build.systems) === JSON.stringify(definition.systems), genre + ": system spec tidak sinkron.");
  assert(JSON.stringify(build.spec.scenes) === JSON.stringify(definition.scenes), genre + ": scene spec tidak sinkron.");
  assert(JSON.stringify(build.spec.actions) === JSON.stringify(definition.actions), genre + ": action spec tidak sinkron.");

  visualModes.add(build.spec.visual.mode);

  const context = createContext();
  const runtime = extractRuntime(build.html);
  requireFromTest("node:vm").runInNewContext(runtime, context, { timeout: 3000 });

  const protocol = context.window.__RK_GAME_TEST__;
  const engine = context.window.__RK_2D_ENGINE_V2__;
  const boot = context.window.__RK_PHASER_BOOT_SPEC__;

  assert(protocol && typeof protocol.performTestAction === "function", genre + ": Game Test Protocol hilang.");
  assert(typeof protocol.getGenreState === "function", genre + ": genre state accessor hilang.");
  assert(engine?.engine === "Phaser", genre + ": engine identity tidak benar.");
  assert(engine?.phaserVersion === "3.90.0", genre + ": runtime version tidak benar.");
  assert(engine?.genre === genre, genre + ": engine genre tidak benar.");
  assert(engine?.runtimeId === "rk-phaser-" + genre + "-v1", genre + ": engine runtimeId tidak benar.");
  assert(JSON.stringify(engine.systems) === JSON.stringify(definition.systems), genre + ": runtime systems tidak sinkron.");
  assert(JSON.stringify(engine.scenes) === JSON.stringify(definition.scenes), genre + ": runtime scenes tidak sinkron.");
  assert(JSON.stringify(boot.actions) === JSON.stringify(contract.requiredActions), genre + ": boot action contract tidak sinkron.");

  const startState = protocol.getState();

  for (const action of contract.requiredActions) {
    const result = protocol.performTestAction(action);
    assert(result === true, genre + ": action gagal: " + action);
  }

  const finalState = protocol.getGenreState();
  for (const signal of contract.requiredSignals) {
    const value = finalState?.[signal];
    const ok = typeof value === "boolean"
      ? value
      : typeof value === "number"
        ? value > 0
        : typeof value === "string"
          ? value.length > 0
          : value != null;
    assert(ok, genre + ": required signal tidak terbukti: " + signal);
  }

  assert(finalState.progress > startState.progress, genre + ": progress tidak bertambah.");
  assert(protocol.getWinState() === true, genre + ": win state tidak tercapai.");

  protocol.restart();
  const resetState = protocol.getState();
  assert(resetState.progress === 0, genre + ": restart tidak mengosongkan progress.");
  assert(resetState.won === false, genre + ": restart tidak mereset win state.");
  assert(resetState.scene === definition.scenes[0].id, genre + ": restart tidak mengembalikan scene awal.");

  console.log(
    "PASS",
    genre,
    "scenes=" + engine.scenes.length,
    "systems=" + engine.systems.length,
    "actions=" + contract.requiredActions.length,
    "visual=" + engine.visualMode,
  );
}

assert(visualModes.size === expectedGenres.length, "Visual mode antar genre masih terduplikasi.");

rmSync(outDir, { recursive: true, force: true });

console.log("Fun Zone Phaser runtime golden suite: PASS");
console.log("Genres tested:", expectedGenres.length);
