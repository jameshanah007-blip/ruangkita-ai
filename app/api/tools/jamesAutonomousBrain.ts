import { createClient } from "@supabase/supabase-js";
import { runJamesAgentLoop, type JamesAgentResult } from "./jamesAgentLoop";
import { planJamesIntelligenceWithAI } from "./jamesIntelligence";
import { evaluateJamesTask } from "./jamesSelfEvaluation";
import { learnJamesExperience } from "./jamesExperience";
import { learnJamesMetaStrategy } from "./jamesMetaLearning";
import { detectJamesImprovementGoal, evolveJamesImprovementGoal } from "./jamesImprovementEngine";
import { decideJamesBrainStrategy } from "./jamesDecisionEngine";
import { decideJamesModelLearning } from "./jamesModelLearningPolicy";
import { distillJamesKnowledge, startJamesModelAdaptation } from "./jamesModelLearning";
import { createJamesAutonomousGoal } from "./jamesAutonomousGoals";

export type JamesAutonomyMode = "supervised" | "bounded" | "autonomous";

export type JamesBrainStatus =
  | "idle"
  | "observing"
  | "thinking"
  | "acting"
  | "verifying"
  | "learning"
  | "evolving"
  | "blocked"
  | "completed"
  | "failed";

export type JamesBrainCycle = {
  cycle: number;
  status: JamesBrainStatus;
  decision: string;
  confidence: number;
  verified: boolean;
  taskId: string | null;
  answer: string;
  evolutionProposalId?: string | null;
  evolutionStatus?: string | null;
  modelLearningJobId?: string | null;
  modelLearningStatus?: string | null;
  adaptedProvider?: string | null;
};

export type JamesAutonomousBrainResult = {
  goal: string;
  mode: JamesAutonomyMode;
  status: JamesBrainStatus;
  cycles: JamesBrainCycle[];
  answer: string;
  verified: boolean;
  nextAction: string;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function updateBrainState(
  userId: string,
  patch: Record<string, unknown>,
) {
  const client = db();
  if (!client) return;

  await client.from("james_autonomous_brain_state").upsert(
    {
      user_id: userId,
      ...patch,
      last_cycle_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

function boundedText(value: string, max = 6000) {
  return value.length > max ? value.slice(0, max) + "..." : value;
}

function shouldProposeEvolution(
  mode: JamesAutonomyMode,
  verified: boolean,
  cycle: JamesBrainCycle,
) {
  if (!verified || mode === "supervised") return false;
  return (
    cycle.confidence < 0.72 ||
    cycle.decision.includes("gap") ||
    cycle.decision.includes("failure")
  );
}

export async function runJamesAutonomousBrain(input: {
  userId: string;
  conversationId: string;
  goal: string;
  mode?: JamesAutonomyMode;
  maxCycles?: number;
  conversationContext?: string;
  allowCodeEvolution?: boolean;
}): Promise<JamesAutonomousBrainResult> {
  const mode = input.mode || "bounded";
  const maxCycles = Math.min(Math.max(input.maxCycles || 2, 1), mode === "autonomous" ? 5 : 3);
  const cycles: JamesBrainCycle[] = [];

  await updateBrainState(input.userId, {
    autonomy_mode: mode,
    status: "observing",
    current_goal: input.goal,
    last_error: null,
  });

  let workingGoal = input.goal;
  let answer = "";
  let verified = false;
  let finalStatus: JamesBrainStatus = "failed";

  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    await updateBrainState(input.userId, {
      autonomy_mode: mode,
      status: "thinking",
      current_goal: workingGoal,
      cycle_count: cycle,
    });

    const brainDecision = await decideJamesBrainStrategy("planning");

    const plan = await planJamesIntelligenceWithAI(
      workingGoal,
      [
        input.conversationContext || "",
        "AUTONOMOUS BRAIN CYCLE: " + cycle,
        "MODE: " + mode,
        "GOAL:",
        workingGoal,
        "BRAIN DECISION:",
        JSON.stringify({
          strategy: brainDecision.strategy,
          rankedProviders: brainDecision.rankedProviders,
          confidence: brainDecision.confidence,
          evidenceCount: brainDecision.evidenceCount,
          reason: brainDecision.reason,
        }),
        "Gunakan decision di atas sebagai evidence, bukan sebagai kebenaran mutlak.",
        "James harus menentukan langkah yang paling berguna berikutnya.",
        "Jangan melakukan tindakan di luar capability yang tersedia.",
      ].join("\n\n"),
    );

    const decision =
      plan.confidence >= 0.78
        ? "execute-plan"
        : plan.confidence >= 0.55
          ? "execute-with-verification"
          : "gap-detected-replan";

    const decisionLabel =
      decision + " | brain-strategy:" + brainDecision.strategy;

    const cycleRecord: JamesBrainCycle = {
      cycle,
      status: "acting",
      decision: decisionLabel,
      confidence: plan.confidence,
      verified: false,
      taskId: null,
      answer: "",
    };

    await updateBrainState(input.userId, {
      status: "acting",
      last_decision: decisionLabel,
      last_confidence: plan.confidence,
    });

    try {
      const agent: JamesAgentResult = await runJamesAgentLoop({
        request: workingGoal,
        initialPlan: plan,
        conversationContext: input.conversationContext,
        userId: input.userId,
        conversationId: input.conversationId,
        resume: true,
      });

      cycleRecord.status = "verifying";
      cycleRecord.verified = agent.verified;
      cycleRecord.taskId = agent.taskId;
      cycleRecord.answer = boundedText(agent.answer || "");
      answer = agent.answer || answer;
      verified = agent.verified;

      await updateBrainState(input.userId, {
        status: "verifying",
        current_task_id: agent.taskId,
        last_confidence: agent.verified ? Math.max(plan.confidence, 0.8) : plan.confidence,
      });

      if (agent.taskId) {
        const evaluation = await evaluateJamesTask({
          userId: input.userId,
          conversationId: input.conversationId,
          taskId: agent.taskId,
          request: workingGoal,
          result: agent,
        });

        if (evaluation) {
          cycleRecord.decision +=
            " | evaluation:" + evaluation.outcome;

          if (evaluation.outcome === "success") {
            verified = true;
          }
        }

        if (agent.verified) {
          const task = agent.taskId
            ? await import("./jamesAgentState").then((mod) =>
                mod.getJamesAgentTask(agent.taskId || "")
              )
            : null;

          if (task) {
            await updateBrainState(input.userId, {
              status: "learning",
            });

            const experience = await learnJamesExperience({
              userId: input.userId,
              conversationId: input.conversationId,
              taskId: agent.taskId,
              request: workingGoal,
              actions: task.actions,
              verified: agent.verified,
            });

            if (experience) {
              await learnJamesMetaStrategy({
                pattern: experience.pattern,
                strategy: experience.strategy,
                capabilities: Array.isArray(experience.capabilities)
                  ? experience.capabilities
                  : [],
                verified: agent.verified,
              });
            }
          }
        }
      }

      if (mode === "autonomous" && agent.verified) {
        const modelLearning = await decideJamesModelLearning({
          userId: input.userId,
          confidence: plan.confidence,
          evidenceCount: brainDecision.evidenceCount,
          verified: agent.verified,
          autonomous: true,
        });

        cycleRecord.decision +=
          " | model-learning:" + (modelLearning.shouldDistill ? "distill" : "wait");

        if (modelLearning.shouldDistill && modelLearning.teacherProviders.length) {
          await updateBrainState(input.userId, {
            status: "learning",
            last_decision: cycleRecord.decision,
          });

          const teachingPrompts = [
            workingGoal,
            "Jelaskan kembali solusi untuk tujuan berikut dengan pendekatan yang lebih robust dan praktis:\n" + workingGoal,
            "Berikan solusi alternatif yang dapat diuji untuk tujuan berikut. Fokus pada hasil final, bukan reasoning internal:\n" + workingGoal,
            "Apa jawaban/implementasi yang paling dapat dipelajari James dari tujuan berikut? Berikan hasil final yang dapat diverifikasi:\n" + workingGoal,
          ];

          const distilled = await distillJamesKnowledge({
            userId: input.userId,
            prompts: teachingPrompts,
            teacherProviders: modelLearning.teacherProviders,
            systemInstruction:
              "James sedang membangun capability internal dari output final beberapa provider. Jangan keluarkan chain-of-thought. Berikan jawaban final yang dapat diuji dan dipelajari.",
            task: "learning",
          });

          cycleRecord.modelLearningJobId = distilled.jobId;
          cycleRecord.modelLearningStatus =
            distilled.sampleCount > 0 ? "dataset_ready" : "failed";

          if (
            modelLearning.shouldAdapt &&
            distilled.jobId &&
            modelLearning.targetProvider &&
            modelLearning.baseModel
          ) {
            const adapted = await startJamesModelAdaptation({
              userId: input.userId,
              distillationJobId: distilled.jobId,
              targetProvider: modelLearning.targetProvider,
              baseModel: modelLearning.baseModel,
            });

            cycleRecord.modelLearningJobId = adapted.jobId;
            cycleRecord.modelLearningStatus = adapted.status;
            cycleRecord.adaptedProvider = adapted.provider;
            cycleRecord.decision +=
              " | adaptation:" + adapted.provider;
          }
        }
      }

      if (
        input.allowCodeEvolution &&
        shouldProposeEvolution(mode, agent.verified, cycleRecord)
      ) {
        await updateBrainState(input.userId, {
          status: "evolving",
        });

        const improvementGoal = await detectJamesImprovementGoal({
          userId: input.userId,
          conversationId: input.conversationId,
          request: workingGoal,
          result: agent,
        });

        if (improvementGoal?.id) {
          const evolved = await evolveJamesImprovementGoal({
            userId: input.userId,
            conversationId: input.conversationId,
            improvementGoalId: improvementGoal.id,
          });

          cycleRecord.evolutionProposalId = evolved?.evolution_proposal_id || null;
          cycleRecord.evolutionStatus = evolved?.status || "proposed";
          cycleRecord.decision += " | improvement-goal:" + improvementGoal.id;
        }
      }

      cycles.push(cycleRecord);

      if (verified) {
        finalStatus = "completed";
        break;
      }

      if (cycle < maxCycles) {
        finalStatus = "thinking";
        workingGoal =
          [
            workingGoal,
            "",
            "HASIL SIKLUS TERAKHIR:",
            boundedText(JSON.stringify(cycleRecord), 4500),
            "",
            "Tugas berikutnya: perbaiki gap yang ditemukan, jangan mengulang langkah yang sudah gagal tanpa perubahan.",
          ].join("\n");
      }
    } catch (error) {
      cycleRecord.status = "failed";
      cycleRecord.decision += " | failure";
      cycleRecord.answer = error instanceof Error ? error.message : String(error);
      cycles.push(cycleRecord);

      await updateBrainState(input.userId, {
        status: "failed",
        failed_cycles: cycle,
        last_error: cycleRecord.answer,
      });

      if (cycle >= maxCycles) break;

      workingGoal = [
        workingGoal,
        "",
        "RECOVERY:",
        "Siklus sebelumnya gagal. Identifikasi penyebab yang mungkin, ubah pendekatan, lalu coba lagi dengan langkah yang lebih aman.",
      ].join("\n");
    }
  }

  const successfulCycles = cycles.filter((item) => item.verified).length;

  await updateBrainState(input.userId, {
    status: finalStatus,
    successful_cycles: successfulCycles,
    failed_cycles: cycles.filter((item) => item.status === "failed").length,
    last_confidence: cycles.at(-1)?.confidence || 0,
    last_decision: cycles.at(-1)?.decision || "none",
  });

  // In autonomous mode, a successful cycle schedules the next maintenance
  // cycle automatically. This removes the need for a human to repeatedly
  // issue "learn/clone" commands while keeping the cadence bounded by the
  // hourly heartbeat.
  if (mode === "autonomous" && verified) {
    const nextRun = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    try {
      await createJamesAutonomousGoal({
        userId: input.userId,
        conversationId: input.conversationId,
        title: "James Autonomous Learning Cycle",
        goal: [
          "Continue autonomous self-improvement for James.",
          "Review the latest verified experience and provider evidence.",
          "Distill useful knowledge from Gemini, OpenAI, OpenRouter, and Groq when the model-learning policy allows it.",
          "Evaluate whether a provider-supported model adaptation is justified.",
          "Do not copy proprietary model weights, secrets, credentials, or protected internals.",
          "Do not deploy an adapted model as the default until it has been validated.",
        ].join("\n"),
        priority: 60,
        maxCycles: 2,
        nextRunAt: nextRun,
      });
    } catch (error) {
      console.warn(
        "James autonomous continuation could not be scheduled:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return {
    goal: input.goal,
    mode,
    status: finalStatus,
    cycles,
    answer,
    verified,
    nextAction: verified
      ? "Gunakan hasil yang tervalidasi dan simpan pembelajaran."
      : cycles.length >= maxCycles
        ? "Hentikan siklus, simpan kegagalan, dan tunggu intervensi atau trigger berikutnya."
        : "Lanjutkan dengan re-planning.",
  };
}
