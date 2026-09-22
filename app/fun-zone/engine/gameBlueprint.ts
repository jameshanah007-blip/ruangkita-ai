import { z } from "zod";

export const GameEntitySchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "player",
    "npc",
    "enemy",
    "item",
    "obstacle",
    "portal",
    "decoration",
  ]),
  name: z.string().min(1),
  description: z.string().max(300),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  health: z.number().int().min(0).max(1000).default(100),
  attack: z.number().int().min(0).max(500).default(10),
  defense: z.number().int().min(0).max(500).default(0),
});

export const GameWorldSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  environment: z.enum([
    "forest",
    "city",
    "village",
    "dungeon",
    "space",
    "ocean",
    "desert",
    "laboratory",
    "fantasy",
    "cyberpunk",
  ]),
  weather: z.enum([
    "clear",
    "rain",
    "storm",
    "fog",
    "snow",
    "night",
  ]),
  width: z.number().int().min(10).max(1000),
  height: z.number().int().min(10).max(1000),
});

export const GameRulesSchema = z.object({
  maxLives: z.number().int().min(1).max(10),
  combatEnabled: z.boolean(),
  explorationEnabled: z.boolean(),
  inventoryEnabled: z.boolean(),
  questsEnabled: z.boolean(),
  dynamicEventsEnabled: z.boolean(),
});

export const GameBlueprintSchema = z.object({
  title: z.string().min(1).max(100),
  genre: z.enum([
    "adventure",
    "action",
    "combat",
    "survival",
    "strategy",
    "mystery",
    "runner",
    "puzzle",
    "rpg",
    "simulation",
  ]),
  difficulty: z.enum([
    "easy",
    "medium",
    "hard",
    "extreme",
  ]),
  description: z.string().min(1).max(500),

  world: GameWorldSchema,

  player: z.object({
    name: z.string().min(1).max(50),
    health: z.number().int().min(1).max(1000),
    attack: z.number().int().min(0).max(500),
    defense: z.number().int().min(0).max(500),
    speed: z.number().int().min(1).max(100),
  }),

  entities: z.array(GameEntitySchema).max(50),

  rules: GameRulesSchema,

  openingScene: z.string().min(1).max(1000),

  possibleEvents: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(100),
      description: z.string().min(1).max(300),
    })
  ).max(30),

  victoryCondition: z.string().min(1).max(300),

  defeatCondition: z.string().min(1).max(300),
});

export type GameBlueprint = z.infer<
  typeof GameBlueprintSchema
>;