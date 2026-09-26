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

    
    const globalCandidateMap = new Map<string, { category: string; key: string; value: string; rationale: string; support: number }>();
    for (const result of proposals) {
      const items = Array.isArray(result.data.global_candidates) ? result.data.global_candidates : [];
      for (const raw of items) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        const category = typeof item.category === "string" ? item.category.trim() : "";
        const key = typeof item.key === "string" ? item.key.trim().slice(0, 80) : "";
        const value = typeof item.value === "string" ? item.value.trim().slice(0, 240) : "";
        const rationale = typeof item.rationale === "string" ? item.rationale.trim().slice(0, 400) : "";
        if (!["communication_style", "learned_topic", "lesson", "preference"].includes(category)) continue;
        if (!key || !value) continue;
        const id = category.toLowerCase() + ":" + key.toLowerCase() + ":" + value.toLowerCase();
        const existing = globalCandidateMap.get(id);
        if (existing) {
          existing.support += 1;
        } else {
          globalCandidateMap.set(id, { category, key, value, rationale, support: 1 });
        }
      }
    }

    const candidateRows = [];
    for (const candidate of [...globalCandidateMap.values()].filter((item) => item.support >= 2).slice(0, 5)) {
      const row = await addGlobalCandidate({
        category: candidate.category,
        key: candidate.key,
        value: candidate.value,
        rationale: candidate.rationale,
        evidenceCount: candidate.support,
      });
      if (row) candidateRows.push(row);
    }

    // Re-validate candidates with the provider ensemble. A learning proposal
    // never becomes active merely because the first generation agreed on it.
    const validationResults = [];
    const candidatesToValidate = (await getGlobalCandidates(20)).filter((candidate) => candidate.status === "candidate");
    for (const candidate of candidatesToValidate) {
      const validationPrompt = `Validasi kandidat pengetahuan global James berikut.

TOPIK:
${candidate.key}

PENGETAHUAN:
${candidate.value}

ALASAN:
${candidate.rationale}

Nilai apakah kandidat ini merupakan pola pembelajaran umum yang aman, jelas,
dan layak menjadi pengetahuan aktif James. Jangan gunakan data pengguna.
Jika bukti tidak cukup, pilih reject.

Keluarkan JSON SAJA:
{"decision":"activate"|"reject","confidence":0.0,"rationale":"alasan singkat"}`;

      const validatorResults = await generateWithAllAIProviders({
        prompt: validationPrompt,
        systemInstruction:
          "Kamu adalah validator independen untuk global knowledge James. Jangan mengarang fakta. Nilai hanya kandidat yang diberikan.",
        temperature: 0.1,
        maxOutputTokens: 500,
      });

      for (const validator of validatorResults) {
        const parsed = extractJson(validator.text) as Record<string, unknown> | null;
        const decision = parsed?.decision === "activate" ? "activate" : "reject";
        const confidence = typeof parsed?.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0;
        const rationale = typeof parsed?.rationale === "string"
          ? parsed.rationale.trim().slice(0, 400)
          : "";

        await recordGlobalDecision({
          candidateId: candidate.id,
          provider: validator.provider,
          decision,
          confidence,
          rationale,
        });
      }

      const approvals = validatorResults
        .map((validator) => {
          const parsed = extractJson(validator.text) as Record<string, unknown> | null;
          return {
            decision: parsed?.decision === "activate" ? "activate" : "reject",
            confidence: typeof parsed?.confidence === "number"
              ? Math.max(0, Math.min(1, parsed.confidence))
              : 0,
          };
        })
        .filter((item) => item.decision === "activate" && item.confidence >= 0.8);

      const rejects = validatorResults
        .map((validator) => {
          const parsed = extractJson(validator.text) as Record<string, unknown> | null;
          return {
            decision: parsed?.decision === "activate" ? "activate" : "reject",
            confidence: typeof parsed?.confidence === "number"
              ? Math.max(0, Math.min(1, parsed.confidence))
              : 0,
          };
        })
        .filter((item) => item.decision === "reject" && item.confidence >= 0.8);

      if (candidate.evidence_count >= 3 && approvals.length >= 2 && rejects.length === 0) {
        const activated = await activateGlobalCandidate(
          candidate.id,
          approvals.reduce((sum, item) => sum + item.confidence, 0) / approvals.length,
          "Validated independently by multiple AI providers."
        );
        validationResults.push({ candidateId: candidate.id, activated, approvals: approvals.length });
      }
    }

    return NextResponse.json({
      ok: true,
      providers: [...new Set(results.map((item) => item.provider))],
      capabilityObservations: capabilities.length,
      activeGoals: goals.length + saved.length,
      newGoals: saved,
      candidateCount: candidateRows.length,
      validationResults,
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
