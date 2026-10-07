import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");

const runtime = read("app/fun-zone/phaser/runtime.ts");
const definitions = read("app/fun-zone/phaser/genreDefinitions.ts");
const contracts = read("app/fun-zone/phaser/contracts.ts");

const expected = {
  monster_tamer: {
    actions: ["talk","accept_quest","encounter","attack","capture","add_party"],
    signals: ["dialogueStarted","questAccepted","encounterStarted","battleStarted","battleCompleted","captureCount","partyCount"],
  },
  farming: {
    actions: ["till","plant","water","harvest","sell"],
    signals: ["tilled","planted","watered","harvested","sold","money"],
  },
  adventure: {
    actions: ["talk","collect","open_exit"],
    signals: ["dialogueStarted","itemsCollected","exitOpened"],
  },
  rpg: {
    actions: ["talk","battle","loot","level_up"],
    signals: ["dialogueStarted","battleWins","lootCount","level"],
  },
  platformer: {
    actions: ["move","jump","collect","reach_goal"],
    signals: ["jumps","collectCount","goalReached"],
  },
  racing: {
    actions: ["accelerate","steer","checkpoint","finish"],
    signals: ["maxSpeed","checkpoints","finished"],
  },
  puzzle: {
    actions: ["select","solve"],
    signals: ["selections","solved"],
  },
  shooter: {
    actions: ["aim","shoot","reload","defeat"],
    signals: ["aimed","shots","reloads","enemiesDefeated"],
  },
  strategy: {
    actions: ["place","command","capture_point"],
    signals: ["unitsPlaced","commands","pointsCaptured"],
  },
  simulation: {
    actions: ["build","allocate","upgrade"],
    signals: ["buildings","allocated","upgrades"],
  },
  survival: {
    actions: ["scavenge","craft","defend","survive_wave"],
    signals: ["resources","crafted","defended","waves"],
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const [genre, contract] of Object.entries(expected)) {
  assert(
    definitions.includes('genre:"' + genre + '"') || definitions.includes('genre: "' + genre + '"'),
    genre + ": genre definition hilang."
  );

  const contractPattern = new RegExp(
    genre + "\\s*:\\s*\\{[\\s\\S]*?requiredActions:\\s*\\[([^\\]]+)\\][\\s\\S]*?requiredSignals:\\s*\\[([^\\]]+)\\]"
  );
  const contractMatch = contracts.match(contractPattern);
  assert(contractMatch, genre + ": contract tidak ditemukan.");

  const sourceActions = [...contractMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const sourceSignals = [...contractMatch[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  assert(
    JSON.stringify(sourceActions) === JSON.stringify(contract.actions),
    genre + ": action contract berubah/tidak sinkron."
  );
  assert(
    JSON.stringify(sourceSignals) === JSON.stringify(contract.signals),
    genre + ": signal contract berubah/tidak sinkron."
  );

  assert(
    runtime.includes(`if(\" + genre + \"==='${genre}')`),
    genre + ": runtime tidak memiliki dispatcher genre."
  );

  for (const action of contract.actions) {
    assert(runtime.includes("a==='" + action + "'"), genre + ": handler action hilang: " + action);
  }

  for (const signal of contract.signals) {
    assert(runtime.includes(signal), genre + ": signal state hilang: " + signal);
  }
}

assert(runtime.includes("Phaser.Scene"), "Phaser.Scene marker hilang.");
assert(runtime.includes("new Phaser.Game"), "Phaser.Game bootstrap hilang.");
assert(runtime.includes("Phaser.AUTO"), "Phaser.AUTO hilang.");
assert(runtime.includes("Phaser.Scale.FIT"), "Phaser.Scale.FIT hilang.");
assert(runtime.includes("__RK_GAME_TEST__"), "Game Test Protocol hilang.");
assert(runtime.includes("__RK_PHASER_BOOT_SPEC__"), "Phaser boot spec hilang.");
assert(runtime.includes("phaserVersion:'3.90.0'"), "Phaser 3.90.0 identity hilang.");
assert(!runtime.includes("window.parent.postMessage"), "Runtime tidak boleh mengakses parent frame.");

console.log("Fun Zone Phaser runtime golden contract suite: PASS");
console.log("Genres checked:", Object.keys(expected).length);
console.log("Action contracts checked:", Object.values(expected).reduce((n, c) => n + c.actions.length, 0));
console.log("Signal contracts checked:", Object.values(expected).reduce((n, c) => n + c.signals.length, 0));
