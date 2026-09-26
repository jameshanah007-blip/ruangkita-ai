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
    (item) => item.capability === "web_search" && item.text.includes("RESEARCH_STATUS: VERIFIED")
  );

  return generateWithJamesResourceManager("reasoning", {
    prompt: [
      "Kamu adalah James dan sedang menyelesaikan tugas multi-langkah.",
      "",
      "PERMINTAAN PENGGUNA:",
      request,
      "",
      "RENCANA AKTIF:",
      JSON.stringify(plan),
      "",
      "HASIL CAPABILITY YANG SUDAH DIJALANKAN:",
      compact(toolContext),
      "",
      "KONTEKS PERCAKAPAN:",
      compact(conversationContext, 3500),
      "",
      "RESEARCH VERIFIED: " + (researchVerified ? "YA" : "TIDAK"),
      "",
      "Aturan:",
      "- Gunakan hasil capability sebagai sumber kerja utama.",
      "- Jika research tidak verified, jangan menyebut fakta terkini sebagai sudah terverifikasi.",
      "- Jangan membuat URL atau fakta yang tidak tersedia dalam hasil capability.",
      "- Jika tugas meminta dokumen/rencana, hasilkan langsung dalam bentuk siap pakai.",
      "- Jangan tampilkan reasoning internal, metadata provider, status tool, atau label safety.",
      "- Jawab langsung kepada pengguna dalam bahasa Indonesia yang natural."
    ].join("\n"),
    systemInstruction:
      "Kamu adalah execution synthesizer James. Selesaikan tugas berdasarkan hasil tool yang nyata. Jangan mengarang tool result atau fakta eksternal.",
    temperature: 0.35,
    maxOutputTokens: 4000,
  });
}

export async function runJamesAgentLoop(input: {
  request: string;
  initialPlan: JamesIntelligencePlan;
  conversationContext?: string;
}): Promise<JamesAgentResult> {
  const steps: JamesAgentStep[] = [];
  let plan = input.initialPlan;
  let allCapabilityResults: JamesCapabilityResult[] = [];
  let lastExecutionContext = "";
  let lastAnswer = "";

  steps.push({
    iteration: 1,
    stage: "understand",
    status: "completed",
    detail: "Permintaan dan percakapan tersedia sebagai konteks agent.",
  });

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    steps.push({
      iteration,
      stage: "plan",
      status: "completed",
      detail:
        plan.planningMode +
        " planning, confidence " +
        plan.confidence.toFixed(2) +
        ", capabilities: " +
        plan.capabilities.join(", ") +
        ".",
    });

    let capabilityResults: JamesCapabilityResult[] = [];
    try {
      capabilityResults = await executeJamesCapabilities(plan, input.request);
      allCapabilityResults = allCapabilityResults.concat(capabilityResults);
      lastExecutionContext = buildExecutionContext(capabilityResults);
      steps.push({
        iteration,
        stage: "execute",
        status: "completed",
        detail: capabilityResults.length + " capability selesai dijalankan.",
      });
    } catch (error) {
      lastExecutionContext = error instanceof Error ? error.message : String(error);
      steps.push({
        iteration,
        stage: "execute",
        status: "failed",
        detail: lastExecutionContext,
      });
    }

    try {
      const synthesis = await synthesize(
        input.request,
        plan,
        capabilityResults,
        input.conversationContext || "(tidak ada)",
      );
      lastAnswer = synthesis.text.trim();
      steps.push({
        iteration,
        stage: "synthesize",
        status: lastAnswer ? "completed" : "failed",
        detail: lastAnswer
          ? "Draft jawaban berhasil dibuat."
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

      if (verification.steps.length) {
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
      }

      if (verification.verified && verification.answer) {
        const citations = allCapabilityResults.flatMap((item) => item.citations || []);
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
          recovered: false,
          plan,
          capabilityResults: allCapabilityResults,
          citations,
          steps,
        };
      }
    }

    if (iteration < MAX_ITERATIONS) {
      steps.push({
        iteration,
        stage: "replan",
        status: "completed",
        detail: "Hasil belum tervalidasi; agent meminta rencana baru berdasarkan gap yang ditemukan.",
      });

      try {
        plan = await planJamesIntelligenceWithAI(
          input.request,
          [
            input.conversationContext || "",
            "HASIL ITERASI TERAKHIR:",
            compact(lastExecutionContext),
            "DRAFT TERAKHIR:",
            compact(lastAnswer, 3500),
            "Rencanakan langkah berikutnya hanya jika diperlukan. Jangan mengulang capability yang sudah cukup kecuali ada alasan.",
          ].join("\n\n"),
        );
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
    failedContext: lastExecutionContext + "\n\nDRAFT TERAKHIR:\n" + lastAnswer,
    conversationContext: input.conversationContext,
  });

  steps.push({
    iteration: MAX_ITERATIONS,
    stage: "recover",
    status: recovery.verified && recovery.answer ? "completed" : "failed",
    detail:
      recovery.verified && recovery.answer
        ? "Recovery menghasilkan jawaban yang dapat digunakan."
        : "Recovery tidak menghasilkan jawaban yang dapat digunakan.",
  });

  const citations = allCapabilityResults.flatMap((item) => item.citations || []);

  return {
    answer: recovery.answer || lastAnswer,
    verified: Boolean(recovery.answer || lastAnswer),
    iterations: MAX_ITERATIONS,
    recovered: true,
    plan,
    capabilityResults: allCapabilityResults,
    citations,
    steps,
  };
}
