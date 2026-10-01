import { NextResponse } from "next/server";
import { recordJamesStrategyFeedback } from "../../../tools/jamesStrategyFeedback";
import { reconcileJamesMetaStrategyLifecycle } from "../../../tools/jamesMetaStrategyLifecycle";
import { createClient } from "@supabase/supabase-js";
import type { GameBlueprint, TestReport } from "../../../../fun-zone/laboratory/types";
import { recordJamesGameTestLearning, recordJamesGameBrainEvidence, gameQuality, evolveJamesStrategyMemory, evaluateJamesMutationOutcome, evaluateJamesRecoveryDirectiveImpact, promoteJamesExplorationResult, evaluateJamesExploreExploitImpact, promoteJamesGeneralizedGameSkills, resolveJamesCoreSkillConflict, recordJamesCoreSkillLineage, recordJamesKnowledgeContradiction, consolidateJamesGameKnowledge, versionJamesConsolidatedKnowledge, resolveJamesKnowledgeSupersession } from "../../../../fun-zone/engine/jamesGameLearning";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.JAMES_AUTONOMY_CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === "Bearer " + secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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

    // Strategy feedback is persisted before the experiment checkpoint so a
    // retry can safely replay the same evidence without creating a second trial.
    const strategyMeta =
      experiment.learning_result && typeof experiment.learning_result === "object"
        ? experiment.learning_result as Record<string, unknown>
        : {};
    const strategyId =
      typeof strategyMeta.strategyId === "string" ? strategyMeta.strategyId : "";

    let strategyFeedback: unknown = null;
    if (strategyId) {
      const { error: usageError } = await client.rpc("record_james_meta_strategy_usage", {
        p_strategy_id: strategyId,
        p_experiment_id: experimentId,
        p_attempt: attempt,
        p_usage_state: "verified",
        p_evidence: {
          source: "fun-zone-verification",
          passed: report.passed === true,
          status: report.passed === true ? "verified" : "not_verified",
        },
      });
      if (usageError) {
        throw new Error("Strategy usage evidence could not be persisted: " + usageError.message);
      }
      const { data: integrity, error: integrityError } = await client.rpc("verify_james_meta_strategy_integrity", {
        p_experiment_id: experimentId,
        p_attempt: attempt,
        p_strategy_id: strategyId,
      });
      if (integrityError) throw new Error("Strategy integrity verification failed; experiment checkpoint remains retryable: " + integrityError.message);
      if (!integrity?.ok) {
        const { error: conflictError } = await client.rpc("record_james_strategy_integrity_conflict", {
          p_strategy_id: strategyId,
          p_experiment_id: experimentId,
          p_attempt: attempt,
          p_expected_fingerprint: typeof integrity?.expectedFingerprint === "string" ? integrity.expectedFingerprint : "",
          p_selected_fingerprint: typeof integrity?.selectedFingerprint === "string" ? integrity.selectedFingerprint : "",
          p_executed_fingerprint: typeof integrity?.executedFingerprint === "string" ? integrity.executedFingerprint : "",
          p_verified_fingerprint: typeof integrity?.verifiedFingerprint === "string" ? integrity.verifiedFingerprint : "",
        });
        if (conflictError) {
          throw new Error("Strategy integrity mismatch could not be recorded: " + conflictError.message);
        }
        throw new Error("Strategy integrity mismatch; verification checkpoint remains retryable.");
      }

      const hardFailures = Array.isArray(report.hardFailures) ? report.hardFailures : [];
      const softWarnings = Array.isArray(report.softWarnings) ? report.softWarnings : [];
      const verified = report.passed === true;
      const quality = Math.max(
        0,
        Math.min(
          1,
          verified
            ? 0.9
            : Math.max(0.1, 0.6 - hardFailures.length * 0.12 - softWarnings.length * 0.03),
        ),
      );
      const outcome =
        verified ? "success" : hardFailures.length > 0 ? "failure" : "partial";
      const comparison =
        strategyMeta.strategyComparison &&
        typeof strategyMeta.strategyComparison === "object"
          ? strategyMeta.strategyComparison
          : null;

      strategyFeedback = await recordJamesStrategyFeedback({
        strategyId,
        experimentId,
        attempt,
        scenarioKey: "fun-zone-sandbox:" + experimentId,
        outcome,
        quality,
        evidence: {
          source: "fun-zone-post-verification-feedback",
          status: verified ? "verified" : "not_verified",
          hardFailures: hardFailures.slice(0, 10),
          softWarnings: softWarnings.slice(0, 10),
          strategyComparison: comparison,
        },
      });

      if (!strategyFeedback) {
        throw new Error("Strategy feedback could not be persisted; experiment checkpoint remains retryable.");
      }

      const feedbackRecord = strategyFeedback as Record<string, unknown>;
      const trialId =
        typeof feedbackRecord.id === "string" ? feedbackRecord.id : null;
      const { data: usageRows } = await client
        .from("james_meta_strategy_usage")
        .select("id")
        .eq("strategy_id", strategyId)
        .eq("experiment_id", experimentId)
        .eq("attempt", attempt)
        .eq("usage_state", "verified")
        .limit(1);
      const usageId = usageRows?.[0]?.id || null;

      const { error: provenanceError } = await client.rpc("record_james_strategy_evidence_provenance", {
        p_strategy_id: strategyId,
        p_trial_id: trialId,
        p_experiment_id: experimentId,
        p_usage_id: usageId,
        p_source_type: "verification",
        p_source_event_key: "verification:" + experimentId + ":" + attempt + ":" + strategyId,
        p_quality_score: quality,
        p_provenance: {
          source: "fun-zone-post-verification-feedback",
          experimentId,
          attempt,
          strategyId,
          passed: verified,
          outcome,
          usageId,
          trialId,
        },
      });
      if (provenanceError) {
        throw new Error("Strategy evidence provenance could not be persisted; experiment checkpoint remains retryable: " + provenanceError.message);
      }

      // Detect and resolve evidence conflicts before lifecycle reconciliation.
      // Unresolved contradictions remain open and block lifecycle transitions.
      const { error: conflictDetectError } = await client.rpc("detect_james_meta_strategy_evidence_conflicts", {
        p_strategy_id: strategyId,
      });
      if (conflictDetectError) {
        throw new Error("Strategy evidence conflict detection failed; experiment checkpoint remains retryable: " + conflictDetectError.message);
      }
      const { error: conflictResolveError } = await client.rpc("resolve_all_james_meta_strategy_evidence_conflicts", {
        p_strategy_id: strategyId,
      });
      if (conflictResolveError) {
        throw new Error("Strategy evidence conflict resolution failed; experiment checkpoint remains retryable: " + conflictResolveError.message);
      }

      // Lifecycle reconciliation runs only after durable feedback, provenance, and conflict resolution.
      // The lifecycle RPC reads the aggregated evidence ledger and remains
      // the sole authority for candidate/active/retired transitions.
      await reconcileJamesMetaStrategyLifecycle(strategyId);
    }
    const learningEventKey = "fun-zone:" + experimentId + ":" + attempt;
    const learning = await recordJamesGameTestLearning(blueprint, report, attempt, learningEventKey);
    const brainEvidence = await recordJamesGameBrainEvidence(blueprint, report, attempt, learningEventKey);
    const evolved = await evolveJamesStrategyMemory(blueprint, report);
    const mutationOutcome = await evaluateJamesMutationOutcome(experiment.prompt, blueprint, report, learningEventKey);
    const recoveryImpact = await evaluateJamesRecoveryDirectiveImpact(experiment.prompt, blueprint, report, learningEventKey);
    const explorationPromotion = await promoteJamesExplorationResult(experiment.prompt, blueprint, report, learningEventKey);
    const learningModeImpact = await evaluateJamesExploreExploitImpact(experiment.prompt, blueprint, report, learningEventKey);
    const generalizedSkills = await promoteJamesGeneralizedGameSkills(8, learningEventKey);
    const consolidatedKnowledge = await consolidateJamesGameKnowledge(8);
    const knowledgeVersions = await versionJamesConsolidatedKnowledge(8, learningEventKey);
    const knowledgeSupersession = await resolveJamesKnowledgeSupersession(8, learningEventKey);
    const coreSkillConflicts = [];
    for (const skill of generalizedSkills || []) {
      const conflict = await resolveJamesCoreSkillConflict(skill.capabilityKey, {
        competence: skill.competence,
        confidence: skill.confidence,
        passed: report.passed === true,
        quality: gameQuality(report),
        evidence: 1,
      }, learningEventKey);
      if (conflict) {
        coreSkillConflicts.push(conflict);
        if (conflict.conflict) {
          await recordJamesKnowledgeContradiction({
            capabilityKey: skill.capabilityKey,
            previousQuality: conflict.previousCompetence,
            observedQuality: conflict.observedQuality,
            observedContext: String(blueprint.world) + ":" + String(blueprint.genre),
            resolution: conflict.nextAction,
            learningEventKey,
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
      learning_result: { learning, brainEvidence, evolved, mutationOutcome, recoveryImpact, explorationPromotion, learningModeImpact, generalizedSkills, coreSkillConflicts, consolidatedKnowledge, knowledgeVersions, knowledgeSupersession, strategyFeedback, strategyLifecycle: strategyId ? "reconciled" : null, strategyId: strategyId || null, strategyComparison: strategyMeta.strategyComparison || null },
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
