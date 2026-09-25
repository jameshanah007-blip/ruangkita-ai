import type {
  GameArtifact,
  GameBlueprint,
  LabEvent,
  LabEventType,
  LabSession,
  LabStage,
  LabStatus,
  RepairReport,
  TestReport,
} from "./types";

const DEFAULT_MAX_REPAIR_ATTEMPTS = 5;

function now(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createSeed(): string {
  return Math.random()
    .toString(36)
    .slice(2, 14);
}

function createEvent(
  type: LabEventType,
  stage: LabStage,
  message: string,
  attempt?: number
): LabEvent {
  return {
    id: createId("event"),
    type,
    stage,
    timestamp: now(),
    message,
    ...(attempt !== undefined
      ? { attempt }
      : {}),
  };
}

export type CreateLabSessionOptions = {
  prompt: string;
  maxRepairAttempts?: number;
  seed?: string;
};

export function createLabSession(
  options: CreateLabSessionOptions
): LabSession {
  const timestamp = now();

  const prompt =
    options.prompt.trim();

  if (!prompt) {
    throw new Error(
      "Prompt game tidak boleh kosong."
    );
  }

  const sessionId =
    createId("lab");

  const seed =
    options.seed?.trim() ||
    createSeed();

  const maxRepairAttempts =
    Number.isInteger(
      options.maxRepairAttempts
    ) &&
    Number(options.maxRepairAttempts) > 0
      ? Number(options.maxRepairAttempts)
      : DEFAULT_MAX_REPAIR_ATTEMPTS;

  return {
    id: sessionId,

    prompt,

    seed,

    status: "idle",

    stage: "director",

    blueprint: null,

    artifact: null,

    testReports: [],

    repairReports: [],

    events: [
      createEvent(
        "session.created",
        "director",
        "Laboratory session dibuat."
      ),
    ],

    currentAttempt: 0,

    maxRepairAttempts,

    createdAt: timestamp,

    updatedAt: timestamp,
  };
}

export function updateSession(
  session: LabSession,
  patch: Partial<LabSession>
): LabSession {
  return {
    ...session,
    ...patch,
    updatedAt: now(),
  };
}

export function setStatus(
  session: LabSession,
  status: LabStatus,
  stage?: LabStage
): LabSession {
  return updateSession(
    session,
    {
      status,
      ...(stage
        ? { stage }
        : {}),
    }
  );
}

export function addEvent(
  session: LabSession,
  type: LabEventType,
  stage: LabStage,
  message: string,
  attempt?: number
): LabSession {
  return updateSession(
    session,
    {
      events: [
        ...session.events,
        createEvent(
          type,
          stage,
          message,
          attempt
        ),
      ],
    }
  );
}

export function setBlueprint(
  session: LabSession,
  blueprint: GameBlueprint
): LabSession {
  return updateSession(
    session,
    {
      blueprint,
      status: "building",
      stage: "builder",
    }
  );
}

export type CreateArtifactOptions = {
  blueprint: GameBlueprint;

  provider: string;

  model: string;

  buildAttempts: number;

  source?: string;

  version?: number;
};

export function createArtifact(
  options: CreateArtifactOptions
): GameArtifact {
  return {
    version:
      options.version ?? 1,

    source:
      options.source ??
      "ai-builder",

    format: "html",

    title:
      options.blueprint.title,

    genre:
      options.blueprint.genre,

    seed:
      createSeed(),

    provider:
      options.provider,

    model:
      options.model,

    createdAt:
      now(),

    buildAttempts:
      options.buildAttempts,
  };
}

export function setArtifact(
  session: LabSession,
  artifact: GameArtifact
): LabSession {
  return updateSession(
    session,
    {
      artifact,
      status: "testing",
      stage: "tester",
    }
  );
}

export function addTestReport(
  session: LabSession,
  report: TestReport
): LabSession {
  return updateSession(
    session,
    {
      testReports: [
        ...session.testReports,
        report,
      ],
      currentAttempt:
        report.attempt,
    }
  );
}

export function markTestPassed(
  session: LabSession,
  report: TestReport
): LabSession {
  let next =
    addTestReport(
      session,
      report
    );

  next =
    addEvent(
      next,
      "tester.completed",
      "tester",
      "AI Tester selesai.",
      report.attempt
    );

  next =
    addEvent(
      next,
      "tester.passed",
      "tester",
      "Game lulus seluruh pemeriksaan.",
      report.attempt
    );

  next =
    addEvent(
      next,
      "game.ready",
      "final",
      "Game siap dimainkan.",
      report.attempt
    );

  return setStatus(
    next,
    "ready",
    "final"
  );
}

export function markTestFailed(
  session: LabSession,
  report: TestReport
): LabSession {
  let next =
    addTestReport(
      session,
      report
    );

  next =
    addEvent(
      next,
      "tester.completed",
      "tester",
      "AI Tester selesai.",
      report.attempt
    );

  next =
    addEvent(
      next,
      "tester.failed",
      "tester",
      report.hardFailures.length > 0
        ? report.hardFailures.join(" ")
        : "Game belum memenuhi seluruh test.",
      report.attempt
    );

  return setStatus(
    next,
    "debugging",
    "debugger"
  );
}

export function canRepair(
  session: LabSession
): boolean {
  return (
    session.currentAttempt <
    session.maxRepairAttempts
  );
}

export function getRemainingRepairAttempts(
  session: LabSession
): number {
  return Math.max(
    0,
    session.maxRepairAttempts -
      session.currentAttempt
  );
}

export function beginDebugging(
  session: LabSession
): LabSession {
  return addEvent(
    setStatus(
      session,
      "debugging",
      "debugger"
    ),
    "debugger.started",
    "debugger",
    "AI Debugger mulai menganalisis kegagalan.",
    session.currentAttempt
  );
}

export function beginRepairing(
  session: LabSession
): LabSession {
  return addEvent(
    setStatus(
      session,
      "repairing",
      "debugger"
    ),
    "repair.started",
    "debugger",
    "AI Repair mulai memperbaiki game.",
    session.currentAttempt
  );
}

export function addRepairReport(
  session: LabSession,
  report: RepairReport
): LabSession {
  return updateSession(
    session,
    {
      repairReports: [
        ...session.repairReports,
        report,
      ],
    }
  );
}

export function markRepairCompleted(
  session: LabSession,
  report: RepairReport
): LabSession {
  let next =
    addRepairReport(
      session,
      report
    );

  next =
    addEvent(
      next,
      "repair.completed",
      "debugger",
      report.success
        ? "AI Repair berhasil memperbaiki artifact."
        : "AI Repair selesai tetapi belum menghasilkan perbaikan yang valid.",
      report.attempt
    );

  if (!report.success) {
    return next;
  }

  return setStatus(
    next,
    "retesting",
    "tester"
  );
}

export function beginRetesting(
  session: LabSession
): LabSession {
  return addEvent(
    setStatus(
      session,
      "retesting",
      "tester"
    ),
    "retest.started",
    "tester",
    "Game hasil repair dikirim kembali ke sandbox untuk retest.",
    session.currentAttempt
  );
}

export function completeRetesting(
  session: LabSession,
  report: TestReport
): LabSession {
  let next =
    addTestReport(
      session,
      report
    );

  next =
    addEvent(
      next,
      "retest.completed",
      "tester",
      report.passed
        ? "Retest berhasil."
        : "Retest gagal.",
      report.attempt
    );

  if (report.passed) {
    next =
      addEvent(
        next,
        "game.ready",
        "final",
        "Game lulus retest dan siap dimainkan.",
        report.attempt
      );

    return setStatus(
      next,
      "ready",
      "final"
    );
  }

  if (
    report.attempt >=
    session.maxRepairAttempts
  ) {
    return failSession(
      next,
      "Game masih gagal setelah mencapai batas maksimum repair."
    );
  }

  return setStatus(
    next,
    "debugging",
    "debugger"
  );
}

export function failSession(
  session: LabSession,
  error: string
): LabSession {
  let next =
    updateSession(
      session,
      {
        status: "failed",
        stage: "final",
        error,
      }
    );

  next =
    addEvent(
      next,
      "session.failed",
      "final",
      error
    );

  return next;
}

export function markDirectorStarted(
  session: LabSession
): LabSession {
  return addEvent(
    setStatus(
      session,
      "understanding",
      "director"
    ),
    "director.started",
    "director",
    "AI Director mulai memahami prompt."
  );
}

export function markDirectorCompleted(
  session: LabSession,
  blueprint: GameBlueprint
): LabSession {
  let next =
    setBlueprint(
      session,
      blueprint
    );

  next =
    addEvent(
      next,
      "director.completed",
      "director",
      `Blueprint "${blueprint.title}" berhasil dibuat.`
    );

  return next;
}

export function markDirectorFailed(
  session: LabSession,
  error: string
): LabSession {
  let next =
    addEvent(
      session,
      "director.failed",
      "director",
      error
    );

  return failSession(
    next,
    error
  );
}

export function markBuilderStarted(
  session: LabSession
): LabSession {
  return addEvent(
    setStatus(
      session,
      "building",
      "builder"
    ),
    "builder.started",
    "builder",
    "AI Builder mulai membuat Game Artifact."
  );
}

export function markBuilderCompleted(
  session: LabSession,
  artifact: GameArtifact
): LabSession {
  let next =
    setArtifact(
      session,
      artifact
    );

  next =
    addEvent(
      next,
      "builder.completed",
      "builder",
      `Game Artifact "${artifact.title}" berhasil dibuat.`
    );

  return next;
}

export function markBuilderFailed(
  session: LabSession,
  error: string
): LabSession {
  let next =
    addEvent(
      session,
      "builder.failed",
      "builder",
      error
    );

  return failSession(
    next,
    error
  );
}

export function markSandboxStarted(
  session: LabSession
): LabSession {
  return addEvent(
    setStatus(
      session,
      "testing",
      "sandbox"
    ),
    "sandbox.started",
    "sandbox",
    "Game Artifact mulai dijalankan di sandbox.",
    session.currentAttempt
  );
}

export function markSandboxCompleted(
  session: LabSession
): LabSession {
  return addEvent(
    session,
    "sandbox.completed",
    "sandbox",
    "Sandbox selesai mengumpulkan runtime evidence.",
    session.currentAttempt
  );
}

export function markTesterStarted(
  session: LabSession
): LabSession {
  return addEvent(
    setStatus(
      session,
      "testing",
      "tester"
    ),
    "tester.started",
    "tester",
    "AI Tester mulai mengevaluasi runtime evidence.",
    session.currentAttempt
  );
}

export function startRepairCycle(
  session: LabSession,
  reason: string
): LabSession {
  if (!canRepair(session)) {
    return failSession(
      session,
      "Batas maksimum repair telah tercapai."
    );
  }

  let next =
    beginDebugging(
      session
    );

  next =
    addEvent(
      next,
      "debugger.completed",
      "debugger",
      reason,
      session.currentAttempt
    );

  return next;
}

export function getLatestTestReport(
  session: LabSession
): TestReport | null {
  if (
    session.testReports.length === 0
  ) {
    return null;
  }

  return session.testReports[
    session.testReports.length - 1
  ];
}

export function getLatestRepairReport(
  session: LabSession
): RepairReport | null {
  if (
    session.repairReports.length === 0
  ) {
    return null;
  }

  return session.repairReports[
    session.repairReports.length - 1
  ];
}