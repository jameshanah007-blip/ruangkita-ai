import {
  generateWithJamesResourceManager,
  type JamesResourceTask,
} from "./jamesResourceManager";
import type { JamesIntelligencePlan } from "./jamesIntelligence";

export type JamesCognitiveStep = {
  stage: "understand" | "plan" | "execute" | "verify" | "replan";
  status: "completed" | "failed" | "skipped";
  detail: string;
};

export type JamesCognitiveResult = {
  answer: string;
  verified: boolean;
  steps: JamesCognitiveStep[];
  recoveryUsed: boolean;
  provider?: { provider: string; model: string; task: JamesResourceTask; latencyMs: number };
};

function taskForPlan(plan: JamesIntelligencePlan): JamesResourceTask {
  if (plan.primary === "web_search") return "research";
  if (plan.primary === "planner") return "planning";
  if (plan.primary === "document") return "reasoning";
  return "reasoning";
}

function compact(value: string, max = 6000) {
  return value.length > max ? value.slice(0, max) + "..." : value;
}

export async function runJamesCognitiveVerification(input: {
  request: string;
  plan: JamesIntelligencePlan;
  executionContext: string;
  conversationContext?: string;
}): Promise<JamesCognitiveResult> {
  const steps: JamesCognitiveStep[] = [
    {
      stage: "understand",
      status: "completed",
      detail: "Permintaan sudah dipahami dan konteks percakapan tersedia.",
    },
    {
      stage: "plan",
      status: "completed",
      detail: `Plan ${input.plan.planningMode} dengan confidence ${input.plan.confidence.toFixed(2)}.`,
    },
  ];

  const verificationPrompt = `
Kamu adalah verification engine milik James.

TUGAS PENGGUNA:
${input.request}

RENCANA:
${JSON.stringify(input.plan)}

HASIL EKSEKUSI:
${compact(input.executionContext)}

KONTEKS:
${compact(input.conversationContext || "(tidak ada)", 3000)}

Periksa apakah hasil eksekusi benar-benar mendukung jawaban untuk pengguna.
Jangan mengarang fakta.
Jika hasil cukup, keluarkan:
{"verified":true,"answer":"jawaban akhir yang siap diberikan pengguna","reason":"alasan singkat"}
Jika hasil tidak cukup atau bertentangan, keluarkan:
{"verified":false,"answer":"","reason":"apa yang kurang atau salah","next_action":"retry|replan|ask_user"}

JSON SAJA.
`;

  try {
    const result = await generateWithJamesResourceManager("verification", {
      prompt: verificationPrompt,
      systemInstruction:
        "Kamu adalah verifier James. Periksa hasil kerja secara kritis. Jangan membuat fakta baru. Output JSON valid saja.",
      temperature: 0.1,
      maxOutputTokens: 1800,
    });

    const start = result.text.indexOf("{");
    const end = result.text.lastIndexOf("}");
    const parsed = start >= 0 && end > start
      ? JSON.parse(result.text.slice(start, end + 1)) as Record<string, unknown>
      : null;

    if (parsed?.verified === true && typeof parsed.answer === "string" && parsed.answer.trim()) {
      steps.push({
        stage: "execute",
        status: "completed",
        detail: "Capability berhasil dijalankan.",
      });
      steps.push({
        stage: "verify",
        status: "completed",
        detail: typeof parsed.reason === "string" ? parsed.reason : "Hasil lolos verifikasi.",
      });

      return {
        answer: parsed.answer.trim(),
        verified: true,
        steps,
        recoveryUsed: false,
        provider: { provider: result.provider, model: result.model, task: result.task, latencyMs: result.latencyMs },
      };
    }

    steps.push({
      stage: "verify",
      status: "failed",
      detail: typeof parsed?.reason === "string"
        ? parsed.reason
        : "Hasil belum dapat diverifikasi.",
    });

    return {
      answer: "",
      verified: false,
      steps,
      recoveryUsed: false,
      provider: { provider: result.provider, model: result.model, task: result.task, latencyMs: result.latencyMs },
    };
  } catch (error) {
    steps.push({
      stage: "verify",
      status: "failed",
      detail: error instanceof Error ? error.message : "Verification gagal.",
    });

    return {
      answer: "",
      verified: false,
      steps,
      recoveryUsed: false,
    };
  }
}

export async function runJamesCognitiveRecovery(input: {
  request: string;
  plan: JamesIntelligencePlan;
  failedContext: string;
  conversationContext?: string;
}): Promise<JamesCognitiveResult> {
  const steps: JamesCognitiveStep[] = [
    {
      stage: "replan",
      status: "completed",
      detail: "James masuk recovery loop karena hasil awal belum tervalidasi.",
    },
  ];

  try {
    const result = await generateWithJamesResourceManager("fallback", {
      prompt: `
Permintaan pengguna:
${input.request}

Rencana awal:
${JSON.stringify(input.plan)}

Hasil yang gagal diverifikasi:
${compact(input.failedContext)}

Konteks:
${compact(input.conversationContext || "(tidak ada)", 3000)}

Buat jawaban yang aman dan berguna tanpa mengarang.
Jika informasi memang belum cukup, katakan apa yang kurang secara singkat.
`,
      systemInstruction:
        "Kamu adalah recovery engine James. Pulihkan tugas yang gagal tanpa mengarang hasil tool atau fakta.",
      temperature: 0.2,
      maxOutputTokens: 2200,
    });

    steps.push({
      stage: "execute",
      status: "completed",
      detail: "Recovery provider berhasil menghasilkan alternatif.",
    });

    return {
      answer: result.text.trim(),
      verified: true,
      steps,
      recoveryUsed: true,
      provider: { provider: result.provider, model: result.model, task: result.task, latencyMs: result.latencyMs },
    };
  } catch (error) {
    steps.push({
      stage: "execute",
      status: "failed",
      detail: error instanceof Error ? error.message : "Recovery gagal.",
    });

    return {
      answer: "",
      verified: false,
      steps,
      recoveryUsed: true,
    };
  }
}
