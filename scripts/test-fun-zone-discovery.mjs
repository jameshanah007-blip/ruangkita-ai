import assert from "node:assert/strict";
import { GAME_PORTALS, resolveGameDiscovery } from "../app/fun-zone/discovery/gameCatalog.ts";

const adventure = resolveGameDiscovery("Aku ingin game petualangan 2D dengan eksplorasi dan misi");
assert.equal(adventure.genre, "adventure");
assert.ok(adventure.portals.some((portal) => portal.id === "crazygames"));
assert.ok(adventure.portals.some((portal) => portal.id === "gamescoid"));

const twoPlayer = resolveGameDiscovery("Cari game untuk main berdua dengan teman");
assert.equal(twoPlayer.genre, "multiplayer");
assert.ok(twoPlayer.portals.some((portal) => portal.id === "poki"));

const racing = resolveGameDiscovery("Aku mau game balapan mobil");
assert.equal(racing.genre, "racing");
assert.ok(racing.portals.length > 0);

const unknown = resolveGameDiscovery("carikan permainan yang seru");
assert.equal(unknown.genre, "all");
assert.equal(unknown.portals.length, GAME_PORTALS.length);

for (const portal of GAME_PORTALS) {
  assert.ok(portal.url.startsWith("https://"), "portal links must use HTTPS");
  assert.ok(["crazygames", "gamescoid", "playhop", "poki"].includes(portal.id));
}

console.log("Fun Zone discovery tests passed.");
