import { z } from "zod";

export const GameCommandSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("SPAWN_ENTITY"),
      entity: z.object({
        id: z.string().min(1),
        type: z.enum([
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
        health: z.number().int().min(0).max(1000),
        attack: z.number().int().min(0).max(500),
        defense: z.number().int().min(0).max(500),
      }),
    }),

    z.object({
      type: z.literal("REMOVE_ENTITY"),
      entityId: z.string().min(1),
    }),

    z.object({
      type: z.literal("MOVE_ENTITY"),
      entityId: z.string().min(1),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }),

    z.object({
      type: z.literal("DAMAGE_ENTITY"),
      entityId: z.string().min(1),
      amount: z.number().int().min(0).max(500),
    }),

    z.object({
      type: z.literal("HEAL_PLAYER"),
      amount: z.number().int().min(0).max(500),
    }),

    z.object({
      type: z.literal("DAMAGE_PLAYER"),
      amount: z.number().int().min(0).max(500),
    }),

    z.object({
      type: z.literal("CHANGE_WEATHER"),
      weather: z.enum([
        "clear",
        "rain",
        "storm",
        "fog",
        "snow",
        "night",
      ]),
    }),

    z.object({
      type: z.literal("ADD_SCORE"),
      amount: z.number().int().min(-1000).max(1000),
    }),

    z.object({
      type: z.literal("TRIGGER_EVENT"),
      eventId: z.string().min(1),
      message: z.string().min(1).max(500),
    }),

    z.object({
      type: z.literal("START_BATTLE"),
      enemyId: z.string().min(1),
    }),

    z.object({
      type: z.literal("END_BATTLE"),
      result: z.enum([
        "victory",
        "defeat",
        "escape",
      ]),
    }),

    z.object({
      type: z.literal("OPEN_AREA"),
      areaName: z.string().min(1).max(100),
    }),

    z.object({
      type: z.literal("CHANGE_DIFFICULTY"),
      difficulty: z.enum([
        "easy",
        "medium",
        "hard",
        "extreme",
      ]),
    }),
  ]
);

export type GameCommand = z.infer<
  typeof GameCommandSchema
>;

export const GameCommandListSchema = z.object({
  commands: z
    .array(GameCommandSchema)
    .max(10),
  reasoning: z.string().max(1000),
});

export type GameCommandList = z.infer<
  typeof GameCommandListSchema
>;