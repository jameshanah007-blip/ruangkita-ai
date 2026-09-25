import { z } from "zod";
import type {
  GameBlueprint,
  GameArtifact,
  LabEvent,
  LabSession,
  LabStage,
  LabStatus,
  RepairReport,
  RuntimeError,
  TestCheck,
  TestReport,
  TestCheckStatus,
} from "./types";

export const GameBlueprintSchema: z.ZodType<GameBlueprint> =
  z.object({
    title: z.string().trim().min(1).max(120),

    concept: z.string().trim().min(1).max(500),

    /*
     * Sengaja string biasa.
     * Jangan gunakan enum genre agar AI tetap
     * bebas menghasilkan genre baru.
     */
    genre: z.string().trim().min(1).max(80),

    mood: z.string().trim().min(1).max(100),

    /*
     * Difficulty tetap berupa string agar Director
     * tetap fleksibel, tetapi schema memberi batas.
     */
    difficulty: z.string().trim().min(1).max(50),

    theme: z.string().trim().min(1).max(150),

    world: z.string().trim().min(1).max(300),

    coreLoop: z.string().trim().min(1).max(500),

    objective: z.string().trim().min(1).max(500),

    mechanics: z
      .array(
        z.string().trim().min(1).max(240)
      )
      .min(1)
      .max(12),

    playerActions: z
      .array(
        z.string().trim().min(1).max(240)
      )
      .min(1)
      .max(12),

    controls: z
      .array(
        z.string().trim().min(1).max(240)
      )
      .min(1)
      .max(10),

    progression: z.string().trim().min(1).max(500),

    replayability: z.string().trim().min(1).max(500),

    winCondition: z
      .string()
      .trim()
      .min(1)
      .max(300),

    loseCondition: z
      .string()
      .trim()
      .min(1)
      .max(300),

    visualStyle: z
      .string()
      .trim()
      .min(1)
      .max(600),

    mobileNotes: z
      .array(
        z.string().trim().min(1).max(240)
      )
      .min(1)
      .max(10),

    testRequirements: z
      .array(
        z.string().trim().min(1).max(260)
      )
      .min(1)
      .max(12),
  });

export const RuntimeErrorSchema: z.ZodType<RuntimeError> =
  z.object({
    message: z.string().min(1).max(2000),

    source: z
      .string()
      .max(1000)
      .optional(),

    line: z
      .number()
      .int()
      .min(1)
      .nullable()
      .optional(),

    column: z
      .number()
      .int()
      .min(1)
      .nullable()
      .optional(),
  });

export const TestCheckStatusSchema: z.ZodType<TestCheckStatus> =
  z.enum([
    "pass",
    "fail",
    "warning",
    "not_tested",
  ]);

export const TestCheckSchema: z.ZodType<TestCheck> =
  z.object({
    name: z.string().min(1).max(120),

    status: TestCheckStatusSchema,

    message: z
      .string()
      .max(500)
      .optional(),
  });

export const TestReportSchema: z.ZodType<TestReport> =
  z.object({
    passed: z.boolean(),

    startedAt: z.string().min(1),

    finishedAt: z.string().min(1),

    attempt: z.number().int().min(1).max(10),

    runtimeOk: z.boolean(),

    rendered: z.boolean(),

    loopStarted: z.boolean(),

    frameAdvanced: z.boolean(),

    canvasValid: z.boolean(),

    inputTest: z.boolean(),

    gameplayTest: z.boolean(),

    performanceTest: z.boolean(),

    frameCount: z.number().int().min(0),

    gameAnimationFrames: z.number().int().min(0),

    inputEvents: z.number().int().min(0),

    inputListeners: z.number().int().min(0),

    canvasWidth: z.number().int().min(0),

    canvasHeight: z.number().int().min(0),

    nonBlankPixels: z.number().int().min(0),

    renderChanged: z.boolean(),

    elapsedMs: z.number().min(0),

    hardFailures: z
      .array(z.string().min(1).max(500))
      .max(30),

    softWarnings: z
      .array(z.string().min(1).max(500))
      .max(30),

    checks: z.array(TestCheckSchema).max(50),

    runtimeErrors: z
      .array(RuntimeErrorSchema)
      .max(20),
  });

export const GameArtifactSchema: z.ZodType<GameArtifact> =
  z.object({
    version: z.number().int().min(1),

    source: z.string().min(1).max(500_000),

    format: z.literal("html"),

    title: z.string().min(1).max(120),

    genre: z.string().min(1).max(80),

    seed: z.string().min(1).max(200),

    provider: z.string().min(1).max(100),

    model: z.string().min(1).max(150),

    createdAt: z.string().min(1),

    buildAttempts: z.number().int().min(1).max(10),
  });

export const RepairReportSchema: z.ZodType<RepairReport> =
  z.object({
    attempt: z.number().int().min(1).max(10),

    success: z.boolean(),

    startedAt: z.string().min(1),

    finishedAt: z.string().min(1),

    provider: z.string().max(100).optional(),

    model: z.string().max(150).optional(),

    reason: z.string().min(1).max(2000),

    changes: z
      .array(z.string().min(1).max(500))
      .max(30)
      .optional(),

    validationErrors: z
      .array(z.string().min(1).max(500))
      .max(30)
      .optional(),

    previousVersion: z.number().int().min(1),

    newVersion: z
      .number()
      .int()
      .min(1)
      .optional(),
  });

export const LabStatusSchema: z.ZodType<LabStatus> =
  z.enum([
    "idle",
    "understanding",
    "designing",
    "building",
    "testing",
    "debugging",
    "repairing",
    "retesting",
    "ready",
    "failed",
  ]);

export const LabStageSchema: z.ZodType<LabStage> =
  z.enum([
    "director",
    "builder",
    "sandbox",
    "tester",
    "debugger",
    "final",
  ]);

export const LabEventSchema: z.ZodType<LabEvent> =
  z.object({
    id: z.string().min(1),

    type: z.string().min(1).max(100) as z.ZodType<
      LabEvent["type"]
    >,

    stage: LabStageSchema,

    timestamp: z.string().min(1),

    message: z.string().min(1).max(1000),

    attempt: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional(),
  });

export const LabSessionSchema: z.ZodType<LabSession> =
  z.object({
    id: z.string().min(1).max(200),

    prompt: z.string().min(1).max(3000),

    seed: z.string().min(1).max(200),

    status: LabStatusSchema,

    stage: LabStageSchema,

    blueprint: GameBlueprintSchema.nullable(),

    artifact: GameArtifactSchema.nullable(),

    testReports: z
      .array(TestReportSchema)
      .max(20),

    repairReports: z
      .array(RepairReportSchema)
      .max(20),

    events: z
      .array(LabEventSchema)
      .max(200),

    currentAttempt: z
      .number()
      .int()
      .min(0)
      .max(10),

    maxRepairAttempts: z
      .number()
      .int()
      .min(1)
      .max(10),

    createdAt: z.string().min(1),

    updatedAt: z.string().min(1),

    error: z
      .string()
      .max(2000)
      .optional(),
  });

/**
 * Parse dan validasi hasil AI Game Director.
 */
export function parseGameBlueprint(
  value: unknown
): GameBlueprint {
  return GameBlueprintSchema.parse(value);
}

/**
 * Parse dan validasi hasil Builder.
 */
export function parseGameArtifact(
  value: unknown
): GameArtifact {
  return GameArtifactSchema.parse(value);
}

/**
 * Safe parse untuk debugging dan API response.
 */
export function safeParseGameBlueprint(
  value: unknown
) {
  return GameBlueprintSchema.safeParse(value);
}

export function safeParseTestReport(
  value: unknown
) {
  return TestReportSchema.safeParse(value);
}

export function safeParseLabSession(
  value: unknown
) {
  return LabSessionSchema.safeParse(value);
}