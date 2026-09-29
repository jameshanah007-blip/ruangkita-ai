import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { GameBlueprint, TestReport } from "../../../../fun-zone/laboratory/types";
import { recordJamesGameTestLearning, recordJamesGameBrainEvidence, gameQuality, evolveJamesStrategyMemory, evaluateJamesMutationOutcome, evaluateJamesRecoveryDirectiveImpact, promoteJamesExplorationResult, evaluateJamesExploreExploitImpact, promoteJamesGeneralizedGameSkills, resolveJamesCoreSkillConflict, recordJamesCoreSkillLineage, recordJamesKnowledgeContradiction, consolidateJamesGameKnowledge, versionJamesConsolidatedKnowledge, resolveJamesKnowledgeSupersession } from "../../../../fun-zone/engine/jamesGameLearning";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const experimentId = typeof body?.experimentId === "string" ? body.experimentId : "";
    const claimToken = typeof body?.claimToken === "string" ? body.claimToken : "";
    const report = body?.report as TestReport | undefined;
    const blueprint = body?.blueprint as GameBlueprint | undefined;

    if (!experimentId || !report || !blueprint) return NextResponse.json({ success: false, error: "experimentId, blueprint, dan TestReport wajib tersedia." }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return NextResponse.json({ success: false, error: "Supabase secret configuration is missing." }, { status: 503 });

    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    const { data: experiment, error: readError } = await client.from("james_game_experiments").select("*").eq("id", experimentId).maybeSingle();
    if (readError) throw readError;
    if (!experiment) return NextResponse.json({ success: false, error: "Experiment job tidak ditemukan." }, { status: 404 });

    if (experiment.status === "running" && experiment.runner_token && experiment.runner_token !== claimToken) {
      return NextResponse.json({ success: false, error: "Experiment sedang dijalankan runner lain." }, { status: 409 });
    }
    if (experiment.status !== "running" && experiment.status !== "pending_verification") {
      return NextResponse.json({ success: false, error: "Experiment tidak berada pada state yang dapat diverifikasi.", status: experiment.status }, { status: 409 });
    }

    const attempt = Number(report.attempt || experiment.attempt || 0);
    const learning = await recordJamesGameTestLearning(blueprint, report, attempt);
    const brainEvidence = await recordJamesGameBrainEvidence(blueprint, report, attempt);
    const evolved = await evolveJamesStrategyMemory(blueprint, report);
    const mutationOutcome = await evaluateJamesMutationOutcome(experiment.prompt, blueprint, report);
    const recoveryImpact = await evaluateJamesRecoveryDirectiveImpact(experiment.prompt, blueprint, report);
    const explorationPromotion = await promoteJamesExplorationResult(experiment.prompt, blueprint, report);
    const learningModeImpact = await evaluateJamesExploreExploitImpact(experiment.prompt, blueprint, report);
    const generalizedSkills = await promoteJamesGeneralizedGameSkills(8);
    const consolidatedKnowledge = await consolidateJamesGameKnowledge(8);
    const knowledgeVersions = await versionJamesConsolidatedKnowledge(8);
    const knowledgeSupersession = await resolveJamesKnowledgeSupersession(8);
    const coreSkillConflicts = [];
    for (const skill of generalizedSkills || []) {
      const conflict = await resolveJamesCoreSkillConflict(skill.capabilityKey, {
        competence: skill.competence,
        confidence: skill.confidence,
        passed: report.passed === true,
        quality: gameQuality(report),
        evidence: 1,
      });
      if (conflict) {
        coreSkillConflicts.push(conflict);
        if (conflict.conflict) {
          await recordJamesKnowledgeContradiction({
            capabilityKey: skill.capabilityKey,
            previousQuality: conflict.previousCompetence,
            observedQuality: conflict.observedQuality,
            observedContext: String(blueprint.world) + ":" + String(blueprint.genre),
            resolution: conflict.nextAction,
          });
        }
        await recordJamesCoreSkillLineage(skill.capabilityKey, {
          source: "fun-zone-experiment-verification",
          quality: gameQuality(report),
          passed: report.passed === true,
          context: String(blueprint.world) + ":" + String(blueprint.genre) + ":" + blueprint.mechanics.slice(0, 4).join("+"),
          previousCompetence: conflict.previousCompetence,
          newCompetence: conflict.competence,
          newConfidence: conflict.confidence,
          reason: conflict.conflict ? "Conflicting evidence detected." : "Evidence reinforced generalized skill.",
        });
      }
    }
    const verified = report.passed === true;
    const terminalFailure = !verified && attempt >= 5;

    const nextStatus = verified ? "verified" : terminalFailure ? "failed" : "pending_verification";
    const updatePayload = {
      status: nextStatus,
      test_report: report,
      learning_result: { learning, brainEvidence, evolved, mutationOutcome, recoveryImpact, explorationPromotion, learningModeImpact, generalizedSkills, coreSkillConflicts, consolidatedKnowledge, knowledgeVersions, knowledgeSupersession },
      attempt,
      verified_at: verified ? new Date().toISOString() : null,
      runner_token: null,
      started_at: null,
    };

    // Running jobs are protected by the runner claim token. Pending verification
    // jobs have no runner token and must be allowed to transition independently.
    let updateQuery = client
      .from("james_game_experiments")
      .update(updatePayload)
      .eq("id", experimentId);

    if (experiment.status === "running") {
      updateQuery = updateQuery.eq("status", "running").eq("runner_token", claimToken);
    } else {
      updateQuery = updateQuery.eq("status", "pending_verification");
    }

    const { data: updatedExperiment, error: updateError } = await updateQuery.select("id,status");

    if (updateError) throw updateError;
    if (!updatedExperiment || updatedExperiment.length !== 1) {
      return NextResponse.json({ success: false, error: "Experiment verification state changed before persistence." }, { status: 409 });
    }

    return NextResponse.json({ success: true, experimentId, status: nextStatus, learning, brainEvidence, evolved, mutationOutcome, recoveryImpact });
  } catch (error) {
    console.error("James Game Brain experiment verification failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Experiment verification failed." }, { status: 500 });
  }
}
