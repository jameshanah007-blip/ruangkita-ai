export type LabStatus =
  | "idle"
  | "understanding"
  | "designing"
  | "building"
  | "testing"
  | "debugging"
  | "repairing"
  | "retesting"
  | "ready"
  | "failed";

export type LabStage =
  | "director"
  | "builder"
  | "sandbox"
  | "tester"
  | "debugger"
  | "final";

export type GameBlueprint = {
  title: string;
  concept: string;
  genre: string;
  mood: string;
  difficulty: string;
  theme: string;
  world: string;

  coreLoop: string;
  objective: string;

  mechanics: string[];
  playerActions: string[];
  controls: string[];

  progression: string;
  replayability: string;

  winCondition: string;
  loseCondition: string;

  visualStyle: string;
  mobileNotes: string[];

  testRequirements: string[];
};

export type GameArtifact = {
  version: number;

  source: string;

  format: "html";

  title: string;
  genre: string;

  seed: string;

  provider: string;
  model: string;

  createdAt: string;

  buildAttempts: number;
};

export type ReferenceImageEvidence = {
  version: 1;
  available: boolean;
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
  dataUrl?: string;
  width?: number;
  height?: number;
  source: "user-upload";
};

export type ReferenceVisualComparison = {
  version: 1;
  analyzed: boolean;
  provider: "openai-vision" | "native-metrics";
  score: number;
  passed: boolean;
  summary: string;
  mismatches: string[];
  repairs: string[];
};

export type RuntimeVisualAnalysis = {
  version: 1;
  passed: boolean;
  score: number;
  issues: Array<{
    severity: "info" | "warning" | "critical";
    area: "rendering" | "canvas" | "animation" | "input" | "audio" | "runtime";
    message: string;
    repair: string;
  }>;
};

export type RuntimeScreenshotEvidence = {
  available: boolean;
  width: number;
  height: number;
  nonBlankPixels: number;
  dataUrl?: string;
  metrics?: {
    occupancy: number;
    averageLuminance: number;
    colorVariance: number;
    edgeDensity: number;
  };
};

export type RuntimeError = {
  message: string;
  source?: string;
  line?: number | null;
  column?: number | null;
};

export type CharacterRuntimeEvidence = {
  type: "animated-sprite-2d" | string;
  playerAnimation?: string;
  playerFrames?: number;
  playerKind?: string;
  creatureAnimation?: string | null;
};

export type SandboxTestEvidence = {
  hardFailures: string[];
  softWarnings: string[];

  runtimeErrors: RuntimeError[];

  rendered: boolean;
  loopStarted: boolean;
  frameAdvanced: boolean;

  canvasValid: boolean;
  inputTest: boolean;
  gameplayTest: boolean;
  performanceTest: boolean;

  runtimeOk: boolean;

  frameCount: number;
  gameAnimationFrames: number;

  inputEvents: number;
  inputListeners: number;

  canvasWidth: number;
  canvasHeight: number;

  nonBlankPixels: number;
  renderChanged: boolean;

  elapsedMs: number;

  screenshot?: RuntimeScreenshotEvidence;
  runtimeVisualAnalysis?: RuntimeVisualAnalysis;
  referenceVisualComparison?: ReferenceVisualComparison;

  engine2D?: boolean;
  engine2DGenre?: string;
  engine2DSystems?: string[];
  runtimeEngine?: string;
  runtimeVersion?: string;
  genreState?: Record<string, unknown>;
  characterState?: CharacterRuntimeEvidence;

  gameTestProtocol: boolean;
  stateChanged: boolean;
  objectiveChanged: boolean;
  playerChanged: boolean;

  winStateDetected: boolean;
  loseStateDetected: boolean;

  restartVerified: boolean;

  tutorialAvailable?: boolean;
  directionalControls?: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };

  gameTestError?: string;
};

export type TestCheckStatus =
  | "pass"
  | "fail"
  | "warning"
  | "not_tested";

export type TestCheck = {
  name: string;
  status: TestCheckStatus;
  message?: string;
};

export type TestReport = {
  passed: boolean;

  startedAt: string;
  finishedAt: string;

  attempt: number;

  runtimeOk: boolean;
  rendered: boolean;
  loopStarted: boolean;
  frameAdvanced: boolean;

  canvasValid: boolean;
  inputTest: boolean;
  gameplayTest: boolean;
  performanceTest: boolean;

  stateChanged: boolean;
  objectiveChanged: boolean;
  playerChanged: boolean;
  restartVerified: boolean;

  frameCount: number;
  gameAnimationFrames: number;

  inputEvents: number;
  inputListeners: number;

  canvasWidth: number;
  canvasHeight: number;

  nonBlankPixels: number;
  renderChanged: boolean;

  elapsedMs: number;

  screenshot?: RuntimeScreenshotEvidence;
  runtimeVisualAnalysis?: RuntimeVisualAnalysis;
  referenceVisualComparison?: ReferenceVisualComparison;

  engine2D?: boolean;
  engine2DGenre?: string;
  engine2DSystems?: string[];
  runtimeEngine?: string;
  runtimeVersion?: string;
  genreState?: Record<string, unknown>;

  hardFailures: string[];
  softWarnings: string[];

  checks: TestCheck[];

  runtimeErrors: RuntimeError[];
};

export type RepairReport = {
  attempt: number;

  success: boolean;

  startedAt: string;
  finishedAt: string;

  provider?: string;
  model?: string;

  reason: string;

  changes?: string[];

  validationErrors?: string[];

  previousVersion: number;
  newVersion?: number;
};

export type LabEventType =
  | "session.created"

  | "director.started"
  | "director.completed"
  | "director.failed"

  | "builder.started"
  | "builder.completed"
  | "builder.failed"

  | "sandbox.started"
  | "sandbox.completed"

  | "tester.started"
  | "tester.completed"
  | "tester.passed"
  | "tester.failed"

  | "debugger.started"
  | "debugger.completed"
  | "debugger.failed"

  | "repair.started"
  | "repair.completed"

  | "retest.started"
  | "retest.completed"

  | "game.ready"
  | "session.failed";

export type LabEvent = {
  id: string;

  type: LabEventType;

  stage: LabStage;

  timestamp: string;

  message: string;

  attempt?: number;
};

export type LabSession = {
  id: string;

  prompt: string;

  seed: string;

  status: LabStatus;

  stage: LabStage;

  blueprint: GameBlueprint | null;

  artifact: GameArtifact | null;

  testReports: TestReport[];

  repairReports: RepairReport[];

  events: LabEvent[];

  currentAttempt: number;

  maxRepairAttempts: number;

  createdAt: string;

  updatedAt: string;

  error?: string;
};