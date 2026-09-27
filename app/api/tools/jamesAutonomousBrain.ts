import { createClient } from "@supabase/supabase-js";
import { runJamesAgentLoop, type JamesAgentResult } from "./jamesAgentLoop";
import { planJamesIntelligenceWithAI } from "./jamesIntelligence";
import { evaluateJamesTask } from "./jamesSelfEvaluation";
import { learnJamesExperience } from "./jamesExperience";
import { learnJamesMetaStrategy } from "./jamesMetaLearning";
import { detectJamesImprovementGoal, evolveJamesImprovementGoal } from "./jamesImprovementEngine";

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

    const plan = await planJamesIntelligenceWithAI(
      workingGoal,
      [
        input.conversationContext || "",
        "AUTONOMOUS BRAIN CYCLE: " + cycle,
        "MODE: " + mode,
        "GOAL:",
        workingGoal,
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

    const cycleRecord: JamesBrainCycle = {
      cycle,
      status: "acting",
      decision,
      confidence: plan.confidence,
      verified: false,
      taskId: null,
      answer: "",
    };

    await updateBrainState(input.userId, {
      status: "acting",
      last_decision: decision,
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
