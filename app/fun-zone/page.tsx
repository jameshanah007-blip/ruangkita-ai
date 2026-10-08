"use client";

import SiteNav from "../components/SiteNav";
import { useAuth } from "../components/AuthProvider";

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
  const { loading: authLoading, authenticated } = useAuth();

  const [prompt, setPrompt] =
    useState("");

  const [referenceImage, setReferenceImage] =
    useState<{ dataUrl: string; mimeType: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number } | null>(null);

  const [referenceImageError, setReferenceImageError] = useState("");


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

  const [experimentClaimToken, setExperimentClaimToken] =
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
    if (authLoading || !authenticated) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("experimentId");

    if (!id && params.get("autonomous") === "1") {
      fetch("/api/fun-zone/experiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "claim" }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (!data?.success || !data?.claimed || !data?.experimentId) return;
          setExperimentClaimToken(data.claimToken || null);
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
  }, [authLoading, authenticated]);

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
    setPrompt("");
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
              ...(referenceImage ? { referenceImage: {
                version: 1,
                available: true,
                source: "user-upload",
                mimeType: referenceImage.mimeType,
                dataUrl: referenceImage.dataUrl,
                width: referenceImage.width,
                height: referenceImage.height,
              } } : {}),
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
      let effectiveReport = report;

      if (referenceImage?.dataUrl && report.screenshot?.dataUrl) {
        try {
          const comparisonResponse = await fetch("/api/fun-zone/visual-compare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referenceImage: { dataUrl: referenceImage.dataUrl, mimeType: referenceImage.mimeType },
              screenshot: { dataUrl: report.screenshot.dataUrl, width: report.screenshot.width, height: report.screenshot.height },
              blueprint,
            }),
          });
          const comparisonData = await comparisonResponse.json();
          if (comparisonData?.success && comparisonData.comparison) {
            effectiveReport = {
              ...report,
              referenceVisualComparison: comparisonData.comparison,
              passed: report.passed && comparisonData.comparison.passed,
              softWarnings: [
                ...report.softWarnings,
                ...comparisonData.comparison.mismatches.slice(0, 5).map((item: string) => "Reference QA: " + item),
              ],
            };
            setTestReport(effectiveReport);
          }
        } catch (error) {
          console.warn("Reference visual comparison failed:", error);
        }
      }

      if (experimentId && blueprint) {
        void fetch("/api/fun-zone/experiment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experimentId, claimToken: experimentClaimToken, blueprint, report: effectiveReport }),
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

      if (effectiveReport.passed) {
        setError("");
        setStage("ready");

        setLabSession((previous) => {
          if (!previous) return previous;
          const next: LabSession = {
            ...previous,
            status: "ready",
            stage: "final",
            testReports: [...previous.testReports, effectiveReport],
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
          testReports: [...previous.testReports, effectiveReport],
          currentAttempt: nextRepairAttempt,
          updatedAt: new Date().toISOString(),
          error: (Array.isArray(effectiveReport.hardFailures) ? effectiveReport.hardFailures : []).join(" ") || previous.error,
        };

        void persistLabSession(next);
        return next;
      });

      if (nextRepairAttempt > 3 || !blueprint) {
        setStage("debugging");
        setError(
          (Array.isArray(effectiveReport.hardFailures) ? effectiveReport.hardFailures : []).join(" ") ||
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
            report: effectiveReport,
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
  }, [blueprint, experimentId, experimentClaimToken, autonomousRepairAttempts]);  

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
    setPrompt("");
    setExperimentId(null);
    setExperimentClaimToken(null);
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

  if (authLoading) {
    return <main className="min-h-screen bg-slate-950 text-white"><SiteNav /></main>;
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <SiteNav />
        <section className="flex min-h-[calc(100vh-64px)] items-center justify-center px-5">
          <div className="max-w-md text-center">
            <div className="text-5xl">🔐</div>
            <h1 className="mt-6 text-3xl font-bold">Login diperlukan</h1>
            <p className="mt-3 leading-7 text-slate-400">Masuk terlebih dahulu untuk menggunakan Fun Zone.</p>
            <a href="/auth" className="mt-7 inline-flex rounded-xl bg-cyan-400 px-7 py-3 font-semibold text-slate-950">Login ke RuangKita</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <SiteNav />


      <section className="mx-auto max-w-7xl px-6 py-10 md:py-16">

        {stage === "idle" && (
          <div className="mx-auto max-w-4xl pt-8 md:pt-16">
            <div className="text-center">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
                AI GAME LABORATORY
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-cyan-950/20 md:p-6">
              <textarea
                id="game-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={3000}
                rows={8}
                autoFocus
                placeholder="Ceritakan game yang ingin kamu buat..."
                aria-label="Permintaan pembuatan game"
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-base leading-7 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />

              <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-slate-950/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">Reference visual (opsional)</div>
                    <div className="mt-1 text-xs text-slate-500">Upload PNG, JPG, atau WebP. James akan memakai gambar ini sebagai target visual.</div>
                  </div>
                  <label className="cursor-pointer rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-400/20">
                    Pilih gambar
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={isGenerating}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setReferenceImageError("");
                        if (file.size > 6 * 1024 * 1024) {
                          setReferenceImage(null);
                          setReferenceImageError("Ukuran gambar maksimal 6 MB.");
                          return;
                        }
                        const allowed = ["image/png", "image/jpeg", "image/webp"] as const;
                        if (!allowed.includes(file.type as typeof allowed[number])) {
                          setReferenceImage(null);
                          setReferenceImageError("Format harus PNG, JPG, atau WebP.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = typeof reader.result === "string" ? reader.result : "";
                          if (!dataUrl) return;
                          const image = new Image();
                          image.onload = () => setReferenceImage({ dataUrl, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", width: image.naturalWidth, height: image.naturalHeight });
                          image.src = dataUrl;
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
                {referenceImage && (
                  <div className="mt-3 flex items-center gap-3">
                    <img src={referenceImage.dataUrl} alt="Reference visual" className="h-20 w-28 rounded-lg border border-white/10 object-cover" />
                    <div className="text-xs text-slate-400">{referenceImage.width} × {referenceImage.height}px · reference siap dianalisis</div>
                    <button type="button" className="ml-auto text-xs font-bold text-red-300" onClick={() => setReferenceImage(null)}>Hapus</button>
                  </div>
                )}
                {referenceImageError && <div className="mt-2 text-xs text-red-300">{referenceImageError}</div>}
              </div>

              <button
                type="button"
                onClick={() => {
                  void buildGame();
                }}
                disabled={isGenerating || !prompt.trim()}
                className="mt-4 w-full rounded-2xl bg-cyan-500 px-6 py-4 text-base font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGenerating ? "BUILDING..." : "BUILD MY GAME"}
              </button>
            </div>
          </div>
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

                  <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                      🔎 Test Evidence — buka untuk audit
                    </summary>

                    <div className="mt-4 grid gap-2 text-[10px] md:grid-cols-2">
                      {[
                        ["Runtime", testReport.runtimeOk],
                        ["Rendering", testReport.rendered],
                        ["Game Loop", testReport.loopStarted],
                        ["Frame Advanced", testReport.frameAdvanced],
                        ["Canvas", testReport.canvasValid],
                        ["Input", testReport.inputTest],
                        ["Gameplay", testReport.gameplayTest],
                        ["Game Test Protocol", testReport.gameTestProtocol],
                        ["State Changed", testReport.stateChanged],
                        ["Player Changed", testReport.playerChanged],
                        ["Objective Changed", testReport.objectiveChanged],
                        ["Win Detected", testReport.winStateDetected],
                        ["Lose Detected", testReport.loseStateDetected],
                        ["Restart Verified", testReport.restartVerified],
                        ["Performance", testReport.performanceTest],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                          <span className="text-slate-500">{label}</span>
                          <span className={value ? "text-emerald-400" : "text-red-300"}>
                            {value ? "PASS" : "FAIL"}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-2 text-[10px] md:grid-cols-3">
                      {[
                        ["Canvas", `${testReport.canvasWidth} × ${testReport.canvasHeight}`],
                        ["Visible Pixels", testReport.nonBlankPixels.toLocaleString()],
                        ["Game RAF", testReport.frameCount.toString()],
                        ["Animation Frames", testReport.gameAnimationFrames.toString()],
                        ["Input Events", testReport.inputEvents.toString()],
                        ["Input Listeners", testReport.inputListeners.toString()],
                        ["Elapsed", `${testReport.elapsedMs} ms`],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                          <div className="text-slate-600">{label}</div>
                          <div className="mt-1 text-slate-300">{value}</div>
                        </div>
                      ))}
                    </div>

                    {testReport.hardFailures.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                          Hard Failures ({testReport.hardFailures.length})
                        </p>
                        <div className="mt-2 space-y-2">
                          {testReport.hardFailures.map((failure, index) => (
                            <div key={index} className="rounded-lg border border-red-400/10 bg-red-400/[0.03] px-3 py-2 text-[10px] leading-4 text-red-100/80">
                              {index + 1}. {failure}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {testReport.runtimeErrors.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                          Runtime Errors ({testReport.runtimeErrors.length})
                        </p>
                        <div className="mt-2 space-y-2">
                          {testReport.runtimeErrors.map((error, index) => (
                            <div key={index} className="rounded-lg border border-red-400/10 bg-red-400/[0.03] px-3 py-2 text-[10px] leading-4 text-red-100/80">
                              {index + 1}. {error.message}
                              {error.source ? ` · ${error.source}` : ""}
                              {error.line != null ? ` · line ${error.line}` : ""}
                              {error.column != null ? ` · col ${error.column}` : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {testReport.gameTestError && (
                      <div className="mt-4 rounded-lg border border-amber-400/10 bg-amber-400/[0.03] px-3 py-2 text-[10px] leading-4 text-amber-200/80">
                        <strong>Game Test Error:</strong> {testReport.gameTestError}
                      </div>
                    )}

                    {testReport.protocolActionResults.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                          Game Test Protocol Actions
                        </p>
                        <div className="mt-2 space-y-1">
                          {testReport.protocolActionResults.map((item, index) => (
                            <div key={index} className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 text-[10px]">
                              <span className="text-slate-400">{item.action}</span>
                              <span className={item.executed ? "text-emerald-400" : "text-red-300"}>
                                {item.executed ? "EXECUTED" : "REJECTED"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {testReport.checks.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Tester Checks
                        </p>
                        <div className="mt-2 space-y-1">
                          {testReport.checks.map((check, index) => (
                            <div key={index} className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 text-[10px]">
                              <span className="text-slate-400">{check.name}</span>
                              <span className={check.status === "pass" ? "text-emerald-400" : check.status === "warning" ? "text-amber-300" : "text-red-300"}>
                                {check.status.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </details>
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