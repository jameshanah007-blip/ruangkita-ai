import type { GameBlueprint } from "../laboratory/types";

/**
 * Quota-independent local Director for the first supported 2D template.
 * This is not a generic fallback: prompts for other explicit genres return null
 * and continue through the existing AI Director path.
 */
export function createLocalPlatformerBlueprint(prompt: string): GameBlueprint | null {
  const text = prompt.trim();
  if (!text || text.length > 12000) return null;

  const lower = text.toLowerCase();
  const explicitlyDifferentGenre =
    /\b(farm(?:ing)?|bertani|kebun|panen|racing|race|balap|pokemon|monster.?tamer|creature.?collection|puzzle|teka.?teki|shooter|tembak|survival|zombie|strategy|strategi|simulation|simulasi|rpg|role.?playing)\b/i.test(lower);

  if (explicitlyDifferentGenre) return null;

  const asksForPlatformer =
    /\b(platformer|platform game|mario|side.?scroll(?:er|ing)?|lompat|jump(?:ing)?)\b/i.test(lower);
  const asksForSimple2D =
    /\b2d\b|dua dimensi/i.test(lower) &&
    /\b(game|permainan)\b/i.test(lower) &&
    /\b(sederhana|simple|basic|mudah|berjalan|playable|bisa dimainkan)\b/i.test(lower);

  if (!asksForPlatformer && !asksForSimple2D) return null;

  const requestedTitle = text.split(/[.!?\n]/).map((part) => part.trim()).find(Boolean);
  const title = (requestedTitle || "Petualangan Platformer 2D").slice(0, 70);

  return {
    title,
    concept: "Original 2D side-scrolling platformer using bundled illustrated sprite-sheet assets. " +
      "The player runs and jumps across platforms, collects five coins, avoids falling, and reaches the goal.",
    genre: "platformer",
    mood: /horror|horor|gelap|dark/i.test(lower) ? "tense" : "adventurous",
    difficulty: /sulit|hard|menantang|challenging/i.test(lower) ? "hard" : "easy",
    theme: "Original colorful 2D adventure",
    world: "Side-scrolling outdoor level with illustrated scenery, platforms, coins, and a finish flag",
    coreLoop: "Run → jump across platforms → collect coins → reach the finish flag",
    objective: "Collect five coins and reach the finish flag without falling.",
    mechanics: ["side-scrolling movement", "jumping and gravity", "platform collision", "coin collection", "finish goal"],
    playerActions: ["move left", "move right", "jump", "collect coins", "restart"],
    controls: ["A/D or Left/Right Arrow to move", "Space or Up Arrow to jump", "On-screen touch buttons on Android"],
    progression: "Collect five coins placed across the level and reach the finish flag.",
    replayability: "Restart the level to improve completion time and collect all coins.",
    winCondition: "Reach the finish flag after collecting five coins.",
    loseCondition: "Fall below the level bounds; restart to try again.",
    visualStyle: "Original illustrated 2D game art with a real authored character sprite sheet, multi-state animation, and illustrated environment assets; never use geometric player placeholders.",
    mobileNotes: ["Responsive Phaser canvas", "On-screen left/right/jump controls", "No provider API required for this template"],
    testRequirements: [
      "Phaser 4.2.1 boots",
      "Bundled protagonist sprite sheet loads",
      "Idle and run animation frames advance",
      "Keyboard and touch movement work",
      "Jump and platform collisions work",
      "Coin collection updates the objective",
      "Win, lose, and restart states work",
    ],
  };
}
