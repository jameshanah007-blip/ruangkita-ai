import {
  generateWithJamesResourceManager,
  type JamesResourceResult,
} from "./jamesResourceManager";
import {
  executeJamesCapabilities,
  planJamesIntelligenceWithAI,
  type JamesCapabilityResult,
  type JamesIntelligencePlan,
} from "./jamesIntelligence";
import {
  runJamesCognitiveRecovery,
  runJamesCognitiveVerification,
} from "./jamesCognitiveLoop";
import { planJamesTaskActions, type JamesTaskAction } from "./jamesTaskPlanner";
import {
  createJamesAgentTask,
  updateJamesAgentTask,
  completeJamesAgentTask,
  failJamesAgentTask,
  getLatestJamesAgentTask,
} from "./jamesAgentState";

export type JamesAgentStage =
  | "understand"
  | "plan"
  | "execute"
  | "synthesize"
  | "verify"
  | "replan"
  | "recover"
  | "complete";

export type JamesAgentStep = {
  iteration: number;
  stage: JamesAgentStage;
  status: "completed" | "failed" | "skipped";
  detail: string;
};

export type JamesAgentResult = {
  answer: string;
  verified: boolean;
  iterations: number;
  recovered: boolean;
  plan: JamesIntelligencePlan;
  capabilityResults: JamesCapabilityResult[];
  citations: Array<{ title: string; url: string }>;
  steps: JamesAgentStep[];
  taskId: string | null;
  providerTrace: Array<{ provider: string; model: string; task: string; latencyMs: number }>;
};

const MAX_ITERATIONS = 3;

function compact(value: string, max = 7000) {
  return value.length > max ? value.slice(0, max) + "..." : value;
}

function buildExecutionContext(results: JamesCapabilityResult[]) {
  return results.length
    ? results.map((item) =>
        ["CAPABILITY: " + item.capability, item.text].join("\n")
      ).join("\n\n")
    : "Tidak ada hasil capability eksternal.";
}

async function synthesize(
  request: string,
  plan: JamesIntelligencePlan,
  capabilityResults: JamesCapabilityResult[],
  conversationContext: string,
): Promise<JamesResourceResult> {
  const toolContext = buildExecutionContext(capabilityResults);
  const researchVerified = capabilityResults.some(
    (item) =>
      item.capability === "web_search" &&
      item.text.includes("RESEARCH_STATUS: VERIFIED")
  );

  return generateWithJamesResourceManager("reasoning", {
    prompt: [
      "Kamu adalah James dan sedang menyelesaikan tugas multi-langkah.",
      "",
      "PERMINTAAN PENGGUNA:",
      request,
      "",
      "RENCANA KECERDASAN:",
      JSON.stringify(plan),
      "",
      "HASIL SUBTUGAS:",
      compact(toolContext),
      "",
      "KONTEKS PERCAKAPAN:",
      compact(conversationContext, 3500),
      "",
      "RESEARCH VERIFIED: " + (researchVerified ? "YA" : "TIDAK"),
      "",
      "Aturan:",
      "- Gunakan hasil subtugas yang benar-benar tersedia sebagai sumber kerja utama.",
      "- Jika research tidak verified, jangan menyebut fakta terkini sebagai sudah terverifikasi.",
      "- Jangan membuat URL atau fakta yang tidak tersedia dalam hasil subtugas.",
      "- Jika tugas meminta dokumen/rencana, hasilkan langsung dalam bentuk siap pakai.",
      "- Jangan tampilkan reasoning internal, metadata provider, status tool, atau label safety.",
      "- Jawab langsung kepada pengguna dalam bahasa Indonesia yang natural."
    ].join("\n"),
    systemInstruction:
      "Kamu adalah execution synthesizer James. Selesaikan tugas berdasarkan hasil subtugas yang nyata. Jangan mengarang hasil tool atau fakta eksternal.",
    temperature: 0.35,
    maxOutputTokens: 4000,
  });
}

function planFromAction(action: JamesTaskAction): JamesIntelligencePlan {
  return {
    confidence: 0.9,
    planningMode: "semantic",
    capabilities: [action.capability],
    primary: action.capability,
    researchQuery: action.capability === "web_search" ? action.input : "",
    needsResearch: action.capability === "web_search",
    needsMemory: true,
    needsExperience: true,
    reason: action.goal,
  };
}

export async function runJamesAgentLoop(input: {
  request: string;
  initialPlan: JamesIntelligencePlan;
  conversationContext?: string;
  userId?: string;
  conversationId?: string;
  resume?: boolean;
}): Promise<JamesAgentResult> {
  const steps: JamesAgentStep[] = [];
  let plan = input.initialPlan;
  let allCapabilityResults: JamesCapabilityResult[] = [];
  let lastExecutionContext = "";
  let lastAnswer = "";
  let recovered = false;

  let actions: JamesTaskAction[] = [];
  let outputs: Record<string, string> = {};
  let taskId: string | null = null;
  const providerTrace: Array<{ provider: string; model: string; task: string; latencyMs: number }> = [];

  if (input.resume && input.userId && input.conversationId) {
    const existing = await getLatestJamesAgentTask(
      input.userId,
      input.conversationId
    );

    if (existing) {
      taskId = existing.id || null;
      actions = existing.actions;
      outputs = existing.outputs;
      steps.push({
        iteration: 1,
        stage: "understand",
        status: "completed",
        detail: "Melanjutkan task aktif " + (existing.id || "") + " dari state terakhir.",
      });
    }
  }

  steps.push({
    iteration: 1,
    stage: "understand",
    status: "completed",
    detail: "Permintaan dan percakapan tersedia sebagai konteks agent.",
  });

  if (!actions.length) {
    actions = await planJamesTaskActions({
      request: input.request,
      intelligencePlan: plan,
      conversationContext: input.conversationContext,
    });

    if (!actions.length) {
      actions = plan.capabilities.map((capability, index) => ({
        id: "step-" + (index + 1),
        goal: "Menjalankan capability " + capability,
        capability,
        input: input.request,
        dependsOn: index > 0 ? ["step-" + index] : [],
        status: "pending" as const,
      }));
    }
  }

  if (!taskId && input.userId && input.conversationId) {
    taskId = await createJamesAgentTask({
      userId: input.userId,
      conversationId: input.conversationId,
      request: input.request,
      actions,
    });
  }

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    steps.push({
      iteration,
      stage: "plan",
      status: "completed",
      detail:
        plan.planningMode +
        " planning, confidence " +
        plan.confidence.toFixed(2) +
        ", subtasks: " +
        actions.length +
        ".",
    });

    let capabilityResults: JamesCapabilityResult[] = [];
    let executedThisIteration = 0;

    while (actions.some((action) => action.status === "pending")) {
      const ready = actions.filter((action) =>
        action.status === "pending" &&
        action.dependsOn.every((dependency) =>
          actions.some((item) => item.id === dependency && item.status === "completed")
        )
      );

      if (!ready.length) {
        for (const action of actions.filter((item) => item.status === "pending")) {
          action.status = "failed";
          outputs[action.id] = "Dependency cycle atau dependency yang tidak dapat diselesaikan.";
        }

        await updateJamesAgentTask(taskId, { actions, outputs });
        break;
      }

      for (const action of ready) {
        action.status = "running";
        await updateJamesAgentTask(taskId, {
          currentStep: executedThisIteration,
          actions,
          outputs,
        });

        try {
          const actionResults = await executeJamesCapabilities(
            planFromAction(action),
            action.input
          );

          capabilityResults = capabilityResults.concat(actionResults);
          outputs[action.id] = buildExecutionContext(actionResults);
          action.status = "completed";
          executedThisIteration += 1;

          steps.push({
            iteration,
            stage: "execute",
            status: "completed",
            detail: action.id + " selesai: " + action.goal,
          });
        } catch (error) {
          action.status = "failed";
          outputs[action.id] =
            error instanceof Error ? error.message : String(error);

          steps.push({
            iteration,
            stage: "execute",
            status: "failed",
            detail: action.id + " gagal: " + outputs[action.id],
          });
        }

        await updateJamesAgentTask(taskId, {
          currentStep: executedThisIteration,
          actions,
          outputs,
        });
      }
    }

    allCapabilityResults = allCapabilityResults.concat(capabilityResults);
    lastExecutionContext = [
      buildExecutionContext(capabilityResults),
      "STATE SUBTASK:",
      JSON.stringify(actions),
      "OUTPUT SUBTASK:",
      JSON.stringify(outputs),
    ].join("\n\n");

    try {
      const synthesis = await synthesize(
        input.request,
        plan,
        allCapabilityResults,
        input.conversationContext || "(tidak ada)",
      );
      lastAnswer = synthesis.text.trim();
      providerTrace.push({ provider: synthesis.provider, model: synthesis.model, task: synthesis.task, latencyMs: synthesis.latencyMs });

      steps.push({
        iteration,
        stage: "synthesize",
        status: lastAnswer ? "completed" : "failed",
        detail: lastAnswer
          ? "Draft jawaban berhasil dibuat dari hasil subtugas."
          : "Synthesis menghasilkan jawaban kosong.",
      });
    } catch (error) {
      lastAnswer = "";
      steps.push({
        iteration,
        stage: "synthesize",
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    if (lastAnswer) {
      const verification = await runJamesCognitiveVerification({
        request: input.request,
        plan,
        executionContext:
          lastExecutionContext + "\n\nDRAFT JAMES RESPONSE:\n" + lastAnswer,
        conversationContext: input.conversationContext,
      });

      for (const step of verification.steps) {
        steps.push({
          iteration,
          stage:
            step.stage === "understand" ||
            step.stage === "plan" ||
            step.stage === "execute" ||
            step.stage === "verify" ||
            step.stage === "replan"
              ? step.stage
              : "verify",
          status: step.status,
          detail: step.detail,
        });
      }

      if (verification.provider) providerTrace.push(verification.provider);

      if (verification.verified && verification.answer) {
        const citations = allCapabilityResults.flatMap((item) => item.citations || []);
        await completeJamesAgentTask(taskId, outputs);
        steps.push({
          iteration,
          stage: "complete",
          status: "completed",
          detail: "Tugas tervalidasi pada iterasi " + iteration + ".",
        });

        return {
          answer: verification.answer,
          verified: true,
          iterations: iteration,
          recovered,
          plan,
          capabilityResults: allCapabilityResults,
          citations,
          steps,
          taskId,
          providerTrace,
        };
      }
    }

    if (iteration < MAX_ITERATIONS) {
      steps.push({
        iteration,
        stage: "replan",
        status: "completed",
        detail: "James akan re-plan berdasarkan hasil dan gap subtugas.",
      });

      try {
        plan = await planJamesIntelligenceWithAI(
          input.request,
          [
            input.conversationContext || "",
            "STATE SUBTASK:",
            JSON.stringify(actions),
            "OUTPUT SUBTASK:",
            JSON.stringify(outputs),
            "HASIL ITERASI TERAKHIR:",
            compact(lastExecutionContext),
            "DRAFT TERAKHIR:",
            compact(lastAnswer, 3500),
            "Rencanakan hanya langkah yang masih diperlukan.",
          ].join("\n\n"),
        );

        const replanned = await planJamesTaskActions({
          request: input.request,
          intelligencePlan: plan,
          conversationContext: input.conversationContext,
          previousState: JSON.stringify({
            actions,
            outputs,
          }),
        });

        if (replanned.length) {
          actions = replanned;
        }
      } catch (error) {
        steps.push({
          iteration,
          stage: "replan",
          status: "failed",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const recovery = await runJamesCognitiveRecovery({
    request: input.request,
    plan,
    failedContext:
      lastExecutionContext + "\n\nDRAFT TERAKHIR:\n" + lastAnswer,
    conversationContext: input.conversationContext,
  });

  recovered = true;
  steps.push({
    iteration: MAX_ITERATIONS,
    stage: "recover",
    status: recovery.verified && recovery.answer ? "completed" : "failed",
    detail:
      recovery.verified && recovery.answer
        ? "Recovery menghasilkan jawaban yang dapat digunakan."
        : "Recovery tidak menghasilkan jawaban yang dapat digunakan.",
  });

  if (recovery.verified && recovery.answer) {
    await completeJamesAgentTask(taskId, outputs);
  } else {
    await failJamesAgentTask(taskId, outputs);
  }

  const citations = allCapabilityResults.flatMap((item) => item.citations || []);

  if (recovery.provider) providerTrace.push(recovery.provider);

  return {
    answer: recovery.answer || lastAnswer,
    verified: recovery.verified,
    iterations: MAX_ITERATIONS,
    recovered,
    plan,
    capabilityResults: allCapabilityResults,
    citations,
    steps,
    taskId,
    providerTrace,
  };
}
