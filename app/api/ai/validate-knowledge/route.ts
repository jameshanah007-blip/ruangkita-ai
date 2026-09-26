import { NextResponse } from "next/server";
import { generateWithAllAIProviders } from "../../../fun-zone/aiRouter";
import { extractJsonObject } from "../../tools/json";
import {
  activateGlobalCandidate,
  getGlobalCandidates,
  recordGlobalDecision,
} from "../../tools/jamesGlobalLearning";
import { isOmantoVerified } from "../verify-identity/route";

function safeText(value: unknown, max = 600) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!isOmantoVerified(request)) {
    return NextResponse.json(
      { error: "Hanya Omanto terverifikasi yang dapat memvalidasi pengetahuan James." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestedId =
      typeof body?.candidateId === "string" ? body.candidateId : "";

    const candidates = await getGlobalCandidates(10);
    const selected = requestedId
      ? candidates.filter((candidate) => candidate.id === requestedId)
      : candidates;

    if (!selected.length) {
      return NextResponse.json({
        validated: 0,
        activated: 0,
        message: "Tidak ada candidate knowledge yang perlu divalidasi.",
      });
    }

    const results: Array<{
      candidateId: string;
      key: string;
      decision: string;
      approvals: number;
      activated: boolean;
    }> = [];

    for (const candidate of selected) {
      const providerResults = await generateWithAllAIProviders({
        prompt: `Validasi kandidat pengetahuan global James berikut.

TOPIK:
${candidate.key}

PENGETAHUAN:
${candidate.value}

ALASAN:
${candidate.rationale}

Nilai apakah kandidat ini cukup jelas, umum, aman, dan didukung untuk menjadi pengetahuan aktif James.

Keluarkan JSON SAJA:
{"decision":"activate"|"reject","confidence":0.0,"rationale":"alasan singkat"}`,
        systemInstruction:
          "Kamu adalah validator pengetahuan James. Jangan mengarang fakta. Jika informasi tidak cukup untuk dinilai dengan yakin, pilih reject.",
        temperature: 0.1,
        maxOutputTokens: 500,
      });

      const decisions = providerResults.map((provider) => {
        const parsed = extractJsonObject(provider.text) as Record<string, unknown> | null;
        const decision =
          parsed?.decision === "activate" ? "activate" : "reject";
        const confidence =
          typeof parsed?.confidence === "number"
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0;
        const rationale = safeText(parsed?.rationale);

        return {
          provider: provider.provider,
          decision,
          confidence,
          rationale,
        };
      });

      for (const decision of decisions) {
        await recordGlobalDecision({
          candidateId: candidate.id,
          provider: decision.provider,
          decision: decision.decision,
          confidence: decision.confidence,
          rationale: decision.rationale,
        });
      }

      const approvals = decisions.filter(
        (decision) =>
          decision.decision === "activate" &&
          decision.confidence >= 0.8
      );

      let activated = false;

      if (approvals.length >= 2) {
        const consensusScore =
          approvals.reduce(
            (sum, decision) => sum + decision.confidence,
            0
          ) / approvals.length;

        activated = await activateGlobalCandidate(
          candidate.id,
          consensusScore,
          approvals
            .map((decision) => decision.rationale)
            .filter(Boolean)
            .join(" | ")
        );
      }

      results.push({
        candidateId: candidate.id,
        key: candidate.key,
        decision:
          approvals.length >= 2 ? "activate" : "reject",
        approvals: approvals.length,
        activated,
      });
    }

    return NextResponse.json({
      validated: results.length,
      activated: results.filter((item) => item.activated).length,
      results,
    });
  } catch (error) {
    console.error("James knowledge validation failed:", error);
    return NextResponse.json(
      { error: "Validasi knowledge James gagal." },
      { status: 500 }
    );
  }
}
