import assert from "node:assert/strict";
import { EXTERNAL_GAMES, GAME_PORTALS, resolveGameDiscovery } from "../app/fun-zone/discovery/gameCatalog.ts";
import { searchExternalGames } from "../app/fun-zone/discovery/searchExternalGames.ts";

const adventure = resolveGameDiscovery("Aku ingin game petualangan 2D dengan eksplorasi dan misi");
assert.equal(adventure.genre, "adventure");
assert.ok(adventure.portals.some((portal) => portal.id === "crazygames"));
assert.ok(adventure.portals.some((portal) => portal.id === "gamescoid"));
const adventureGames = EXTERNAL_GAMES.filter((game) => game.tags.includes("adventure"));
assert.ok(adventureGames.length >= 4, "adventure prompts should have multiple individual game cards");
assert.ok(adventureGames.some((game) => game.id === "dadish"));
assert.ok(adventureGames.some((game) => game.id === "apple-knight-mini-dungeons"));

const twoPlayer = resolveGameDiscovery("Cari game untuk main berdua dengan teman");
assert.equal(twoPlayer.genre, "multiplayer");
assert.ok(twoPlayer.portals.some((portal) => portal.id === "poki"));
assert.ok(EXTERNAL_GAMES.some((game) => game.tags.includes("multiplayer")), "multiplayer intent should return a specific game card");

const racing = resolveGameDiscovery("Aku mau game balapan mobil");
assert.equal(racing.genre, "racing");
assert.ok(racing.portals.length > 0);
assert.ok(EXTERNAL_GAMES.some((game) => game.tags.includes("racing")), "racing intent should return a specific game card");

const farming = resolveGameDiscovery("Aku ingin game farming 2D");
assert.equal(farming.genre, "farming");
assert.ok(farming.portals.some((portal) => portal.id === "crazygames"));
assert.ok(EXTERNAL_GAMES.some((game) => game.tags.includes("farming")), "farming intent should return a specific simulation/farming card");

const adventureWithFriends = resolveGameDiscovery("Aku ingin game petualangan 2D untuk main berdua dengan teman");
assert.equal(adventureWithFriends.genre, "multiplayer");
assert.ok(adventureWithFriends.portals.some((portal) => portal.id === "poki"));

const unknown = resolveGameDiscovery("carikan permainan yang seru");
assert.equal(unknown.genre, "all");
assert.equal(unknown.portals.length, GAME_PORTALS.length);

for (const game of EXTERNAL_GAMES) {
  assert.ok(game.url.startsWith("https://"), "game pages must use HTTPS");
  assert.ok(game.imageUrl.startsWith("https://img.poki-cdn.com/"), "game images must come from the provider CDN");
  assert.ok(game.name.length > 0 && game.description.length > 0);
}

for (const portal of GAME_PORTALS) {
  assert.ok(portal.url.startsWith("https://"), "portal links must use HTTPS");
  assert.ok(["crazygames", "gamescoid", "playhop", "poki"].includes(portal.id));
}

const savedExaKey = process.env.EXA_API_KEY;
const savedFirecrawlKey = process.env.FIRECRAWL_API_KEY;
delete process.env.EXA_API_KEY;
delete process.env.FIRECRAWL_API_KEY;
const noSearchKeys = await searchExternalGames("game 2D petualangan dengan teka-teki");
assert.equal(noSearchKeys.status, "unavailable");
assert.equal(noSearchKeys.searchProvider, "none");
assert.equal(noSearchKeys.games.length, 0);
if (savedExaKey) process.env.EXA_API_KEY = savedExaKey;
if (savedFirecrawlKey) process.env.FIRECRAWL_API_KEY = savedFirecrawlKey;

console.log("Fun Zone discovery tests passed.");
