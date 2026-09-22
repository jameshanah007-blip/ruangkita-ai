import { z } from "zod";

export const GameChallengeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "multiple_choice",
    "riddle",
    "true_false",
    "sequence",
    "text_input",
  ]),
  question: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
});

export const GameRulesSchema = z.object({
  lives: z.number().int().min(1).max(10),
  scorePerCorrect: z.number().int().min(0).max(10000),
  timeLimitSeconds: z.number().int().min(0).max(3600),
});

export const GameSpecificationSchema = z.object({
  title: z.string().min(1).max(100),

  description: z.string().min(1).max(500),

  genre: z.enum([
    "quiz",
    "mystery",
    "adventure",
    "puzzle",
    "arcade",
    "strategy",
    "riddle",
    "education",
  ]),

  theme: z.string().min(1).max(100),

  difficulty: z.enum([
    "easy",
    "medium",
    "hard",
    "extreme",
  ]),

  durationMinutes: z.number().int().min(1).max(30),

  mechanic: z.enum([
    "multiple_choice",
    "riddle",
    "true_false",
    "sequence",
    "text_input",
  ]),

  objective: z.string().min(1).max(300),

  rules: GameRulesSchema,

  challenges: z
    .array(GameChallengeSchema)
    .min(1)
    .max(20),

  victoryMessage: z.string().min(1).max(300),

  defeatMessage: z.string().min(1).max(300),
});

export type GameSpecification = z.infer<
  typeof GameSpecificationSchema
>;