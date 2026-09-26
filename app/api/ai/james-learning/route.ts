import { NextResponse } from "next/server";
import { generateWithAllAIProviders } from "../../../fun-zone/aiRouter";
import { refreshJamesProviderCapabilities } from "../../tools/jamesProviderCapabilities";
import { getJamesGoals, saveJamesGoal } from "../../tools/jamesGoals";
import {
  addGlobalCandidate,
  getGlobalCandidates,
  activateGlobalCandidate,
  recordGlobalDecision,
} from "../../tools/jamesGlobalLearning";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request) {
  const provided = request.headers.get("authorization");
  const secrets = [
    process.env.JAMES_LEARNING_SECRET,
    process.env.CRON_SECRET,
  ].filter(Boolean).map((value) => `Bearer ${value}`);
  return Boolean(provided && secrets.includes(provided));
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
    const globalCandidates = await getGlobalCandidates(12);

    const prompt = `
James sedang menjalankan sesi pengembangan mandiri terjadwal.

Tujuan aktif:
${JSON.stringify(goals)}

Kandidat pembelajaran global yang belum tervalidasi:
${JSON.stringify(globalCandidates)}

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
  ],
  "global_candidates": [
    {
      "category": "communication_style | learned_topic | lesson | preference",
      "key": "kunci",
      "value": "pola pembelajaran umum",
      "rationale": "alasan tanpa data pengguna"
    }
  ],
  "global_decisions": [
    {
      "candidate_key": "kunci",
      "decision": "support | reject | uncertain",
      "confidence": 0.0,
      "rationale": "alasan"
    }
  ]
}

Aturan:
- Maksimal 3 goal baru.
- Maksimal 3 global candidate.
- Global candidate hanya boleh berupa pola pembelajaran umum, bukan data, kutipan, identitas, kebiasaan unik, atau informasi sensitif pengguna.
- Jangan membuat global candidate dari satu pengguna saja sebagai fakta umum.
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

    
    const globalCandidateMap = new Map<string, { category: string; key: string; value: string; rationale: string }>();
    for (const result of proposals) {
      const items = Array.isArray(result.data.global_candidates) ? result.data.global_candidates : [];
      for (const raw of items) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        const category = typeof item.category === "string" ? item.category.trim() : "";
        const key = typeof item.key === "string" ? item.key.trim().slice(0, 80) : "";
        const value = typeof item.value === "string" ? item.value.trim().slice(0, 240) : "";
        const rationale = typeof item.rationale === "string" ? item.rationale.trim().slice(0, 400) : "";
        if (!category || !key || !value) continue;
        const id = category.toLowerCase() + ":" + key.toLowerCase() + ":" + value.toLowerCase();
        if (!globalCandidateMap.has(id)) globalCandidateMap.set(id, { category, key, value, rationale });
      }
    }

    for (const candidate of [...globalCandidateMap.values()].slice(0, 3)) {
      const row = await addGlobalCandidate({
        category: candidate.category,
        key: candidate.key,
        value: candidate.value,
        rationale: candidate.rationale,
        evidenceCount: 1,
      });
      if (row) {
        for (const result of proposals) {
          const decisions = Array.isArray(result.data.global_decisions) ? result.data.global_decisions : [];
          const decision = decisions.find((raw: any) =>
            raw && typeof raw === "object" &&
            String(raw.candidate_key || "").toLowerCase() === candidate.key.toLowerCase()
          );
          if (!decision) continue;
          const d = decision as Record<string, unknown>;
          const choice = d.decision === "support" || d.decision === "reject" || d.decision === "uncertain"
            ? d.decision : "uncertain";
          const confidence = typeof d.confidence === "number"
            ? Math.max(0, Math.min(1, d.confidence)) : 0;
          await recordGlobalDecision({
            candidateId: row.id,
            provider: result.provider,
            decision: choice,
            confidence,
            rationale: typeof d.rationale === "string" ? d.rationale.slice(0, 400) : "",
          });
        }
      }
    }

    const refreshedCandidates = await getGlobalCandidates(20);
    for (const candidate of refreshedCandidates) {
      const decisions = await getGlobalDecisions(candidate.id);
      const strongSupport = decisions.filter((item: any) => item.decision === "support" && item.confidence >= 0.75).length;
      const strongReject = decisions.filter((item: any) => item.decision === "reject" && item.confidence >= 0.75).length;
      if (strongSupport >= 2 && strongReject === 0) {
        await activateGlobalCandidate(candidate.id, strongSupport / Math.max(decisions.length, 1), "Validated by multiple AI providers.");
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


export async function GET(request: Request) {
  return POST(request);
}

async function getGlobalDecisions(candidateId: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const { data } = await supabase
    .from("james_global_learning_runs")
    .select("provider, decision, confidence, rationale")
    .eq("candidate_id", candidateId);
  return data || [];
}
