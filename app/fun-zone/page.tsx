"use client";

import SiteNav from "../components/SiteNav";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AIGameSandbox from "./engine/AIGameSandbox";

import type {
  GameBlueprint,
  TestReport,
} from "./laboratory/types";

type LabStage =
  | "idle"
  | "understanding"
  | "designing"
  | "building"
  | "testing"
  | "ready"
  | "error";

type LaboratoryResponse = {
  success?: boolean;
  stage?: string;
  error?: string;

  session?: {
    id: string;
    seed: string;
    status: string;
    stage: string;
    currentAttempt: number;
  };

  blueprint?: GameBlueprint;

  artifact?: {
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

  gameHtml?: string;

  validation?: {
    valid?: boolean;
    errors?: string[];
    warnings?: string[];
  };

  provider?: string | null;
  model?: string | null;
};

type TerminalLine = {
  text: string;
  tone?: "normal" | "success" | "warning" | "cyan";
};

const stages: {
  id: LabStage;
  label: string;
}[] = [
  {
    id: "understanding",
    label: "Understanding request",
  },
  {
    id: "designing",
    label: "Designing gameplay",
  },
  {
    id: "building",
    label: "Building game",
  },
  {
    id: "testing",
    label: "Testing game",
  },
  {
    id: "ready",
    label: "Finalizing",
  },
];

function getStageIndex(stage: LabStage): number {
  return stages.findIndex(
    (item) => item.id === stage
  );
}

function getStageProgress(stage: LabStage): number {
  switch (stage) {
    case "understanding":
      return 12;

    case "designing":
      return 30;

    case "building":
      return 58;

    case "testing":
      return 82;

    case "ready":
      return 100;

    default:
      return 0;
  }
}

function getStageDescription(stage: LabStage): string {
  switch (stage) {
    case "understanding":
      return "AI sedang memahami ide game yang kamu berikan.";

    case "designing":
      return "AI Game Director sedang menyusun dunia, gameplay, mekanik, objective, kontrol, dan kondisi kemenangan.";

    case "building":
      return "AI Game Builder sedang mengubah blueprint menjadi game HTML yang benar-benar playable.";

    case "testing":
      return "Game sedang dijalankan di isolated sandbox dan diperiksa oleh AI Tester.";

    case "ready":
      return "Game telah melewati pemeriksaan dan siap dimainkan.";

    case "error":
      return "Laboratorium mengalami masalah saat menjalankan pipeline.";

    default:
      return "AI Game Laboratory siap menerima ide game kamu.";
  }
}

function getTerminalLines(
  stage: LabStage,
  blueprint: GameBlueprint | null,
  provider: string,
  model: string
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push({
    text: "[LAB] Session initialized",
    tone: "cyan",
  });

  if (
    stage === "understanding" ||
    getStageIndex(stage) >=
      getStageIndex("understanding")
  ) {
    lines.push({
      text:
        "[DIRECTOR] Reading free-form game request...",
    });

    lines.push({
      text:
        "[DIRECTOR] Extracting gameplay intent...",
    });

    lines.push({
      text:
        "[DIRECTOR] Understanding genre, mood, theme and objective...",
    });
  }

  if (
    stage === "designing" ||
    getStageIndex(stage) >=
      getStageIndex("designing")
  ) {
    lines.push({
      text:
        "[DIRECTOR] Building Game Blueprint...",
    });

    if (blueprint) {
      lines.push({
        text:
          `[DESIGN] Title: ${blueprint.title}`,
        tone: "success",
      });

      lines.push({
        text:
          `[DESIGN] Genre: ${blueprint.genre}`,
        tone: "success",
      });

      lines.push({
        text:
          `[DESIGN] Mood: ${blueprint.mood}`,
      });

      lines.push({
        text:
          `[DESIGN] Difficulty: ${blueprint.difficulty}`,
      });

      lines.push({
        text:
          `[DESIGN] Objective: ${blueprint.objective}`,
      });

      lines.push({
        text:
          `[DESIGN] Core loop: ${blueprint.coreLoop}`,
      });

      lines.push({
        text:
          `[DESIGN] Mechanics: ${blueprint.mechanics.join(
            ", "
          )}`,
      });
    } else {
      lines.push({
        text:
          "[DIRECTOR] Waiting for Game Blueprint...",
        tone: "cyan",
      });
    }
  }

  if (
    stage === "building" ||
    getStageIndex(stage) >=
      getStageIndex("building")
  ) {
    lines.push({
      text:
        "[BUILDER] Receiving Game Blueprint...",
    });

    lines.push({
      text:
        "[BUILDER] Generating game architecture...",
    });

    lines.push({
      text:
        "[BUILDER] Generating gameplay systems...",
    });

    lines.push({
      text:
        "[BUILDER] Generating responsive interface...",
    });

    lines.push({
      text:
        "[BUILDER] Generating mobile controls...",
    });

    lines.push({
      text:
        "[BUILDER] Generating runtime game...",
    });
  }

  if (
    stage === "testing" ||
    stage === "ready"
  ) {
    lines.push({
      text:
        "[BUILDER] Game Artifact generated",
      tone: "success",
    });

    lines.push({
      text:
        "[SANDBOX] Starting isolated runtime...",
      tone: "cyan",
    });

    lines.push({
      text:
        "[TESTER] Collecting runtime evidence...",
    });

    lines.push({
      text:
        "[TESTER] Checking rendering...",
    });

    lines.push({
      text:
        "[TESTER] Checking game loop...",
    });

    lines.push({
      text:
        "[TESTER] Checking input...",
    });

    lines.push({
      text:
        "[TESTER] Checking gameplay state...",
    });

    lines.push({
      text:
        "[TESTER] Checking runtime stability...",
    });
  }

  if (stage === "ready") {
    lines.push({
      text:
        "[TESTER] Test report: PASS",
      tone: "success",
    });

    if (provider) {
      lines.push({
        text:
          `[AI] Provider: ${provider}`,
      });
    }

    if (model) {
      lines.push({
        text:
          `[AI] Model: ${model}`,
      });
    }

    lines.push({
      text:
        "[LAB] Game finalized successfully",
      tone: "success",
    });
  }

  return lines;
}

export default function FunZonePage() {
  const [prompt, setPrompt] =
    useState("");

  const [stage, setStage] =
    useState<LabStage>("idle");

  const [blueprint, setBlueprint] =
    useState<GameBlueprint | null>(
      null
    );

  const [gameHtml, setGameHtml] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [genre, setGenre] =
    useState("");

  const [provider, setProvider] =
    useState("");

  const [model, setModel] =
    useState("");

  const [seed, setSeed] =
    useState("");

  const [error, setError] =
    useState("");

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [terminalTick, setTerminalTick] =
    useState(0);

  const [testReport, setTestReport] =
    useState<TestReport | null>(
      null
    );

  const currentStageIndex =
    getStageIndex(stage);

  const progress =
    getStageProgress(stage);

  const terminalLines =
    useMemo(
      () =>
        getTerminalLines(
          stage,
          blueprint,
          provider,
          model
        ),
      [
        stage,
        blueprint,
        provider,
        model,
      ]
    );

  useEffect(() => {
    if (!isGenerating) {
      return;
    }

    const interval =
      window.setInterval(() => {
        setTerminalTick(
          (value) =>
            value + 1
        );
      }, 700);

    return () =>
      window.clearInterval(
        interval
      );
  }, [isGenerating]);

  async function buildGame() {
    const trimmedPrompt =
      prompt.trim();

    if (!trimmedPrompt) {
      setError(
        "Tuliskan ide game terlebih dahulu."
      );

      return;
    }

    setError("");
    setBlueprint(null);
    setGameHtml("");
    setTitle("");
    setGenre("");
    setProvider("");
    setModel("");
    setSeed("");
    setTestReport(null);
    setTerminalTick(0);
    setIsGenerating(true);

    try {
      const sessionSeed =
        crypto.randomUUID();

      setSeed(
        sessionSeed
      );

      setStage(
        "understanding"
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            450
          )
      );

      setStage(
        "designing"
      );

      const response =
        await fetch(
          "/api/fun-zone/laboratory",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              prompt:
                trimmedPrompt,

              seed:
                sessionSeed,

              maxRepairAttempts: 5,
            }),
          }
        );

      const data =
        (await response.json()) as LaboratoryResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Laboratory gagal membuat game."
        );
      }

      if (
        !data.blueprint
      ) {
        throw new Error(
          "Laboratory tidak menghasilkan Game Blueprint."
        );
      }

      setBlueprint(
        data.blueprint
      );

      setTitle(
        data.blueprint.title
      );

      setGenre(
        data.blueprint.genre
      );

      setStage(
        "building"
      );

      setProvider(
        data.provider ||
          data.artifact?.provider ||
          ""
      );

      setModel(
        data.model ||
          data.artifact?.model ||
          ""
      );

      if (
        !data.gameHtml
      ) {
        throw new Error(
          "Laboratory tidak menghasilkan Game Artifact."
        );
      }

      setGameHtml(
        data.gameHtml
      );

      setStage(
        "testing"
      );
    } catch (err) {
      console.error(
        "Fun Zone Laboratory error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menjalankan AI Game Laboratory."
      );

      setStage(
        "error"
      );
    } finally {
      setIsGenerating(
        false
      );
    }
  }

const handleTestReport =
  useCallback(
    (report: TestReport) => {
      setTestReport(report);

      if (report.passed) {
        setError("");
        setStage("ready");
        return;
      }

      if (report.hardFailures.length > 0) {
        setError(
          report.hardFailures.join(" ")
        );
      }
    },
    []
  );  

  function createAnotherGame() {
    setStage(
      "idle"
    );

    setBlueprint(
      null
    );

    setGameHtml(
      ""
    );

    setTitle(
      ""
    );

    setGenre(
      ""
    );

    setError(
      ""
    );

    setProvider(
      ""
    );

    setModel(
      ""
    );

    setSeed(
      ""
    );

    setTestReport(
      null
    );

    setTerminalTick(
      0
    );

    setIsGenerating(
      false
    );
  }

const handleSandboxReady =
  useCallback(() => {
    setError("");
    setStage("ready");
  }, []);

const handleSandboxError =
  useCallback((message: string) => {
    setError(message);
  }, []);

  const showLaboratory =
    stage !== "idle" &&
    stage !== "error";

  const showSandbox =
    Boolean(
      gameHtml &&
      blueprint
    );

  const visibleTerminalLines =
    terminalLines.slice(
      0,
      Math.max(
        1,
        Math.min(
          terminalLines.length,
          Math.floor(
            terminalTick / 2
          ) + 2
        )
      )
    );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <SiteNav />

      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <a
            href="/"
            className="text-lg font-bold"
          >
            RuangKita AI
          </a>

          <div className="flex gap-5 text-sm text-slate-400">

            <a
              href="/"
              className="transition hover:text-white"
            >
              Home
            </a>

            <a
              href="/ai"
              className="transition hover:text-white"
            >
              AI Executor
            </a>

            <a
              href="/forum"
              className="transition hover:text-white"
            >
              Forum
            </a>

            <a
              href="/fun-zone"
              className="text-cyan-400"
            >
              Fun Zone
            </a>

          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-10 md:py-16">

        {stage === "idle" && (
          <>
            <div className="mx-auto max-w-4xl text-center">

              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">

                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />

                AI GAME LABORATORY

              </div>

              <h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">

                Describe a game.

                <br />

                <span className="text-cyan-400">
                  AI builds it.
                </span>

              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
                Ceritakan game yang ada
                di pikiranmu. AI akan
                memahami ide tersebut,
                membuat blueprint,
                membangun game, menguji,
                dan memperbaikinya.
              </p>

            </div>

            <div className="mx-auto mt-12 max-w-4xl">

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-cyan-950/20 md:p-6">

                <label
                  htmlFor="game-prompt"
                  className="mb-3 block text-sm font-semibold text-slate-300"
                >
                  Ceritakan game yang
                  ingin kamu buat
                </label>

                <textarea
                  id="game-prompt"
                  value={prompt}
                  onChange={(event) =>
                    setPrompt(
                      event.target.value
                    )
                  }
                  maxLength={3000}
                  rows={6}
                  placeholder="Contoh: Buat game survival horror di rumah sakit tua. Pemain harus mencari 3 kunci sambil menghindari monster. Jika semua kunci ditemukan, pemain harus mencapai pintu keluar."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base leading-7 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />

                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">

                  <span>
                    Bebas. AI akan
                    menentukan genre,
                    mekanik, kontrol,
                    dan gameplay.
                  </span>

                  <span>
                    {prompt.length}/3000
                  </span>

                </div>

                {error && (
                  <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm leading-6 text-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={
                    buildGame
                  }
                  disabled={
                    isGenerating ||
                    !prompt.trim()
                  }
                  className="mt-6 w-full rounded-2xl bg-cyan-500 px-6 py-4 text-base font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGenerating
                    ? "AI LABORATORY IS WORKING..."
                    : "✓ BUILD MY GAME"}
                </button>

              </div>
            </div>

            <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                <div className="text-2xl">
                  🧠
                </div>

                <h3 className="mt-3 font-bold">
                  AI Director
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Memahami prompt bebas
                  dan membuat Game
                  Blueprint.
                </p>

              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                <div className="text-2xl">
                  🛠️
                </div>

                <h3 className="mt-3 font-bold">
                  AI Builder
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Mengubah blueprint
                  menjadi game
                  playable.
                </p>

              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                <div className="text-2xl">
                  🧪
                </div>

                <h3 className="mt-3 font-bold">
                  AI Test Lab
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Menjalankan game
                  dalam isolated
                  runtime dan
                  melakukan testing.
                </p>

              </div>

            </div>
          </>
        )}

        {showLaboratory && (
          <div className="mx-auto max-w-7xl">

            <div className="text-center">

              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">

                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />

                AI LABORATORY ACTIVE

              </div>

              <h2 className="mt-5 text-3xl font-black md:text-5xl">

                {stage === "ready"
                  ? "Game siap dimainkan"
                  : "AI sedang bekerja..."}

              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                {getStageDescription(
                  stage
                )}
              </p>

            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-[1.5fr_0.8fr]">

              <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-cyan-950/10">

                <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-4 py-3">

                  <div className="flex items-center gap-2">

                    <span className="h-3 w-3 rounded-full bg-red-400/70" />

                    <span className="h-3 w-3 rounded-full bg-yellow-400/70" />

                    <span className="h-3 w-3 rounded-full bg-green-400/70" />

                  </div>

                  <div className="font-mono text-[11px] text-slate-500">
                    ai-game-lab / terminal
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">

                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />

                    LIVE

                  </div>

                </div>

                <div className="min-h-[390px] p-5 font-mono text-xs leading-7 md:p-6 md:text-sm">

                  {visibleTerminalLines.map(
                    (
                      line,
                      index
                    ) => (
                      <div
                        key={`${line.text}-${index}`}
                        className={`flex gap-3 ${
                          line.tone ===
                          "success"
                            ? "text-emerald-400"
                            : line.tone ===
                                "cyan"
                              ? "text-cyan-400"
                              : "text-slate-400"
                        }`}
                      >

                        <span className="select-none text-slate-700">
                          {String(
                            index +
                              1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </span>

                        <span className="min-w-0 break-words">
                          {line.text}
                        </span>

                      </div>
                    )
                  )}

                  {isGenerating && (
                    <div className="mt-3 flex gap-3 text-cyan-400">

                      <span className="select-none text-slate-700">
                        {String(
                          visibleTerminalLines.length +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <span className="animate-pulse">
                        ▮
                      </span>

                    </div>
                  )}

                </div>

                <div className="border-t border-white/10 bg-slate-950 px-5 py-4">

                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">

                    <span className="text-slate-500">
                      Laboratory progress
                    </span>

                    <span className="text-cyan-400">
                      {progress}%
                    </span>

                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">

                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all duration-700"
                      style={{
                        width: `${progress}%`,
                      }}
                    />

                  </div>

                </div>

              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                      Laboratory Monitor
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      AI runtime diagnostics
                    </p>

                  </div>

                  <div className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 font-mono text-[10px] text-cyan-400">
                    {stage.toUpperCase()}
                  </div>

                </div>

                <div className="mt-6 space-y-3">

                  {[
                    {
                      label:
                        "AI Director",
                      active:
                        currentStageIndex >=
                        getStageIndex(
                          "designing"
                        ),
                    },

                    {
                      label:
                        "Game Blueprint",
                      active:
                        Boolean(
                          blueprint
                        ),
                    },

                    {
                      label:
                        "AI Builder",
                      active:
                        currentStageIndex >=
                        getStageIndex(
                          "building"
                        ),
                    },

                    {
                      label:
                        "Game Artifact",
                      active:
                        Boolean(
                          gameHtml
                        ),
                    },

                    {
                      label:
                        "Sandbox",
                      active:
                        currentStageIndex >=
                        getStageIndex(
                          "testing"
                        ),
                    },

                    {
                      label:
                        "Tester",
                      active:
                        Boolean(
                          testReport
                        ),
                    },

                    {
                      label:
                        "READY",
                      active:
                        stage ===
                        "ready",
                    },
                  ].map(
                    (test) => (
                      <div
                        key={
                          test.label
                        }
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3"
                      >

                        <span className="text-sm text-slate-300">
                          {
                            test.label
                          }
                        </span>

                        {test.active ? (
                          <span className="font-mono text-xs text-emerald-400">
                            ✓
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-700">
                            —
                          </span>
                        )}

                      </div>
                    )
                  )}

                </div>

                {blueprint && (
                  <div className="mt-6 rounded-2xl border border-white/5 bg-slate-950/60 p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Game Blueprint
                    </p>

                    <p className="mt-2 text-sm font-bold text-white">
                      {
                        blueprint.title
                      }
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">

                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-400">
                        {
                          blueprint.genre
                        }
                      </span>

                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-400">
                        {
                          blueprint.difficulty
                        }
                      </span>

                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-400">
                        {
                          blueprint.theme
                        }
                      </span>

                    </div>

                    <div className="mt-4">

                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        Objective
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {
                          blueprint.objective
                        }
                      </p>

                    </div>

                  </div>
                )}

                {testReport && (
                  <div
                    className={`mt-6 rounded-2xl border p-4 ${
                      testReport.passed
                        ? "border-emerald-400/20 bg-emerald-400/[0.04]"
                        : "border-red-400/20 bg-red-400/[0.04]"
                    }`}
                  >

                    <p
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        testReport.passed
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      Tester Result
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-400">

                      {testReport.passed
                        ? "Game memenuhi pemeriksaan tester."
                        : "Game masih memiliki pemeriksaan yang gagal. Sandbox dapat menjalankan proses repair."}

                    </p>

                    <div className="mt-3 flex justify-between text-[10px] text-slate-600">

                      <span>
                        Attempt
                      </span>

                      <span className="text-slate-400">
                        {
                          testReport.attempt
                        }
                      </span>

                    </div>

                    {!testReport
                      .passed &&
                      testReport
                        .hardFailures
                        .length >
                        0 && (
                        <div className="mt-3 space-y-1">

                          {testReport.hardFailures
                            .slice(
                              0,
                              3
                            )
                            .map(
                              (
                                failure
                              ) => (
                                <p
                                  key={
                                    failure
                                  }
                                  className="text-[10px] leading-4 text-red-200/70"
                                >
                                  •{" "}
                                  {
                                    failure
                                  }
                                </p>
                              )
                            )}

                        </div>
                      )}

                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                    AI Status
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {getStageDescription(
                      stage
                    )}
                  </p>

                </div>

                {(provider ||
                  model) && (
                  <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      AI Provider
                    </p>

                    {provider && (
                      <p className="mt-2 font-mono text-xs text-slate-400">
                        Provider:{" "}
                        {provider}
                      </p>
                    )}

                    {model && (
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">
                        Model:{" "}
                        {model}
                      </p>
                    )}

                  </div>
                )}

              </div>

            </div>

            {showSandbox && (
              <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-black">

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-5 py-3">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                      Runtime Preview
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Game dijalankan dalam
                      isolated sandbox.
                    </p>

                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-[10px] ${
                      stage ===
                      "ready"
                        ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-400"
                        : "border-cyan-400/20 bg-cyan-400/5 text-cyan-400"
                    }`}
                  >
                    {stage ===
                    "ready"
                      ? "READY"
                      : "LIVE RUNTIME"}
                  </span>

                </div>

                <AIGameSandbox
                  gameHtml={
                    gameHtml
                  }

                  title={
                    title ||
                    blueprint?.title ||
                    "AI Generated Game"
                  }

                  genre={
                    genre ||
                    blueprint?.genre ||
                    "AI Game"
                  }

                  blueprint={
                    blueprint ||
                    undefined
                  }

onTestReport={
  handleTestReport
}

onReady={
  handleSandboxReady
}

onError={
  handleSandboxError
}                  

                />

              </div>
            )}

            {blueprint && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Objective
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {
                      blueprint.objective
                    }
                  </p>

                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Core Loop
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {
                      blueprint.coreLoop
                    }
                  </p>

                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Mechanics
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">

                    {blueprint.mechanics.map(
                      (
                        mechanic
                      ) => (
                        <span
                          key={
                            mechanic
                          }
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-slate-400"
                        >
                          {
                            mechanic
                          }
                        </span>
                      )
                    )}

                  </div>

                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Controls
                  </p>

                  <div className="mt-3 space-y-1.5">

                    {blueprint.controls.map(
                      (
                        control
                      ) => (
                        <p
                          key={
                            control
                          }
                          className="text-xs text-slate-400"
                        >
                          •{" "}
                          {
                            control
                          }
                        </p>
                      )
                    )}

                  </div>

                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Win Condition
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {
                      blueprint.winCondition
                    }
                  </p>

                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

                  <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
                    Lose Condition
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {
                      blueprint.loseCondition
                    }
                  </p>

                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:col-span-2">

                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Replayability
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {
                      blueprint.replayability
                    }
                  </p>

                </div>

              </div>
            )}

            {seed && (
              <p className="mt-5 text-center text-xs text-slate-700">
                Session seed:{" "}
                {seed}
              </p>
            )}

            {stage ===
              "ready" && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">

                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-5 py-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  ✓ GAME READY
                </div>

                <button
                  type="button"
                  onClick={
                    createAnotherGame
                  }
                  className="rounded-xl border border-white/10 px-5 py-2 text-sm text-slate-300 transition hover:bg-white/[0.05]"
                >
                  ↻ Buat Game Lain
                </button>

              </div>
            )}

          </div>
        )}

        {stage === "error" && (
          <div className="mx-auto max-w-2xl text-center">

            <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-8 md:p-10">

              <div className="text-5xl">
                ⚠️
              </div>

              <h2 className="mt-5 text-2xl font-bold">
                Laboratory mengalami
                masalah
              </h2>

              <p className="mt-4 leading-7 text-red-100/70">
                {error ||
                  "Terjadi kesalahan saat menjalankan AI Game Laboratory."}
              </p>

              <button
                type="button"
                onClick={
                  createAnotherGame
                }
                className="mt-7 rounded-2xl bg-cyan-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                ← Coba Lagi
              </button>

            </div>
          </div>
        )}

      </section>
    </main>
  );
}