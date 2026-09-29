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
  LabSession,
  TestReport,
} from "./laboratory/types";

type LabStage =
  | "idle"
  | "understanding"
  | "designing"
  | "building"
  | "testing"
  | "debugging"
  | "retesting"
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

function normalizeErrorMessage(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Error && value.message) return value.message;
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "details"]) {
      const nested = candidate[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
      if (nested && typeof nested === "object") {
        const nestedMessage = normalizeErrorMessage(nested);
        if (nestedMessage) return nestedMessage;
      }
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "Objek error tidak dapat dibaca.";
    }
  }
  return String(value || "Terjadi kesalahan yang tidak diketahui.");
}

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
    id: "debugging",
    label: "AI Debugging",
  },
  {
    id: "retesting",
    label: "Retesting game",
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

    case "debugging":
      return 88;

    case "retesting":
      return 94;

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

    case "debugging":
      return "AI Debugger sedang menganalisis kegagalan dan memperbaiki Game Artifact.";

    case "retesting":
      return "Game hasil perbaikan sedang dijalankan kembali untuk verifikasi.";

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
          `[DESIGN] Mechanics: ${(Array.isArray(blueprint.mechanics) ? blueprint.mechanics : []).join(
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
    stage === "debugging" ||
    stage === "retesting" ||
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

  const [autonomousRepairAttempts, setAutonomousRepairAttempts] =
    useState(0);

  const [labSession, setLabSession] =
    useState<LabSession | null>(null);

  const [savedLabSession, setSavedLabSession] =
    useState<LabSession | null>(null);

  const [savedGameHtml, setSavedGameHtml] =
    useState("");

  const [experimentId, setExperimentId] =
    useState<string | null>(null);

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
    const params = new URLSearchParams(window.location.search);
    const id = params.get("experimentId");

    if (!id && params.get("autonomous") === "1") {
      fetch("/api/fun-zone/experiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
        .then((response) => response.json())
        .then((data) => {
          if (!data?.success || !data?.experimentId) return;
          window.history.replaceState(
            {},
            "",
            "/fun-zone?experimentId=" + encodeURIComponent(data.experimentId),
          );
          setExperimentId(data.experimentId);
          setBlueprint(data.blueprint as GameBlueprint);
          setGameHtml(data.gameHtml || "");
          setTitle(data.blueprint?.title || "James Experiment");
          setGenre(data.blueprint?.genre || "AI Game");
          setProvider(data.provider || "james-autonomous");
          setModel(data.model || "game-brain-experiment-v1");
          setStage("testing");
        })
        .catch((error) => {
          console.warn("James autonomous experiment bootstrap failed:", error);
        });
      return;
    }

    if (!id) return;
    if (!id) return;

    setExperimentId(id);

    fetch("/api/fun-zone/experiment?experimentId=" + encodeURIComponent(id), { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const experiment = data?.experiment;
        if (!experiment?.game_html || !experiment?.blueprint) return;

        setBlueprint(experiment.blueprint as GameBlueprint);
        setGameHtml(experiment.game_html);
        setTitle(experiment.blueprint.title || "James Experiment");
        setGenre(experiment.blueprint.genre || "AI Game");
        setProvider("james-autonomous");
        setModel("game-brain-experiment-v1");
        setStage("testing");
      })
      .catch((error) => {
        console.warn("James experiment load failed:", error);
      });
  }, []);

  useEffect(() => {
    fetch("/api/fun-zone/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const saved = data?.session?.session;
        if (!saved) return;
        setSavedLabSession(saved);
        setSavedGameHtml(data?.session?.gameHtml || "");
      })
      .catch(() => {});
  }, []);

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

  async function persistLabSession(session: LabSession, html?: string) {
    try {
      await fetch("/api/fun-zone/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labSession: session,
          ...(typeof html === "string" ? { gameHtml: html } : {}),
        }),
      });
    } catch {
      // Cloud persistence must never block gameplay.
    }
  }

  async function buildGame(promptOverride?: string) {
    const trimmedPrompt =
      (promptOverride ?? prompt).trim();

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
    setAutonomousRepairAttempts(0);
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

      const cloudSession = data.session as LabSession;
      setLabSession(cloudSession);
      void persistLabSession(cloudSession, data.gameHtml);

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
    async (report: TestReport) => {
      setTestReport(report);

      // Learning is deliberately fire-and-forget: a learning persistence issue
      // must never turn a playable/testable game into a laboratory failure.
      if (blueprint) {
        void fetch("/api/fun-zone/learning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprint,
            report,
            attempt: report.attempt,
          }),
        }).catch((error) => {
          console.warn("James Game Brain learning request failed:", error);
        });
      }

      if (experimentId && blueprint) {
        void fetch("/api/fun-zone/experiment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experimentId, blueprint, report }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (!data?.success) {
              console.warn("James experiment verification failed:", data?.error);
            }
          })
          .catch((error) => {
            console.warn("James experiment verification request failed:", error);
          });
      }

      if (report.passed) {
        setError("");
        setStage("ready");

        setLabSession((previous) => {
          if (!previous) return previous;
          const next: LabSession = {
            ...previous,
            status: "ready",
            stage: "final",
            testReports: [...previous.testReports, report],
            currentAttempt: report.attempt,
            updatedAt: new Date().toISOString(),
            error: undefined,
          };
          void persistLabSession(next);
          return next;
        });
        return;
      }

      const nextRepairAttempt = autonomousRepairAttempts + 1;

      setLabSession((previous) => {
        if (!previous) return previous;

        const next: LabSession = {
          ...previous,
          status: nextRepairAttempt <= 3 ? "repairing" : "debugging",
          stage: nextRepairAttempt <= 3 ? "debugger" : "debugger",
          testReports: [...previous.testReports, report],
          currentAttempt: nextRepairAttempt,
          updatedAt: new Date().toISOString(),
          error: (Array.isArray(report.hardFailures) ? report.hardFailures : []).join(" ") || previous.error,
        };

        void persistLabSession(next);
        return next;
      });

      if (nextRepairAttempt > 3 || !blueprint) {
        setStage("debugging");
        setError(
          (Array.isArray(report.hardFailures) ? report.hardFailures : []).join(" ") ||
          "James membutuhkan pemeriksaan debugger lebih lanjut."
        );
        return;
      }

      setAutonomousRepairAttempts(nextRepairAttempt);
      setStage("retesting");
      setError("James menganalisis hasil test dan mengembangkan game secara mandiri...");

      try {
        const response = await fetch("/api/fun-zone/autonomous-repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprint,
            report,
            attempt: nextRepairAttempt,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data?.success || !data?.gameHtml || !data?.blueprint) {
          throw new Error(data?.error || "James Autonomous Repair gagal.");
        }

        setBlueprint(data.blueprint);
        setTitle(data.blueprint.title);
        setGenre(data.blueprint.genre);
        setProvider(data.provider || "james-autonomous");
        setModel(data.model || "autonomous-evolution-engine-v1");
        setGameHtml(data.gameHtml);
        setTestReport(null);
        setStage("testing");
        setError("");
      } catch (error) {
        setStage("debugging");
        setError(
          error instanceof Error
            ? error.message
            : "James Autonomous Repair gagal."
        );
      }
    },
    [autonomousRepairAttempts, blueprint, experimentId]
  );

const handleSandboxGameHtmlChange =
  useCallback((html: string) => {
    setGameHtml(html);

    setLabSession((previous) => {
      if (!previous) return previous;

      void persistLabSession(previous, html);
      return previous;
    });
  }, []);  

  function resumeSavedGame() {
    if (!savedLabSession) return;
    setLabSession(savedLabSession);
    setPrompt(savedLabSession.prompt || "");
    setSeed(savedLabSession.seed || "");
    setBlueprint(savedLabSession.blueprint || null);
    setGameHtml(savedGameHtml || "");
    setTitle(savedLabSession.artifact?.title || savedLabSession.blueprint?.title || "");
    setGenre(savedLabSession.artifact?.genre || savedLabSession.blueprint?.genre || "");
    setProvider(savedLabSession.artifact?.provider || "");
    setModel(savedLabSession.artifact?.model || "");
    setTestReport(Array.isArray(savedLabSession.testReports) && savedLabSession.testReports.length ? savedLabSession.testReports[savedLabSession.testReports.length - 1] : null);
    setError(savedLabSession.error || "");
    if (savedLabSession.status === "ready") setStage("ready");
    else if (savedLabSession.status === "failed") setStage("error");
    else if (savedLabSession.stage === "tester") setStage("testing");
    else if (savedLabSession.stage === "debugger") setStage("debugging");
    else if (savedLabSession.stage === "builder") setStage("building");
    else if (savedLabSession.stage === "director") setStage("designing");
    else setStage(savedGameHtml ? "testing" : "idle");
  }


  function createAnotherGame() {
    setExperimentId(null);
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

const handleSandboxDebugging =
  useCallback((active: boolean) => {
    setStage(active ? "debugging" : "retesting");
  }, []);

const handleSandboxError =
  useCallback((message: string) => {
    setError(message);
    setStage("error");
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
                di pikiranmu. James akan
                memahami ide tersebut,
                membuat blueprint secara mandiri,
                mengompilasi game, menguji,
                dan terus memperbaikinya.
              </p>

            </div>

            <div className="mx-auto mt-10 max-w-4xl">
              <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.035] p-6 text-center md:p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-2xl">✦</div>
                <h2 className="mt-5 text-2xl font-black md:text-3xl">Bicara langsung dengan James</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                  Tidak ada daftar genre yang harus kamu pilih. Tulis saja game yang kamu bayangkan,
                  bahkan jika idenya belum lengkap. James akan memahami maksudmu, menentukan desain game,
                  memilih mekanik yang sesuai, lalu membangunnya dengan James Autonomous Brain. Provider AI hanya menjadi peningkat opsional, bukan ketergantungan.
                </p>
              </div>
            </div>

            <div className="mx-auto mt-12 max-w-4xl">

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-cyan-950/20 md:p-6">

                {savedLabSession && savedGameHtml && (
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">Game terakhir tersimpan</p>
                      <p className="mt-1 text-sm text-slate-400">{savedLabSession.artifact?.title || savedLabSession.blueprint?.title || "AI Game"}</p>
                    </div>
                    <button type="button" onClick={resumeSavedGame} className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20">Lanjutkan</button>
                  </div>
                )}

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
                  placeholder="Ceritakan game yang ada di pikiranmu. Contoh: Aku ingin game tentang penyelamatan di laut saat badai, dengan kapal yang harus mencari korban dan kembali ke pelabuhan. Kamu boleh menulis ide sederhana atau sangat detail."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base leading-7 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />

                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">

                  <span>
                    Bebas. Tulis dengan bahasamu sendiri. James akan menentukan genre, mekanik, kontrol, dunia, objective, dan cara terbaik untuk membangunnya.
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
                  onClick={() => {
                    void buildGame();
                  }}
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
                  Mengubah blueprint menjadi dunia,
                  mekanik, aturan, visual, dan
                  game playable tanpa provider.
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

onDebuggingChange={
  handleSandboxDebugging
}

onGameHtmlChange={
  handleSandboxGameHtmlChange
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

                    {(Array.isArray(blueprint.mechanics) ? blueprint.mechanics : []).map(
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

                    {(Array.isArray(blueprint.controls) ? blueprint.controls : []).map(
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