import vm from "node:vm";
import { buildAuthoritativePhaserGame } from "../app/fun-zone/phaser/index.ts";
import { getGenreDefinition } from "../app/fun-zone/phaser/genreDefinitions.ts";
import { PHASER_GENRE_CONTRACTS } from "../app/fun-zone/phaser/contracts.ts";

const genres = Object.keys(PHASER_GENRE_CONTRACTS);

function blueprintFor(genre) {
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
    mechanics: getGenreDefinition(genre).systems,
    playerActions: getGenreDefinition(genre).actions,
    controls: getGenreDefinition(genre).keyboard,
    progression: "contract completion",
    replayability: "repeatable test",
    winCondition: "Complete all required actions.",
    loseCondition: "runtime failure",
    visualStyle: getGenreDefinition(genre).visualMode,
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
    let active = null;
    const start = (key) => {
      const instance = instances.find((scene) => scene.rkKey === key) || instances[0];
      active = instance;
      if (active?.create) active.create();
      if (active?.update) active.update();
    };
    this.scene = { start };
    if (instances.length) start(instances[0].rkKey);
  }
}

function createContext() {
  const window = {};
  const document = { querySelector: () => null };
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

for (const genre of genres) {
  const blueprint = blueprintFor(genre);
  const build = buildAuthoritativePhaserGame(blueprint, blueprint.concept);
  assert(build, genre + ": builder mengembalikan null.");
  assert(build.engine === "phaser", genre + ": engine bukan Phaser.");
  assert(build.phaserVersion === "3.90.0", genre + ": versi Phaser salah.");
  assert(build.genre === genre, genre + ": genre hasil builder salah.");
  assert(build.runtimeId === "rk-phaser-" + genre + "-v1", genre + ": runtimeId salah.");

  const context = createContext();
  vm.runInNewContext(extractRuntime(build.html), context, { timeout: 3000 });

  const protocol = context.window.__RK_GAME_TEST__;
  const engine = context.window.__RK_2D_ENGINE_V2__;
  const boot = context.window.__RK_PHASER_BOOT_SPEC__;

  assert(protocol && typeof protocol.performTestAction === "function", genre + ": Game Test Protocol hilang.");
  assert(engine?.engine === "Phaser", genre + ": engine identity tidak benar.");
  assert(engine?.phaserVersion === "3.90.0", genre + ": runtime version tidak benar.");
  assert(engine?.genre === genre, genre + ": engine genre tidak benar.");
  assert(engine?.runtimeId === "rk-phaser-" + genre + "-v1", genre + ": engine runtimeId tidak benar.");
  assert(Array.isArray(engine?.systems), genre + ": systems tidak tersedia.");
  assert(Array.isArray(boot?.actions), genre + ": boot action contract hilang.");

  const contract = PHASER_GENRE_CONTRACTS[genre];
  assert(JSON.stringify(boot.actions) === JSON.stringify(contract.requiredActions), genre + ": action contract tidak sinkron.");

  for (const action of contract.requiredActions) {
    const result = protocol.performTestAction(action);
    assert(result === true, genre + ": action gagal: " + action);
  }

  const state = protocol.getGenreState();
  for (const signal of contract.requiredSignals) {
    const value = state?.[signal];
    const ok = typeof value === "boolean" ? value : typeof value === "number" ? value > 0 : typeof value === "string" ? value.length > 0 : value != null;
    assert(ok, genre + ": required signal tidak terbukti: " + signal);
  }

  assert(protocol.getWinState() === true, genre + ": win state tidak tercapai.");

  protocol.restart();
  const resetState = protocol.getState();
  assert(resetState.progress === 0, genre + ": restart tidak mengosongkan progress.");
  assert(resetState.won === false, genre + ": restart tidak mereset win state.");

  console.log("PASS", genre, "scenes=" + engine.sceneCount, "systems=" + engine.systems.length, "visual=" + engine.visualMode);
}

console.log("Fun Zone Phaser runtime golden suite: PASS");
console.log("Genres tested:", genres.length);
