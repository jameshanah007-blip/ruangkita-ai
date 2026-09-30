import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { GameBlueprint, TestReport } from "../../../../fun-zone/laboratory/types";
import { reconcileJamesMetaStrategyLifecycle } from "../../../tools/jamesStrategyLifecycleBridge";
import { recordJamesGameTestLearning, recordJamesGameBrainEvidence, gameQuality, evolveJamesStrategyMemory, evaluateJamesMutationOutcome, evaluateJamesRecoveryDirectiveImpact, promoteJamesExplorationResult, evaluateJamesExploreExploitImpact, promoteJamesGeneralizedGameSkills, resolveJamesCoreSkillConflict, recordJamesCoreSkillLineage, recordJamesKnowledgeContradiction, consolidateJamesGameKnowledge, versionJamesConsolidatedKnowledge, resolveJamesKnowledgeSupersession, recordJamesTournamentOutcomeFeedback, recordJamesStrategyComparisonMemory } from "../../../../fun-zone/engine/jamesGameLearning";

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

    // Atomically claim this exact verification callback before any learning
    // side effects. A duplicate callback with the old runner token is rejected.
    const { data: processingToken, error: claimError } = await client.rpc(
      "claim_james_game_experiment_verification",
      {
        p_experiment_id: experimentId,
        p_attempt: attempt,
        p_runner_token: claimToken,
      },
    );
    if (claimError) throw claimError;
    if (typeof processingToken !== "string" || !processingToken) {
      return NextResponse.json({
        success: false,
        error: "Experiment verification attempt was already claimed or is no longer active.",
      }, { status: 409 });
    }

    const { data: existingLedger, error: existingLedgerError } = await client
      .from("james_experiment_verification_ledger")
      .select("*")
      .eq("experiment_id", experimentId)
      .eq("attempt", attempt)
      .maybeSingle();
    if (existingLedgerError) throw existingLedgerError;

    if (existingLedger?.finalized && existingLedger.final_payload) {
      const { data: recoveredExperiment, error: recoveredExperimentError } = await client
        .from("james_game_experiments")
        .update(existingLedger.final_payload)
        .eq("id", experimentId)
        .eq("status", "running")
        .eq("runner_token", processingToken)
        .select("id,status");
      if (recoveredExperimentError) throw recoveredExperimentError;
      return NextResponse.json({
        success: true,
        experimentId,
        status: recoveredExperiment?.[0]?.status || existingLedger.final_payload.status,
        recoveredFromFinalizedLedger: true,
      });
    }

    const { data: ledgerRow, error: ledgerError } = await client
      .from("james_experiment_verification_ledger")
      .upsert({
        experiment_id: experimentId,
        attempt,
        processing_token: processingToken,
        stage: existingLedger?.stage || "learning_started",
      }, { onConflict: "experiment_id,attempt" })
      .select("*")
      .single();
    if (ledgerError) throw ledgerError;

    const learning = ledgerRow.learning_completed && ledgerRow.learning_result
      ? ledgerRow.learning_result
      : await recordJamesGameTestLearning(blueprint, report, attempt);

    if (!ledgerRow.learning_completed) {
      const { error: checkpointError } = await client
        .from("james_experiment_verification_ledger")
        .update({
          learning_completed: true,
          learning_result: learning,
          stage: "brain_evidence_started",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ledgerRow.id)
        .eq("finalized", false);
      if (checkpointError) throw checkpointError;
    }

    const { data: ledgerAfterLearning, error: ledgerReloadError } = await client
      .from("james_experiment_verification_ledger")
      .select("*")
      .eq("id", ledgerRow.id)
      .single();
    if (ledgerReloadError) throw ledgerReloadError;

    const brainEvidence = ledgerAfterLearning.brain_evidence_completed && ledgerAfterLearning.brain_evidence_result
      ? ledgerAfterLearning.brain_evidence_result
      : await recordJamesGameBrainEvidence(blueprint, report, attempt);

    if (!ledgerAfterLearning.brain_evidence_completed) {
      const { error: brainCheckpointError } = await client
        .from("james_experiment_verification_ledger")
        .update({
          brain_evidence_completed: true,
          brain_evidence_result: brainEvidence,
          stage: "strategy_memory_started",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ledgerAfterLearning.id)
        .eq("finalized", false);
      if (brainCheckpointError) throw brainCheckpointError;
    }
    const { data: stageRow, error: stageReadError } = await client
      .from("james_experiment_verification_ledger")
      .select("*")
      .eq("experiment_id", experimentId)
      .eq("attempt", attempt)
      .single();
    if (stageReadError) throw stageReadError;

    const evolved = stageRow.evolution_completed && stageRow.evolution_result
      ? stageRow.evolution_result
      : await evolveJamesStrategyMemory(blueprint, report);
    if (!stageRow.evolution_completed) {
      const { error } = await client.from("james_experiment_verification_ledger").update({
        evolution_completed: true, evolution_result: evolved, stage: "mutation_started", updated_at: new Date().toISOString()
      }).eq("id", stageRow.id).eq("finalized", false);
      if (error) throw error;
    }

    const { data: afterEvolution, error: reloadEvolutionError } = await client
      .from("james_experiment_verification_ledger").select("*").eq("id", stageRow.id).single();
    if (reloadEvolutionError) throw reloadEvolutionError;

    const mutationOutcome = afterEvolution.mutation_completed && afterEvolution.mutation_result
      ? afterEvolution.mutation_result
      : await evaluateJamesMutationOutcome(experiment.prompt, blueprint, report);
    if (!afterEvolution.mutation_completed) {
      const { error } = await client.from("james_experiment_verification_ledger").update({
        mutation_completed: true, mutation_result: mutationOutcome, stage: "recovery_started", updated_at: new Date().toISOString()
      }).eq("id", stageRow.id).eq("finalized", false);
      if (error) throw error;
    }

    const { data: afterMutation, error: reloadMutationError } = await client
      .from("james_experiment_verification_ledger").select("*").eq("id", stageRow.id).single();
    if (reloadMutationError) throw reloadMutationError;

    const recoveryImpact = afterMutation.recovery_completed && afterMutation.recovery_result
      ? afterMutation.recovery_result
      : await evaluateJamesRecoveryDirectiveImpact(experiment.prompt, blueprint, report);
    if (!afterMutation.recovery_completed) {
      const { error } = await client.from("james_experiment_verification_ledger").update({
        recovery_completed: true, recovery_result: recoveryImpact, stage: "exploration_started", updated_at: new Date().toISOString()
      }).eq("id", stageRow.id).eq("finalized", false);
      if (error) throw error;
    }

    const { data: afterRecovery, error: reloadRecoveryError } = await client
      .from("james_experiment_verification_ledger").select("*").eq("id", stageRow.id).single();
    if (reloadRecoveryError) throw reloadRecoveryError;

    const explorationPromotion = afterRecovery.exploration_completed && afterRecovery.exploration_result
      ? afterRecovery.exploration_result
      : await promoteJamesExplorationResult(experiment.prompt, blueprint, report);
    if (!afterRecovery.exploration_completed) {
      const { error } = await client.from("james_experiment_verification_ledger").update({
        exploration_completed: true, exploration_result: explorationPromotion, stage: "learning_mode_started", updated_at: new Date().toISOString()
      }).eq("id", stageRow.id).eq("finalized", false);
      if (error) throw error;
    }

    const { data: afterExploration, error: reloadExplorationError } = await client
      .from("james_experiment_verification_ledger").select("*").eq("id", stageRow.id).single();
    if (reloadExplorationError) throw reloadExplorationError;

    const learningModeImpact = afterExploration.learning_mode_completed && afterExploration.learning_mode_result
      ? afterExploration.learning_mode_result
      : await evaluateJamesExploreExploitImpact(experiment.prompt, blueprint, report);
    if (!afterExploration.learning_mode_completed) {
      const { error } = await client.from("james_experiment_verification_ledger").update({
        learning_mode_completed: true, learning_mode_result: learningModeImpact, stage: "knowledge_started", updated_at: new Date().toISOString()
      }).eq("id", stageRow.id).eq("finalized", false);
      if (error) throw error;
    }
    const { data: knowledgeStage, error: knowledgeStageError } = await client
      .from("james_experiment_verification_ledger")
      .select("*")
      .eq("experiment_id", experimentId)
      .eq("attempt", attempt)
      .single();
    if (knowledgeStageError) throw knowledgeStageError;

    const generalizedSkills = knowledgeStage.skills_completed && knowledgeStage.skills_result
      ? knowledgeStage.skills_result
      : await promoteJamesGeneralizedGameSkills(8);
    if (!knowledgeStage.skills_completed) {
      const { error } = await client.from("james_experiment_verification_ledger").update({
        skills_completed: true, skills_result: generalizedSkills, stage: "knowledge_started", updated_at: new Date().toISOString()
      }).eq("id", knowledgeStage.id).eq("finalized", false);
      if (error) throw error;
    }

    const { data: knowledgeAfterSkills, error: skillsReloadError } = await client
      .from("james_experiment_verification_ledger").select("*").eq("id", knowledgeStage.id).single();
    if (skillsReloadError) throw skillsReloadError;

    const consolidatedKnowledge = knowledgeAfterSkills.knowledge_completed && knowledgeAfterSkills.knowledge_result
      ? knowledgeAfterSkills.knowledge_result.consolidatedKnowledge
      : await consolidateJamesGameKnowledge(8);
    const knowledgeVersions = knowledgeAfterSkills.knowledge_completed && knowledgeAfterSkills.knowledge_result
      ? knowledgeAfterSkills.knowledge_result.knowledgeVersions
      : await versionJamesConsolidatedKnowledge(8);
    const knowledgeSupersession = knowledgeAfterSkills.knowledge_completed && knowledgeAfterSkills.knowledge_result
      ? knowledgeAfterSkills.knowledge_result.knowledgeSupersession
      : await resolveJamesKnowledgeSupersession(8);

    if (!knowledgeAfterSkills.knowledge_completed) {
      const knowledgeResult = { consolidatedKnowledge, knowledgeVersions, knowledgeSupersession };
      const { error } = await client.from("james_experiment_verification_ledger").update({
        knowledge_completed: true, knowledge_result: knowledgeResult, stage: "core_skill_started", updated_at: new Date().toISOString()
      }).eq("id", knowledgeStage.id).eq("finalized", false);
      if (error) throw error;
    }
    const coreSkillConflicts = [];
    const { data: coreStage, error: coreStageError } = await client
      .from("james_experiment_verification_ledger")
      .select("*")
      .eq("experiment_id", experimentId)
      .eq("attempt", attempt)
      .single();
    if (coreStageError) throw coreStageError;

    if (coreStage.core_skill_completed && Array.isArray(coreStage.core_skill_result)) {
      coreSkillConflicts.push(...coreStage.core_skill_result);
    } else {
      for (const skill of generalizedSkills || []) {
        const sourceEventKey = `core-skill:${experimentId}:${attempt}:${skill.capabilityKey}`;
        const { data: skillLedger, error: skillLedgerError } = await client
          .from("james_experiment_core_skill_ledger")
          .upsert({
            experiment_id: experimentId,
            attempt,
            capability_key: skill.capabilityKey,
            source_event_key: sourceEventKey,
          }, { onConflict: "experiment_id,attempt,capability_key" })
          .select("*")
          .single();
        if (skillLedgerError) throw skillLedgerError;

        if (skillLedger.conflict_completed && skillLedger.conflict_result) {
          coreSkillConflicts.push(skillLedger.conflict_result);
          continue;
        }

        const conflict = await resolveJamesCoreSkillConflict(skill.capabilityKey, {
          competence: skill.competence,
          confidence: skill.confidence,
          passed: report.passed === true,
          quality: gameQuality(report),
          evidence: 1,
        });
        if (conflict) {
          coreSkillConflicts.push(conflict);
          await client
            .from("james_experiment_core_skill_ledger")
            .update({
              conflict_completed: true,
              conflict_result: conflict,
              updated_at: new Date().toISOString(),
            })
            .eq("id", skillLedger.id);

          if (conflict.conflict && !skillLedger.contradiction_completed) {
            await recordJamesKnowledgeContradiction({
              capabilityKey: skill.capabilityKey,
              previousQuality: conflict.previousCompetence,
              observedQuality: conflict.observedQuality,
              observedContext: String(blueprint.world) + ":" + String(blueprint.genre),
              resolution: conflict.nextAction,
            });
            await client
              .from("james_experiment_core_skill_ledger")
              .update({ contradiction_completed: true, updated_at: new Date().toISOString() })
              .eq("id", skillLedger.id);
          } else if (!conflict.conflict) {
            await client
              .from("james_experiment_core_skill_ledger")
              .update({ contradiction_completed: true, updated_at: new Date().toISOString() })
              .eq("id", skillLedger.id);
          }
          if (!skillLedger.lineage_completed) {
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
            await client
              .from("james_experiment_core_skill_ledger")
              .update({ lineage_completed: true, updated_at: new Date().toISOString() })
              .eq("id", skillLedger.id);
          }
        }
      }
    }
    const { error: coreCheckpointError } = await client
      .from("james_experiment_verification_ledger")
      .update({
        core_skill_completed: true,
        core_skill_result: coreSkillConflicts,
        stage: "strategy_feedback_started",
        updated_at: new Date().toISOString(),
      })
      .eq("id", coreStage.id)
      .eq("finalized", false);
    if (coreCheckpointError) throw coreCheckpointError;
    const verified = report.passed === true;
    const terminalFailure = !verified && attempt >= 5;

    const nextStatus = verified ? "verified" : terminalFailure ? "failed" : "pending_verification";
    // Feed strategy-aware experiments back into the strategy loop.
    // Revalidation jobs carry both strategyId and revalidationJobId; newly
    // synthesized candidates only need strategyId to receive fresh evidence.
    const strategyMeta = (experiment.learning_result && typeof experiment.learning_result === "object")
      ? experiment.learning_result as Record<string, unknown>
      : {};
    const strategyId = typeof strategyMeta.strategyId === "string" ? strategyMeta.strategyId : "";
    const revalidationJobId = typeof strategyMeta.revalidationJobId === "string" ? strategyMeta.revalidationJobId : "";
    if (strategyId) {
      const hardFailures = Array.isArray(report.hardFailures) ? report.hardFailures : [];
      const softWarnings = Array.isArray(report.softWarnings) ? report.softWarnings : [];
      const quality = Math.max(0, Math.min(1,
        verified ? 0.9 : Math.max(0.1, 0.6 - hardFailures.length * 0.12 - softWarnings.length * 0.03)
      ));
      const outcome = verified ? "success" : hardFailures.length > 0 ? "failure" : "partial";
      const sourceEventKey = revalidationJobId
        ? "strategy-revalidation:" + revalidationJobId + ":experiment:" + experimentId + ":attempt:" + attempt
        : "strategy-experiment:" + strategyId + ":experiment:" + experimentId + ":attempt:" + attempt;

      // Resolve the retired parent from the candidate's immutable source lineage.
      // This makes candidate-vs-parent comparison causal instead of relying on
      // the nearest historical game fingerprint.
      let parentStrategyId: string | null = null;
      let parentQuality: number | null = null;
      let parentEvidenceCount = 0;
      if (strategyMeta.strategySelectionSource === "retired-strategy-synthesis") {
        const { data: candidateRow } = await client
          .from("james_meta_strategy_synthesis")
          .select("source_patterns")
          .eq("id", strategyId)
          .maybeSingle();
        const patterns = Array.isArray(candidateRow?.source_patterns)
          ? candidateRow.source_patterns.filter((value): value is string => typeof value === "string")
          : [];
        const retiredPattern = patterns.find((value) => value.startsWith("retired:"));
        parentStrategyId = retiredPattern ? retiredPattern.slice("retired:".length) : null;

        if (parentStrategyId) {
          const { data: parentTrials } = await client
            .from("james_meta_strategy_trials")
            .select("quality,outcome,created_at")
            .eq("strategy_id", parentStrategyId)
            .order("created_at", { ascending: false })
            .limit(20);
          parentEvidenceCount = parentTrials?.length || 0;
          if (parentEvidenceCount) {
            parentQuality = Number((
              parentTrials!.reduce((sum, trial) => sum + Number(trial.quality || 0), 0) /
              parentEvidenceCount
            ).toFixed(4));
          }
        }
      }

      const candidateImprovement = parentQuality === null
        ? null
        : Number((quality - parentQuality).toFixed(4));
      const strategyComparison = {
        comparisonType: parentStrategyId ? "retired-parent-vs-new-candidate" : "candidate-only",
        parentStrategyId,
        parentQuality,
        parentEvidenceCount,
        candidateStrategyId: strategyId,
        candidateQuality: quality,
        improvement: candidateImprovement,
        improved: candidateImprovement === null ? null : candidateImprovement > 0,
      };
      const evidence = {
        source: "fun-zone-post-verification-callback",
        sourceEventKey,
        experimentId,
        revalidationJobId,
        status: nextStatus,
        attempt,
        hardFailures: hardFailures.slice(0, 10),
        softWarnings: softWarnings.slice(0, 10),
        strategySelectionSource: typeof strategyMeta.strategySelectionSource === "string"
          ? strategyMeta.strategySelectionSource
          : null,
        strategyKey: typeof strategyMeta.strategyKey === "string"
          ? strategyMeta.strategyKey
          : null,
        baselineValidatedStrategyId: typeof strategyMeta.baselineValidatedStrategyId === "string"
          ? strategyMeta.baselineValidatedStrategyId
          : null,
        strategyComparison,
        // Persist diversity at the trial-evidence level because the lifecycle
        // RPC uses this field to decide whether a candidate is structurally
        // different enough to validate.
        blueprintDiversity: strategyMeta.diversity && typeof strategyMeta.diversity === "object"
          ? strategyMeta.diversity
          : null,
        // The sandbox report is the fresh outcome attached to this exact
        // strategy identity. Keep the observable checks with the evidence so
        // lifecycle decisions can be audited without reconstructing the run.
        checks: {
          passed: report.passed === true,
          runtimeOk: report.runtimeOk,
          gameplayTest: report.gameplayTest,
          stateChanged: report.stateChanged,
          objectiveChanged: report.objectiveChanged,
          playerChanged: report.playerChanged,
          restartVerified: report.restartVerified,
        },
      };
      const { error: strategyTrialError } = await client
        .from("james_meta_strategy_trials")
        .upsert({
          strategy_id: strategyId,
          scenario_key: "fun-zone-sandbox:" + experimentId,
          outcome,
          quality,
          evidence,
          source_event_key: sourceEventKey,
        }, { onConflict: "source_event_key", ignoreDuplicates: false })
        .select("id,source_event_key")
        .maybeSingle();
      if (strategyTrialError) {
        console.warn("James strategy post-verification feedback unavailable:", strategyTrialError.message);
      } else {
        // Reconcile promotion/retirement from the newly persisted evidence.
        // The bridge is fail-open so evidence recording is not blocked if the
        // lifecycle migration has not reached this deployment yet.
        await reconcileJamesMetaStrategyLifecycle(strategyId);

        // Feed the real sandbox outcome back into the tournament memory so
        // future mutation selection is based on observed experiment results,
        // not only the pre-experiment tournament ranking.
        const mutationAction = typeof strategyMeta.mutationAction === "string"
          ? strategyMeta.mutationAction
          : null;
        const strategyKey = typeof strategyMeta.strategyKey === "string"
          ? strategyMeta.strategyKey
          : "";
        const retiredMatch = strategyKey.match(/:retired:([^:]+):mutation:/);
        const taskClassMatch = strategyKey.match(/^meta:([^:]+):retired:/);
        const targetContext = retiredMatch
          ? retiredMatch[1] + ":" + (taskClassMatch?.[1] || "fun-zone-game-director")
          : strategyKey || strategyId;
        await recordJamesTournamentOutcomeFeedback({
          targetContext,
          mutationAction,
          experimentId,
          sourceEventKey,
          passed: verified,
          quality,
        });

        if (parentStrategyId) {
          const blueprintDiversity = strategyMeta.diversity && typeof strategyMeta.diversity === "object"
            ? strategyMeta.diversity as { mutationVerified?: boolean | null; beforeFingerprint?: string | null; afterFingerprint?: string | null }
            : null;
          await recordJamesStrategyComparisonMemory({
            parentStrategyId,
            candidateStrategyId: strategyId,
            targetContext,
            mutation: mutationAction || "unknown",
            parentQuality,
            candidateQuality: quality,
            improvement: candidateImprovement,
            improved: strategyComparison.improved,
            blueprintDiversity,
            experimentId,
            sourceEventKey,
          });
        }

        if (revalidationJobId) {
          await client.from("james_meta_strategy_revalidation_queue")
            .update({ status: "completed", completed_at: new Date().toISOString(), evidence })
            .eq("id", revalidationJobId)
            .eq("status", "running");
        }
      }
    }

    const { error: strategyCheckpointError } = await client
      .from("james_experiment_verification_ledger")
      .update({
        stage: "finalization_started",
        strategy_feedback_completed: true,
        strategy_feedback_result: strategyId ? { strategyId, revalidationJobId } : { strategyId: null },
        updated_at: new Date().toISOString(),
      })
      .eq("experiment_id", experimentId)
      .eq("attempt", attempt)
      .eq("finalized", false);
    if (strategyCheckpointError) throw strategyCheckpointError;

    // Finalize only after every learning and strategy side effect has completed.
    const finalPayload = {
      status: nextStatus,
      test_report: report,
      learning_result: { learning, brainEvidence, evolved, mutationOutcome, recoveryImpact, explorationPromotion, learningModeImpact, generalizedSkills, coreSkillConflicts, consolidatedKnowledge, knowledgeVersions, knowledgeSupersession },
      attempt,
      verified_at: verified ? new Date().toISOString() : null,
      runner_token: null,
      started_at: null,
    };

    let finalQuery = client
      .from("james_game_experiments")
      .update(finalPayload)
      .eq("id", experimentId)
      .eq("status", "running")
      .eq("runner_token", processingToken);

    const { data: finalizedExperiment, error: finalUpdateError } = await finalQuery.select("id,status");
    if (finalUpdateError) throw finalUpdateError;
    if (!finalizedExperiment || finalizedExperiment.length !== 1) {
      return NextResponse.json({ success: false, error: "Experiment finalization state changed before persistence." }, { status: 409 });
    }

    const { error: ledgerFinalizeError } = await client
      .from("james_experiment_verification_ledger")
      .update({
        stage: "finalized",
        strategy_feedback_completed: true,
        final_payload: finalPayload,
        finalized: true,
        processing_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("experiment_id", experimentId)
      .eq("attempt", attempt)
      .eq("finalized", false);
    if (ledgerFinalizeError) throw ledgerFinalizeError;

    return NextResponse.json({ success: true, experimentId, status: nextStatus, learning, brainEvidence, evolved, mutationOutcome, recoveryImpact });
  } catch (error) {
    console.error("James Game Brain experiment verification failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Experiment verification failed." }, { status: 500 });
  }
}
