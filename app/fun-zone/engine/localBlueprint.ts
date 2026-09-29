import type { GameBlueprint } from "./laboratory/types";

function inferGenre(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/(rpg|role.?play|quest|fantasy)/.test(p)) return "rpg";
  if (/(survival|zombie|monster)/.test(p)) return "survival";
  if (/(puzzle|teka|logic)/.test(p)) return "puzzle";
  if (/(runner|lari|endless)/.test(p)) return "runner";
  if (/(strategy|strategi)/.test(p)) return "strategy";
  if (/(combat|fight|battle|perang)/.test(p)) return "combat";
  return "adventure";
}

function inferDifficulty(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/(sangat sulit|extreme|hardcore)/.test(p)) return "extreme";
  if (/(sulit|hard|menantang)/.test(p)) return "hard";
  if (/(mudah|easy|santai)/.test(p)) return "easy";
  return "medium";
}

export function createLocalGameBlueprint(prompt: string): GameBlueprint {
  const clean = prompt.trim().slice(0, 240) || "petualangan seru";
  const genre = inferGenre(clean);
  const difficulty = inferDifficulty(clean);

  return {
    title: `RuangKita: ${clean.slice(0, 48)}`,
    concept: clean,
    genre,
    mood: "dynamic",
    difficulty,
    theme: clean,
    world: "interactive browser game world",
    coreLoop: "move, interact, collect, avoid danger, reach the objective",
    objective: "Kumpulkan tiga energi dan mencapai portal akhir.",
    mechanics: ["movement", "collection", "collision", "objective", "win_lose"],
    playerActions: ["move", "collect", "avoid", "reach_goal", "restart"],
    controls: ["keyboard", "pointer", "touch", "virtual_buttons"],
    progression: "Collect three energy orbs to unlock the exit portal.",
    replayability: "Restart the run and try to complete the objective faster.",
    winCondition: "Player collects three energy orbs and reaches the portal.",
    loseCondition: "Player loses all health after repeated enemy collisions.",
    visualStyle: "clean colorful 2D canvas optimized for mobile screens",
    mobileNotes: [
      "touch-first controls",
      "large virtual control buttons",
      "responsive canvas",
      "no external assets",
      "works offline after the HTML is loaded"
    ],
    testRequirements: [
      "canvas renders",
      "game loop advances",
      "touch or pointer input works",
      "player state changes",
      "objective state changes",
      "win and lose states are reachable",
      "restart resets the game"
    ]
  };
}
