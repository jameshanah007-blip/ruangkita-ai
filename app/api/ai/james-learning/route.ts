import { NextResponse } from "next/server";
import { generateWithAllAIProviders } from "../../../fun-zone/aiRouter";
import { refreshJamesProviderCapabilities } from "../../tools/jamesProviderCapabilities";
import { getJamesGoals, saveJamesGoal } from "../../tools/jamesGoals";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request) {
  const configured = process.env.JAMES_LEARNING_SECRET;
  if (!configured) return false;
  return request.headers.get("authorization") === `Bearer ${configured}`;
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const capabilities = await refreshJamesProviderCapabilities();
    const goals = await getJamesGoals(undefined, 12);

    const prompt = `
James sedang menjalankan sesi pengembangan mandiri terjadwal.

Tujuan aktif:
${JSON.stringify(goals)}

Kemampuan provider/model yang baru teramati:
${JSON.stringify(capabilities.slice(0, 80))}

Tentukan pembelajaran dan tujuan pengembangan James yang paling berguna.
Fokus pada kemampuan AI, kualitas komunikasi, kemampuan reasoning, tool use,
dan cara James menjadi lebih berguna bagi pengguna.

Keluarkan JSON SAJA:
{
  "new_goals": [
    {
      "goal": "tujuan pengembangan yang konkret",
      "reason": "mengapa penting",
      "evidence": "bukti dari capability/provider",
      "progress": 0.0
    }
  ],
  "lessons": [
    {
      "key": "kunci",
      "value": "pelajaran"
    }
  ]
}

Aturan:
- Maksimal 3 goal baru.
- Jangan membuat goal untuk memperoleh kekuasaan, uang, akses, kredensial, atau tindakan eksternal.
- Jangan mengubah core identity James.
- Jangan membuat klaim kemampuan provider yang tidak didukung data.
- Goal harus dapat dievaluasi pada sesi belajar berikutnya.
`;

    const results = await generateWithAllAIProviders({
      prompt,
      systemInstruction:
        "Kamu adalah learning strategist untuk James. Bandingkan kemampuan provider secara faktual dan hasilkan JSON valid.",
      temperature: 0.2,
      maxOutputTokens: 2500,
    });

    const proposals = results
      .map((result) => ({ provider: result.provider, data: extractJson(result.text) }))
      .filter((item) => item.data && typeof item.data === "object");

    const goalsByText = new Map<string, { goal: string; reason: string; evidence: string; progress: number }>();

    for (const result of proposals) {
      const items = Array.isArray(result.data.new_goals) ? result.data.new_goals : [];
      for (const raw of items) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        const goal = typeof item.goal === "string" ? item.goal.trim().slice(0, 500) : "";
        if (!goal) continue;
        const reason = typeof item.reason === "string" ? item.reason.trim().slice(0, 400) : "";
        const evidence = typeof item.evidence === "string" ? item.evidence.trim().slice(0, 500) : "";
        const progress = typeof item.progress === "number"
          ? Math.max(0, Math.min(1, item.progress))
          : 0;
        const key = goal.toLowerCase();
        if (!goalsByText.has(key)) goalsByText.set(key, { goal, reason, evidence, progress });
      }
    }

    const saved = [];
    for (const goal of [...goalsByText.values()].slice(0, 5)) {
      const existing = goals.some((item: any) =>
        typeof item.goal === "string" &&
        item.goal.toLowerCase() === goal.goal.toLowerCase()
      );
      if (!existing) {
        const row = await saveJamesGoal({
          user_id: null,
          goal: goal.goal,
          reason: goal.reason,
          progress: goal.progress,
          status: "active",
          evidence: goal.evidence,
        });
        if (row) saved.push(row);
      }
    }

    return NextResponse.json({
      ok: true,
      providers: [...new Set(results.map((item) => item.provider))],
      capabilityObservations: capabilities.length,
      activeGoals: goals.length + saved.length,
      newGoals: saved,
    });
  } catch (error) {
    console.error("James autonomous learning error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "James learning failed." },
      { status: 500 }
    );
  }
}
