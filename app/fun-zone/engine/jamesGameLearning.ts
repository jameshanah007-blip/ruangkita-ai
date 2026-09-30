import { createClient } from "@supabase/supabase-js";
import type { GameBlueprint, TestReport } from "../laboratory/types";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function clean(value: string, max = 700) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function blueprintFingerprint(blueprint: GameBlueprint) {
  return clean(
    [
      blueprint.world,
      blueprint.genre,
      blueprint.difficulty,
      blueprint.mood,
      ...blueprint.mechanics,
    ].join(" | "),
    500,
  );
}

export async function recordJamesGameTestLearning(
  blueprint: GameBlueprint,
  report: TestReport,
  attempt: number,
  sourceEventKey?: string,
) {
  const client = db();
  if (!client) return null;

  if (sourceEventKey) {
    const { data: priorReflection } = await client
      .from("james_reflections")
      .select("id, lesson, confidence, created_at")
      .eq("user_id", SYSTEM_USER_ID)
      .ilike("evidence", "%\"sourceEventKey\":\"%" + sourceEventKey.replace(/"/g, "\\\"") + "%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorReflection?.id) return priorReflection;
  }

  const failed = Array.isArray(report.hardFailures) ? report.hardFailures : [];
  const warnings = Array.isArray(report.softWarnings) ? report.softWarnings : [];
  const passed = report.passed;

  const whatWorked = [
    report.rendered ? "rendering" : "",
    report.loopStarted ? "game loop" : "",
    report.inputTest ? "input" : "",
    report.gameplayTest ? "gameplay state" : "",
    report.objectiveChanged ? "objective progression" : "",
    report.restartVerified ? "restart" : "",
  ].filter(Boolean).join(", ");

  const whatFailed = failed.length
    ? clean(failed.join(" | "), 900)
    : warnings.length
      ? clean(warnings.join(" | "), 900)
      : passed
        ? "none"
        : "runtime verification did not fully pass";

  const lesson = passed
    ? "Keep the generated game observable: render, loop, input, state, objective and restart must remain reachable."
    : clean(
        "When this game pattern fails, strengthen the weakest observable contract before adding more complexity: " +
        whatFailed,
        1000,
      );

  const confidence = passed
    ? 0.88
    : Math.max(0.55, Math.min(0.82, 0.55 + (failed.length ? 0.05 : 0)));

  const row = {
    user_id: SYSTEM_USER_ID,
    observation: clean(
      "Fun Zone autonomous test: " + blueprintFingerprint(blueprint),
      650,
    ),
    what_worked: clean(whatWorked || "none verified", 650),
    what_failed: whatFailed,
    lesson,
    confidence,
    evidence: clean(
      JSON.stringify({
        sourceEventKey: sourceEventKey || null,
        attempt,
        passed,
        runtimeOk: report.runtimeOk,
        inputTest: report.inputTest,
        gameplayTest: report.gameplayTest,
        objectiveChanged: report.objectiveChanged,
        playerChanged: report.playerChanged,
        restartVerified: report.restartVerified,
      }),
      1000,
    ),
    applied_to_growth: false,
  };

  const { data, error } = await client
    .from("james_reflections")
    .insert(row)
    .select("id, lesson, confidence, created_at")
    .single();

  if (error) {
    console.warn("James game learning persistence failed:", error.message);
    return null;
  }

  return data;
}


type GameCapabilityEvidence = {
  capability: string;
  passed: boolean;
  weight: number;
};

function gameCapabilities(report: TestReport): GameCapabilityEvidence[] {
  return [
    { capability: "fun-zone-runtime-observability", passed: Boolean(report.runtimeOk), weight: 1 },
    { capability: "fun-zone-rendering", passed: Boolean(report.rendered), weight: 1 },
    { capability: "fun-zone-input-reliability", passed: Boolean(report.inputTest), weight: 1 },
    { capability: "fun-zone-gameplay-state", passed: Boolean(report.gameplayTest), weight: 1 },
    { capability: "fun-zone-objective-progression", passed: Boolean(report.objectiveChanged), weight: 1.2 },
    { capability: "fun-zone-player-state", passed: Boolean(report.playerChanged), weight: 0.8 },
    { capability: "fun-zone-restart-integrity", passed: Boolean(report.restartVerified), weight: 1.1 },
  ];
}

export function gameQuality(report: TestReport) {
  const evidence = gameCapabilities(report);
  const total = evidence.reduce((sum, item) => sum + item.weight, 0);
  const passed = evidence.reduce((sum, item) => sum + (item.passed ? item.weight : 0), 0);
  return total ? Math.max(0, Math.min(1, passed / total)) : 0;
}

/**
 * Converts verified Fun Zone evidence into the same learning layers used by
 * James's broader brain, without requiring an AI provider.
 */
export async function recordJamesGameBrainEvidence(
  blueprint: GameBlueprint,
  report: TestReport,
  attempt: number,
  sourceEventKey?: string,
) {
  const client = db();
  if (!client) return null;

  if (sourceEventKey) {
    const { data: priorEvaluation } = await client
      .from("james_self_evaluations")
      .select("id, outcome, quality_score, created_at, strengths, weaknesses, evidence")
      .eq("evidence->>source_event_key", sourceEventKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorEvaluation?.id) {
      const priorEvidence = priorEvaluation.evidence && typeof priorEvaluation.evidence === "object"
        ? priorEvaluation.evidence as Record<string, unknown>
        : {};
      return {
        outcome: priorEvaluation.outcome,
        quality: Number(priorEvaluation.quality_score || 0),
        capabilities: Array.isArray(priorEvaluation.strengths) ? priorEvaluation.strengths : [],
        failedCapabilities: Array.isArray(priorEvaluation.weaknesses) ? priorEvaluation.weaknesses : [],
        selfEvaluationId: priorEvaluation.id,
        consolidationEvidence: null,
        transferEvidence: null,
        crossContextTested: false,
        adaptationPlan: [],
        strategyComparison: priorEvidence.strategy_comparison || null,
        duplicate: true,
      };
    }
  }

  const evidence = gameCapabilities(report);
  const quality = gameQuality(report);
  const passed = Boolean(report.passed);
  const capabilities = evidence.filter((item) => item.passed).map((item) => item.capability);
  const failures = evidence.filter((item) => !item.passed).map((item) => item.capability);
  const pattern = clean(
    "fun-zone:" + blueprint.world + ":" + blueprint.genre + ":" + blueprint.mechanics.slice(0, 4).join("+"),
    300,
  );
  const strategy = clean(
    passed
      ? "Generate an observable game contract with verified rendering, loop, controls, state progression, objective progression, and restart."
      : "Before increasing complexity, repair the failed runtime contract: " + (failures.join(", ") || "unknown"),
    700,
  );

  const synthesisApplied = blueprint.progression.includes("James synthesized concrete components");
  const strategyFingerprint = clean(
    [
      blueprint.world,
      blueprint.genre,
      blueprint.mechanics.slice(0, 6).join("+"),
      blueprint.playerActions.slice(0, 6).join("+"),
      blueprint.controls.slice(0, 4).join("+"),
    ].join(" | "),
    700,
  );

  const capabilityPatterns = new Map<string, {
    failed: boolean;
    transferTested: boolean;
    transferPassed: boolean;
    priorFailures: number;
  }>();

  const { data: priorEvaluations } = await client
    .from("james_self_evaluations")
    .select("quality_score, outcome, strengths, weaknesses, evidence")
    .order("created_at", { ascending: false })
    .limit(30);

  const priorStrategies = (priorEvaluations || [])
    .map((row) => {
      const evidence = row.evidence && typeof row.evidence === "object"
        ? row.evidence as Record<string, unknown>
        : {};
      return {
        strategyFingerprint:
          typeof evidence.strategy_fingerprint === "string"
            ? evidence.strategy_fingerprint
            : null,
        quality: Number(row.quality_score || 0),
        outcome: typeof row.outcome === "string" ? row.outcome : "unknown",
      };
    })
    .filter((row) => row.strategyFingerprint && row.strategyFingerprint !== strategyFingerprint);

  const currentCapabilitySet = new Set(capabilities);
  const bestPriorStrategy = priorStrategies
    .map((row) => {
      const evidence = (priorEvaluations || []).find((candidate) => {
        const candidateEvidence = candidate.evidence && typeof candidate.evidence === "object"
          ? candidate.evidence as Record<string, unknown>
          : {};
        return candidateEvidence.strategy_fingerprint === row.strategyFingerprint;
      });
      const strengths = evidence && Array.isArray(evidence.strengths)
        ? evidence.strengths.filter((value): value is string => typeof value === "string")
        : [];
      const overlap = strengths.filter((value) => currentCapabilitySet.has(value)).length;
      return { ...row, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || b.quality - a.quality)[0] || null;
  const strategyComparison = bestPriorStrategy
    ? {
        previousQuality: bestPriorStrategy.quality,
        currentQuality: quality,
        delta: Number((quality - bestPriorStrategy.quality).toFixed(4)),
        previousOutcome: bestPriorStrategy.outcome,
        capabilityOverlap: bestPriorStrategy.overlap,
        improved: quality > bestPriorStrategy.quality,
        strategyChanged: true,
        comparisonBasis: "closest-capability-strategy",
      }
    : {
        previousQuality: null,
        currentQuality: quality,
        delta: null,
        previousOutcome: null,
        improved: null,
        strategyChanged: false,
        comparisonBasis: "no-prior-comparable-strategy",
      };
  for (const item of evidence) {
    capabilityPatterns.set(item.capability, {
      failed: !item.passed,
      transferTested: false,
      transferPassed: item.passed,
      priorFailures: 0,
    });
  }

  const selfEvaluation = await client
    .from("james_self_evaluations")
    .insert({
      user_id: null,
      conversation_id: null,
      task_id: null,
      outcome: passed ? "success" : quality >= 0.5 ? "partial" : "failure",
      quality_score: quality,
      root_cause: failures.length ? "Failed capabilities: " + failures.join(", ") : null,
      strengths: capabilities,
      weaknesses: failures,
      improvements: failures.map((item) => "Improve " + item),
      provider_observations: [{ provider: "james-autonomous", model: "game-brain-v2", attempt }],
      evidence: {
        source: "fun-zone",
        pattern,
        strategy_fingerprint: strategyFingerprint,
        strategy_comparison: strategyComparison,
        blueprint: {
          world: blueprint.world,
          genre: blueprint.genre,
          mechanics: blueprint.mechanics.slice(0, 8),
          difficulty: blueprint.difficulty,
        },
        test: {
          passed,
          runtimeOk: report.runtimeOk,
          rendered: report.rendered,
          inputTest: report.inputTest,
          gameplayTest: report.gameplayTest,
          objectiveChanged: report.objectiveChanged,
          playerChanged: report.playerChanged,
          restartVerified: report.restartVerified,
          hardFailures: failures.slice(0, 8),
          softWarnings: [],
        },
      },
    })
    .select("id, outcome, quality_score, created_at")
    .maybeSingle();

  if (selfEvaluation.error) {
    console.warn("James game self-evaluation persistence failed:", selfEvaluation.error.message);
  }

  if (passed && synthesisApplied) {
    const synthesizedStrategy = clean(
      "fingerprint::" + strategyFingerprint +
        "::strategy::Synthesize proven game capabilities into a compatible blueprint: " +
        capabilities.join(", "),
      1000,
    );
    const { data: existingStrategy } = await client
      .from("james_experiences")
      .select("id, success_count, failure_count, confidence")
      .eq("pattern", pattern)
      .eq("strategy", synthesizedStrategy)
      .maybeSingle();

    const successCount = Number(existingStrategy?.success_count || 0) + 1;
    const failureCount = Number(existingStrategy?.failure_count || 0);
    const confidence = Math.min(
      0.99,
      Math.max(Number(existingStrategy?.confidence || 0.72), 0.72) +
        Math.min(0.08, successCount * 0.02),
    );

    const strategyPayload = {
      user_id: SYSTEM_USER_ID,
      pattern,
      strategy: synthesizedStrategy,
      confidence,
      success_count: successCount,
      failure_count: failureCount,
      capabilities,
      status: "active",
    };

    if (existingStrategy?.id) {
      await client
        .from("james_experiences")
        .update(strategyPayload)
        .eq("id", existingStrategy.id);
    } else {
      await client.from("james_experiences").insert(strategyPayload);
    }
  }

  // Feed verified game evidence into James's durable capability self-model.
  // This keeps Game Brain provider-free while allowing future builds to use empirical mastery.
  const failed = Array.isArray(report.hardFailures) ? report.hardFailures : [];
  const warnings = Array.isArray(report.softWarnings) ? report.softWarnings : [];

  const capabilityNames: Record<string, string> = {
    "fun-zone-runtime-observability": "Runtime observability",
    "fun-zone-rendering": "Rendering reliability",
    "fun-zone-input-reliability": "Input reliability",
    "fun-zone-gameplay-state": "Gameplay state integrity",
    "fun-zone-objective-progression": "Objective progression",
    "fun-zone-player-state": "Player state integrity",
    "fun-zone-restart-integrity": "Restart integrity",
  };

  let transferTests = 0;
  let transferSuccesses = 0;

  for (const item of evidence) {
    const { data: prior } = await client
      .from("james_self_model")
      .select("id, competence, confidence, evidence_count, success_count, failure_count")
      .eq("user_id", SYSTEM_USER_ID)
      .eq("capability_key", item.capability)
      .maybeSingle();

    const oldEvidence = Number(prior?.evidence_count || 0);
    const previousCompetence = Number(prior?.competence ?? 0.5);
    const previousConfidence = Number(prior?.confidence ?? 0.2);

    const { data: priorHistory } = await client
      .from("james_capability_mastery_history")
      .select("evidence")
      .eq("user_id", SYSTEM_USER_ID)
      .eq("capability_key", item.capability)
      .order("created_at", { ascending: false })
      .limit(24);

    const currentPattern = blueprintFingerprint(blueprint);
    const priorPatterns = (priorHistory || [])
      .map((row) => {
        const evidence = row.evidence && typeof row.evidence === "object"
          ? row.evidence as Record<string, unknown>
          : {};
        return typeof evidence.blueprint === "string" ? evidence.blueprint : "";
      })
      .filter(Boolean);
    const distinctPriorPatterns = [...new Set(priorPatterns.filter((pattern) => pattern !== currentPattern))];
    const diversityCount = new Set([currentPattern, ...priorPatterns]).size;
    const priorTransferRows = (priorHistory || []).filter((row) => {
      const evidence = row.evidence && typeof row.evidence === "object"
        ? row.evidence as Record<string, unknown>
        : {};
      return evidence.transfer_tested === true;
    });
    const priorTransferSuccesses = priorTransferRows.filter((row) => {
      const evidence = row.evidence && typeof row.evidence === "object"
        ? row.evidence as Record<string, unknown>
        : {};
      return evidence.transfer_signal === 1;
    }).length;
    const transferTested = distinctPriorPatterns.length > 0;
    const transferSignal = transferTested ? (item.passed ? 1 : 0) : null;
    const transferWeight = transferTested ? Math.min(1, distinctPriorPatterns.length / 3) : 0;
    let transferTests = priorTransferRows.length + (transferTested ? 1 : 0);
    const transferSuccessRate = transferTests
      ? (priorTransferSuccesses + (item.passed && transferTested ? 1 : 0)) / transferTests
      : null;
    const transferFailure = transferTested && !item.passed;
    const adaptationDirective = transferFailure
      ? "transfer failed; next build must alter implementation strategy for " + item.capability
      : transferTested && Number(transferSuccessRate || 0) < 0.75
        ? "transfer is unstable; vary context and strengthen " + item.capability
        : null;
    if (adaptationDirective) {
      capabilityPatterns.set(item.capability, {
        failed: !item.passed,
        transferTested: true,
        transferPassed: item.passed,
        priorFailures: priorTransferRows.length - priorTransferSuccesses,
      });
    }
    if (transferTested) {
      transferTests += 1;
      if (item.passed) transferSuccesses += 1;
    }

    const currentSignal = item.passed ? 1 : 0;
    const nextEvidence = oldEvidence + 1;
    const nextCompetence = Math.max(0, Math.min(1,
      oldEvidence === 0
        ? (item.passed ? 0.75 : 0.25)
        : previousCompetence * 0.35 + currentSignal * 0.65,
    ));
    const evidenceConfidence = Math.min(0.95, 0.2 + Math.log2(nextEvidence + 1) * 0.18);
    const diversityConfidence = Math.min(1, diversityCount / 4);
    const nextConfidence = Math.max(0.1, Math.min(0.99,
      evidenceConfidence * 0.5 + previousConfidence * 0.25 + diversityConfidence * 0.25,
    ));
    const successCount = Number(prior?.success_count || 0) + (item.passed ? 1 : 0);
    const failureCount = Number(prior?.failure_count || 0) + (item.passed ? 0 : 1);
    const generalizedTransfer = transferTests >= 3 && Number(transferSuccessRate || 0) >= 0.75;
    const status = nextEvidence >= 12 && diversityCount >= 3 && nextCompetence >= 0.85 && generalizedTransfer
      ? "strong"
      : nextEvidence >= 5 && diversityCount >= 2 && nextCompetence >= 0.70
        ? "competent"
        : nextEvidence < 2
          ? "unknown"
          : "developing";
    const nextLearningAction = status === "strong"
      ? "monitor-and-verify"
      : status === "competent"
        ? "increase-diversity-and-test"
        : "improve-and-retest";

    const payload = {
      user_id: SYSTEM_USER_ID,
      capability_key: item.capability,
      capability_name: capabilityNames[item.capability] || item.capability,
      competence: nextCompetence,
      confidence: nextConfidence,
      evidence_count: nextEvidence,
      success_count: successCount,
      failure_count: failureCount,
      teacher_providers: ["james-autonomous"],
      active_models: ["game-brain-v2"],
      last_evidence: {
        source: "fun-zone",
        attempt,
        passed: item.passed,
        quality,
        weight: item.weight,
        blueprint: currentPattern,
        diversity_count: diversityCount,
        transfer_tested: transferTested,
        transfer_signal: transferSignal,
        transfer_weight: transferWeight,
        transfer_tests: transferTests,
        transfer_success_rate: transferSuccessRate,
        adaptation_directive: adaptationDirective,
      },
      next_learning_action: nextLearningAction,
      status,
    };

    const { error: historyError } = await client
      .from("james_capability_mastery_history")
      .insert({
        user_id: SYSTEM_USER_ID,
        capability_key: item.capability,
        previous_competence: previousCompetence,
        competence: nextCompetence,
        previous_confidence: previousConfidence,
        confidence: nextConfidence,
        evidence_count: nextEvidence,
        outcome: item.passed ? "success" : "failure",
        source: "fun-zone",
        evidence: {
          attempt,
          quality,
          weight: item.weight,
          blueprint: currentPattern,
          diversity_count: diversityCount,
          transfer_tested: transferTested,
          transfer_signal: transferSignal,
          transfer_weight: transferWeight,
          prior_pattern_count: distinctPriorPatterns.length,
          transfer_tests: transferTests,
          transfer_success_rate: transferSuccessRate,
          adaptation_directive: adaptationDirective,
          strategy_fingerprint: strategyFingerprint,
          strategy_comparison: strategyComparison,
        },
      });
    if (historyError) {
      console.warn("James mastery history persistence failed:", historyError.message);
    }

    const { error: selfModelError } = await client
      .from("james_self_model")
      .upsert(payload, { onConflict: "user_id,capability_key" });
    if (selfModelError) {
      console.warn("James game self-model persistence failed:", selfModelError.message);
    }
  }

  const adaptationPlan = [...capabilityPatterns.entries()]
    .filter(([, value]) => value.transferTested && !value.transferPassed)
    .map(([capability]) => "Adapt next game strategy for " + capability)
    .slice(0, 8);

  const existing = await client
    .from("james_experiences")
    .select("id, success_count, failure_count, confidence, capabilities")
    .eq("pattern", pattern)
    .eq("status", "active")
    .maybeSingle();

  if (existing.data?.id) {
    const oldSuccess = Number(existing.data.success_count || 0);
    const oldFailure = Number(existing.data.failure_count || 0);
    const successCount = oldSuccess + (passed ? 1 : 0);
    const failureCount = oldFailure + (passed ? 0 : 1);
    const total = successCount + failureCount;
    const confidence = Math.max(0.05, Math.min(0.99, total ? successCount / total : quality));

    await client
      .from("james_experiences")
      .update({
        success_count: successCount,
        failure_count: failureCount,
        confidence,
        capabilities: [...new Set([
          ...(Array.isArray(existing.data.capabilities) ? existing.data.capabilities : []),
          ...capabilities,
        ])].slice(0, 12),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);
  } else {
    const inserted = await client
      .from("james_experiences")
      .insert({
        user_id: null,
        conversation_id: null,
        task_id: null,
        pattern,
        strategy,
        capabilities: capabilities.length ? capabilities : ["fun-zone-runtime-observability"],
        success_count: passed ? 1 : 0,
        failure_count: passed ? 0 : 1,
        confidence: quality,
        status: "active",
      })
      .select("id")
      .maybeSingle();

    if (inserted.error) {
      console.warn("James game experience persistence failed:", inserted.error.message);
    }
  }

  const existingConsolidation = await client
    .from("james_experience_consolidations")
    .select("id, evidence_count, confidence, capabilities")
    .is("user_id", null)
    .eq("merged_pattern", "fun-zone-game-brain")
    .eq("status", "active")
    .maybeSingle();

  const oldEvidence = Number(existingConsolidation.data?.evidence_count || 0);
  const nextEvidence = oldEvidence + 1;
  const nextConfidence = Math.max(
    0.05,
    Math.min(0.99, Number(existingConsolidation.data?.confidence || 0.5) * 0.35 + quality * 0.65),
  );
  const mergedCapabilities = [...new Set([
    ...(Array.isArray(existingConsolidation.data?.capabilities) ? existingConsolidation.data.capabilities : []),
    ...capabilities,
  ])].slice(0, 20);

  if (existingConsolidation.data?.id) {
    await client
      .from("james_experience_consolidations")
      .update({
        evidence_count: nextEvidence,
        confidence: nextConfidence,
        capabilities: mergedCapabilities,
        merged_strategy: strategy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingConsolidation.data.id);
  } else {
    await client.from("james_experience_consolidations").insert({
      user_id: null,
      source_experience_ids: [],
      merged_pattern: "fun-zone-game-brain",
      merged_strategy: strategy,
      capabilities: mergedCapabilities,
      confidence: quality,
      evidence_count: 1,
      status: "active",
    });
  }

  const transferEvidence = transferTests
    ? transferSuccesses / transferTests
    : null;

  return {
    outcome: passed ? "success" : quality >= 0.5 ? "partial" : "failure",
    quality,
    capabilities,
    failedCapabilities: failures,
    selfEvaluationId: selfEvaluation.data?.id || null,
    consolidationEvidence: nextEvidence,
    transferEvidence,
    crossContextTested: transferTests > 0,
    adaptationPlan,
    strategyComparison,
  };
}


export async function getJamesGameMastery(limit = 12) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_self_model")
    .select("capability_key, capability_name, competence, confidence, evidence_count, success_count, failure_count, status, next_learning_action, last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .order("competence", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    console.warn("James game mastery retrieval failed:", error.message);
    return [];
  }

  return data || [];
}

export function applyJamesGameMastery(
  blueprint: GameBlueprint,
  mastery: Array<{
    capability_key?: string | null;
    capability_name?: string | null;
    competence?: number | null;
    confidence?: number | null;
    evidence_count?: number | null;
    status?: string | null;
    last_evidence?: Record<string, unknown> | null;
  }>,
): GameBlueprint {
  const relevant = mastery
    .filter((item) => typeof item.capability_key === "string" && item.capability_key.startsWith("fun-zone-"))
    .slice(0, 8);

  if (!relevant.length) return blueprint;

  const competence = (key: string) =>
    Number(relevant.find((item) => item.capability_key === key)?.competence ?? 0.75);
  const diversity = (item: (typeof relevant)[number]) =>
    Number(item.last_evidence?.diversity_count || 1);
  const general = relevant.filter((item) =>
    Number(item.competence || 0) >= 0.75 && diversity(item) >= 3,
  );
  const contextual = relevant.filter((item) =>
    Number(item.competence || 0) >= 0.75 && diversity(item) < 3,
  );
  const developing = relevant.filter((item) =>
    Number(item.competence || 0) < 0.75,
  );
  const strong = general;

  const mechanics = [...blueprint.mechanics];
  const actions = [...blueprint.playerActions];
  const controls = [...blueprint.controls];
  const tests = [...blueprint.testRequirements];

  const add = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
  };

  // Mastery changes concrete architecture decisions, not just explanatory text.
  if (competence("fun-zone-input-reliability") < 0.75) {
    add(actions, "move");
    add(controls, "touch + keyboard movement");
    add(tests, "Verify input changes player state");
  }

  if (competence("fun-zone-objective-progression") < 0.75) {
    add(mechanics, "collect");
    add(actions, "interact");
    add(tests, "Verify objective progress changes after interaction");
  }

  if (competence("fun-zone-gameplay-state") < 0.75) {
    add(mechanics, "explore");
    add(tests, "Verify gameplay state changes after player action");
  }

  if (competence("fun-zone-player-state") < 0.75) {
    add(actions, "move");
    add(tests, "Verify player position or state changes");
  }

  if (competence("fun-zone-restart-integrity") < 0.75) {
    add(actions, "restart");
    add(controls, "restart");
    add(tests, "Verify restart restores initial gameplay state");
  }

  if (competence("fun-zone-rendering") < 0.75) {
    add(tests, "Verify non-blank canvas and visible state changes");
  }

  if (competence("fun-zone-runtime-observability") < 0.75) {
    add(tests, "Verify runtime hooks, frame advancement and observable game state");
  }

  const contextWorlds = [
    "hospital", "forest", "ocean", "space", "city", "castle", "laboratory", "desert", "village", "island",
  ];
  const contextMechanics = [
    "explore", "collect", "combat", "survival", "stealth", "racing", "puzzle", "rescue", "farming", "shooting", "escort", "dialogue",
  ];
  const currentWorld = String(blueprint.world || "").toLowerCase();
  const currentMechanics = new Set(mechanics.map((value) => value.toLowerCase()));
  const alternateWorld = contextWorlds.find((world) => world !== currentWorld) || "forest";
  const alternateMechanic = contextMechanics.find((mechanic) => !currentMechanics.has(mechanic)) || "explore";
  const contextualTargets = contextual
    .map((item) => item.capability_name || item.capability_key || "unknown")
    .slice(0, 4);
  const crossContextPlan = contextualTargets.length
    ? " James next-context plan: keep the current proven contract, then deliberately vary " +
      "world to " + alternateWorld + " and introduce mechanic " + alternateMechanic +
      " to test " + contextualTargets.join(", ") + "."
    : " James next-context plan: introduce one new world or mechanic while regression-checking generalized capabilities.";

  const masteryContext = relevant.map((item) =>
    (item.capability_name || item.capability_key || "unknown") +
    "=" + Number(item.competence || 0).toFixed(2) +
    " confidence=" + Number(item.confidence || 0).toFixed(2)
  ).join(" | ");

  const learningDirective = developing.length
    ? " Prioritize verification and robust implementation for developing capabilities: " +
      developing.map((item) => item.capability_name || item.capability_key).join(", ") + "."
    : " Maintain verified runtime contracts while exploring new mechanics.";

  const generalizationDirective = contextual.length
    ? " Treat these capabilities as context-proven rather than generally mastered: " +
      contextual.map((item) => item.capability_name || item.capability_key).join(", ") +
      ". Deliberately test them in a different world or mechanic next time."
    : " Current strong capabilities have evidence across multiple game patterns.";

  return {
    ...blueprint,
    mechanics: mechanics.slice(0, 12),
    playerActions: actions.slice(0, 16),
    controls: controls.slice(0, 12),
    progression: clean(
      blueprint.progression +
      " James capability mastery: " + masteryContext + "." +
      learningDirective + generalizationDirective +
      crossContextPlan,
      1400,
    ),
    world: contextualTargets.length && alternateWorld !== currentWorld
      ? alternateWorld
      : blueprint.world,
    testRequirements: Array.from(new Set(tests.concat(
      developing.map((item) => "Verify " + (item.capability_name || item.capability_key)),
      contextual.map((item) => "Cross-context test " + (item.capability_name || item.capability_key) +
        " in " + alternateWorld + " with " + alternateMechanic),
      strong.map((item) => "Regression-check " + (item.capability_name || item.capability_key)),
    ))).slice(0, 24),
  };
}

export async function getJamesRecoveryDirectives(limit = 4) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_experiences")
    .select("pattern, strategy, confidence, success_count, failure_count, capabilities, updated_at")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("status", "active")
    .like("pattern", "fun-zone:queue:stale-runner-recovery%")
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(10, limit)));

  if (error) {
    console.warn("James recovery directive retrieval failed:", error.message);
    return [];
  }

  return (data || []).map((item) => ({
    pattern: item.pattern,
    strategy: item.strategy,
    confidence: Number(item.confidence || 0),
    successCount: Number(item.success_count || 0),
    failureCount: Number(item.failure_count || 0),
    capabilities: Array.isArray(item.capabilities) ? item.capabilities.filter((v): v is string => typeof v === "string") : [],
  }));
}

export async function getJamesStrategyExploration() {
  const client = db();
  if (!client) return null;

  const [{ data: experiments, error }, { data: strategies }] = await Promise.all([
    client
      .from("james_game_experiments")
      .select("status,blueprint,attempt,created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    client
      .from("james_experiences")
      .select("strategy,success_count,failure_count,confidence,status,updated_at")
      .eq("user_id", SYSTEM_USER_ID)
      .like("pattern", "fun-zone:exploration:%")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  if (error) {
    console.warn("James strategy exploration retrieval failed:", error.message);
    return null;
  }

  const recentMechanics = new Set<string>();
  const recentPatterns = new Set<string>();
  for (const row of experiments || []) {
    const blueprint = row.blueprint && typeof row.blueprint === "object"
      ? row.blueprint as Record<string, unknown>
      : {};
    const mechanics = Array.isArray(blueprint.mechanics)
      ? blueprint.mechanics.filter((value): value is string => typeof value === "string")
      : [];
    mechanics.forEach((mechanic) => recentMechanics.add(mechanic));
    if (blueprint.world && blueprint.genre) {
      recentPatterns.add(String(blueprint.world) + ":" + String(blueprint.genre));
    }
  }

  const alternatives = ["puzzle", "rescue", "stealth", "collect", "explore", "survival", "racing", "dialogue"];
  const candidates = alternatives.map((mechanic) => {
    const related = (strategies || []).filter((row) =>
      typeof row.strategy === "string" && row.strategy.includes(mechanic),
    );
    const success = related.reduce((sum, row) => sum + Number(row.success_count || 0), 0);
    const failure = related.reduce((sum, row) => sum + Number(row.failure_count || 0), 0);
    const total = success + failure;
    const rate = total ? success / total : 0;
    const confidence = related.length
      ? Math.max(...related.map((row) => Number(row.confidence || 0)))
      : 0;
    const blocked = related.some((row) => row.status === "blocked");
    return {
      mechanic,
      success,
      failure,
      total,
      rate,
      confidence,
      blocked,
      novelty: recentMechanics.has(mechanic) ? 0 : 1,
    };
  }).filter((candidate) => !candidate.blocked)
    .sort((a, b) =>
      (b.novelty - a.novelty) ||
      (a.rate - b.rate) ||
      (a.confidence - b.confidence),
    );

  const selected = candidates[0] || null;
  const evidenceCount = (experiments || []).length;
  const shouldExplore = evidenceCount >= 3 && Boolean(selected);

  return {
    shouldExplore,
    novelMechanic: selected?.mechanic || null,
    recentExperimentCount: evidenceCount,
    recentMechanics: Array.from(recentMechanics).slice(0, 12),
    recentContexts: Array.from(recentPatterns).slice(0, 8),
    candidate: selected,
    strategyMemoryCount: (strategies || []).length,
  };
}

export function selectJamesLearningMode(input: {
  competence: number;
  confidence: number;
  evidenceCount: number;
  explorationAvailable: boolean;
  explorationRate?: number;
  explorationModeSuccessRate?: number;
  explorationModeConfidence?: number;
  exploitModeSuccessRate?: number;
  exploitModeConfidence?: number;
}) {
  const competence = Math.max(0, Math.min(1, input.competence));
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const evidence = Math.max(0, input.evidenceCount);
  const explorationRate = Math.max(0, Math.min(1, input.explorationRate ?? 0));
  const exploreSuccess = Math.max(0, Math.min(1, input.explorationModeSuccessRate ?? 0));
  const exploitSuccess = Math.max(0, Math.min(1, input.exploitModeSuccessRate ?? 0));
  const exploreConfidence = Math.max(0, Math.min(1, input.explorationModeConfidence ?? 0));
  const exploitConfidence = Math.max(0, Math.min(1, input.exploitModeConfidence ?? 0));

  const maturity = Math.min(1, (evidence / 12) * 0.5 + competence * 0.3 + confidence * 0.2);
  const baseExplorationPressure = input.explorationAvailable
    ? Math.max(0.15, 0.65 - maturity * 0.45 + (1 - explorationRate) * 0.1)
    : 0;

  // Historical mode memory now changes the policy rather than merely being stored.
  const exploreEvidence = exploreSuccess * 0.7 + exploreConfidence * 0.3;
  const exploitEvidence = exploitSuccess * 0.7 + exploitConfidence * 0.3;
  const historicalDelta = exploreEvidence - exploitEvidence;
  const adjustedExplorationPressure = Math.max(
    0.05,
    Math.min(0.95, baseExplorationPressure + historicalDelta * 0.35),
  );
  const exploitPressure = Math.max(0.05, 1 - adjustedExplorationPressure);
  const mode = input.explorationAvailable && adjustedExplorationPressure > exploitPressure
    ? "explore"
    : "exploit";

  return {
    mode,
    maturity: Number(maturity.toFixed(3)),
    explorationPressure: Number(adjustedExplorationPressure.toFixed(3)),
    exploitPressure: Number(exploitPressure.toFixed(3)),
    historicalDelta: Number(historicalDelta.toFixed(3)),
    reason: mode === "explore"
      ? "Historical exploration evidence supports continued bounded exploration."
      : "Historical exploitation evidence or maturity supports reuse of proven strategies.",
  };
}

export async function promoteJamesGeneralizedGameSkills(limit = 8, sourceEventKey?: string) {
  const client = db();
  if (!client) return [];

  const consolidated = await consolidateJamesTransferKnowledge(30);
  const transferable = (consolidated || []).filter((item) => item.transferable).slice(0, limit);
  const promoted = [];

  for (const item of transferable) {
    const capabilityKey = "fun-zone-core:" + clean(item.capabilityKey, 180);
    const strategy = "Generalized Game Brain skill: reuse proven capabilities across contexts only after contextual verification.";
    const { data: existing } = await client
      .from("james_self_model")
      .select("id,competence,confidence,evidence_count,success_count,failure_count,last_evidence")
      .eq("user_id", SYSTEM_USER_ID)
      .eq("capability_key", capabilityKey)
      .maybeSingle();

    const evidenceCount = Number(existing?.evidence_count || 0) + item.evidenceCount;
    const successCount = Number(existing?.success_count || 0) + Math.round(item.evidenceCount * item.successRate);
    const failureCount = Math.max(0, evidenceCount - successCount);
    const competence = Math.min(0.99, Math.max(0.1, item.successRate));
    const confidence = Math.min(0.99, Math.max(0.1, item.confidence + Math.min(0.1, item.contextCount * 0.02)));
    const priorEvidence = existing?.last_evidence && typeof existing.last_evidence === "object"
      ? existing.last_evidence as Record<string, unknown>
      : {};
    if (sourceEventKey && priorEvidence.sourceEventKey === sourceEventKey) {
      promoted.push({
        capabilityKey,
        competence: Number(competence.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
        contextCount: item.contextCount,
        evidenceCount: Number(existing?.evidence_count || 0),
        duplicate: true,
      });
      continue;
    }

    const memory = {
      user_id: SYSTEM_USER_ID,
      capability_key: capabilityKey,
      capability_name: "Generalized Game Brain: " + item.capabilityKey,
      competence,
      confidence,
      evidence_count: evidenceCount,
      success_count: successCount,
      failure_count: failureCount,
      teacher_providers: [],
      active_models: ["james-autonomous-game-brain"],
      last_evidence: {
        source: "cross-context-transfer",
        contexts: item.contexts,
        contextCount: item.contextCount,
        successRate: item.successRate,
        strategy,
        sourceEventKey: sourceEventKey || null,
      },
      next_learning_action: "Verify this generalized skill in a new context and update competence from evidence.",
      status: competence >= 0.85 && confidence >= 0.8 ? "strong" : competence >= 0.7 ? "competent" : "developing",
    };

    const result = existing?.id
      ? await client.from("james_self_model").update(memory).eq("id", existing.id)
      : await client.from("james_self_model").insert(memory);

    if (!result.error) {
      promoted.push({
        capabilityKey,
        competence: Number(competence.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
        contextCount: item.contextCount,
        evidenceCount,
      });
    }
  }

  return promoted;
}

export async function consolidateJamesTransferKnowledge(limit = 12) {
  const client = db();
  if (!client) return null;

  const { data, error } = await client
    .from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,capabilities,status")
    .eq("user_id", SYSTEM_USER_ID)
    .like("pattern", "fun-zone:transfer:%")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(Math.max(1, Math.min(30, limit)));

  if (error) {
    console.warn("James transfer consolidation retrieval failed:", error.message);
    return null;
  }

  const groups = new Map<string, { successes: number; failures: number; confidences: number[]; contexts: string[]; capabilities: string[] }>();
  for (const row of data || []) {
    const capabilities = Array.isArray(row.capabilities) ? row.capabilities.filter((v): v is string => typeof v === "string") : [];
    const key = capabilities.sort().join("+") || "general";
    const bucket = groups.get(key) || { successes: 0, failures: 0, confidences: [], contexts: [], capabilities };
    bucket.successes += Number(row.success_count || 0);
    bucket.failures += Number(row.failure_count || 0);
    bucket.confidences.push(Number(row.confidence || 0));
    bucket.contexts.push(String(row.pattern));
    groups.set(key, bucket);
  }

  const consolidated = Array.from(groups.entries()).map(([capabilityKey, bucket]) => {
    const total = bucket.successes + bucket.failures;
    const successRate = total ? bucket.successes / total : 0;
    const confidence = bucket.confidences.length
      ? bucket.confidences.reduce((sum, value) => sum + value, 0) / bucket.confidences.length
      : 0;
    return {
      capabilityKey,
      capabilities: bucket.capabilities,
      evidenceCount: total,
      successRate: Number(successRate.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      contextCount: bucket.contexts.length,
      contexts: bucket.contexts.slice(0, 8),
      transferable: bucket.contexts.length >= 2 && successRate >= 0.75,
    };
  }).sort((a, b) =>
    Number(b.transferable) - Number(a.transferable) ||
    b.successRate - a.successRate ||
    b.confidence - a.confidence,
  );

  return consolidated.slice(0, 8);
}

export async function evaluateJamesContextTransfer(
  source: { pattern?: string; strategy?: string; confidence?: number; successRate?: number },
  target: { world: string; genre: string; mechanics: string[] },
  report: TestReport,
) {
  const client = db();
  if (!client) return null;

  const targetPattern = clean(
    "fun-zone:" + target.world + ":" + target.genre + ":" + target.mechanics.slice(0, 4).join("+"),
    300,
  );
  const currentQuality = gameQuality(report);
  const transferable = report.passed === true && currentQuality >= 0.75;
  const pattern = "fun-zone:transfer:" + clean(targetPattern, 240);
  const strategy = "Transfer strategy from " + String(source.pattern || "unknown") +
    " into target context " + targetPattern + " and keep it only when evidence passes.";

  const { data: existing } = await client
    .from("james_experiences")
     .select("id,success_count,failure_count,confidence,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const successCount = Number(existing?.success_count || 0) + (transferable ? 1 : 0);
  const failureCount = Number(existing?.failure_count || 0) + (transferable ? 0 : 1);
  const total = successCount + failureCount;
  const successRate = total ? successCount / total : 0;
  const confidence = Math.min(0.99, Math.max(0.1, 0.45 + successRate * 0.45 + Math.min(0.1, total * 0.01)));
  const status = successRate < 0.4 && failureCount >= 3 ? "blocked" : "active";
  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: target.mechanics.slice(0, 6).map((mechanic) => "fun-zone-mechanic:" + mechanic),
    status,
  };

  if (existing?.id) await client.from("james_experiences").update(memory).eq("id", existing.id);
  else await client.from("james_experiences").insert(memory);

  return {
    sourcePattern: source.pattern || null,
    targetPattern,
    currentQuality,
    transferable,
    successRate: Number(successRate.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    status,
  };
}

export async function resolveJamesKnowledgeSupersession(limit = 12, sourceEventKey?: string) {
  const client = db();
  if (!client) return [];

  const versions = await getJamesKnowledgeVersions(30);
  const groups = new Map<string, typeof versions>();
  for (const version of versions) {
    const key = String(version.knowledgeKey);
    const bucket = groups.get(key) || [];
    bucket.push(version);
    groups.set(key, bucket);
  }

  const results = [];
  for (const [knowledgeKey, items] of groups.entries()) {
    const ordered = [...items].sort((a, b) => b.version - a.version);
    const latest = ordered[0];
    const prior = ordered.find((item) => item.version < latest.version);
    if (!latest) continue;

    const latestContexts = new Set(latest.contexts.map((value) => String(value)));
    const priorContexts = prior ? new Set(prior.contexts.map((value) => String(value))) : new Set<string>();
    const contextOverlap = prior && latestContexts.size
      ? [...latestContexts].filter((context) => priorContexts.has(context)).length / latestContexts.size
      : 0;

    const improved =
      !prior ||
      latest.confidence > prior.confidence ||
      latest.successCount > prior.successCount;

    const supersedes = !prior || contextOverlap >= 0.5;
    const coexistReason = !supersedes
      ? "Keep both versions: evidence suggests the newer principle may apply to a different context."
      : improved
        ? "Newer version supersedes prior knowledge because evidence/confidence improved in overlapping contexts."
        : "Retain prior version as historical evidence while the latest remains the active candidate.";

    const pattern = "fun-zone:knowledge-supersession:" + clean(knowledgeKey, 180);
    const strategy = "Resolve knowledge version supersession using context overlap and evidence improvement.";
    const { data: existing } = await client
      .from("james_experiences")
      .select("id,last_evidence")
      .eq("user_id", SYSTEM_USER_ID)
      .eq("pattern", pattern)
      .eq("strategy", strategy)
      .maybeSingle();

    const memory = {
      user_id: SYSTEM_USER_ID,
      pattern,
      strategy,
      confidence: latest.confidence,
      success_count: improved ? 1 : 0,
      failure_count: improved ? 0 : 1,
      capabilities: ["fun-zone-knowledge-supersession"],
      status: "active",
      last_evidence: {
        knowledgeKey,
        latestVersion: latest.version,
        priorVersion: prior?.version || null,
        supersedes,
        coexist: !supersedes,
        contextOverlap: Number(contextOverlap.toFixed(3)),
        reason: coexistReason,
        resolvedAt: new Date().toISOString(),
        sourceEventKey: sourceEventKey || null,
      },
    };

    const write = existing?.id
      ? await client.from("james_experiences").update(memory).eq("id", existing.id)
      : await client.from("james_experiences").insert(memory);

    if (!write.error) {
      results.push({
        knowledgeKey,
        latestVersion: latest.version,
        priorVersion: prior?.version || null,
        supersedes,
        coexist: !supersedes,
        contextOverlap: Number(contextOverlap.toFixed(3)),
        reason: coexistReason,
      });
    }
  }

  return results.slice(0, limit);
}

export async function getJamesStrategyLineage(targetContext?: string, limit = 12) {
  const client = db();
  if (!client) return [];

  let query = client
    .from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,last_evidence,status")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("status", "active")
    .contains("capabilities", ["fun-zone-strategy-lineage"])
    .order("confidence", { ascending: false })
    .limit(Math.max(1, Math.min(30, limit)));

  if (targetContext) query = query.like("pattern", "fun-zone:strategy-lineage:" + clean(targetContext, 160));

  const { data, error } = await query;
  if (error) {
    console.warn("James strategy lineage retrieval failed:", error.message);
    return [];
  }

  return (data || []).map((row) => ({
    pattern: row.pattern,
    strategy: row.strategy,
    confidence: Number(row.confidence || 0),
    successCount: Number(row.success_count || 0),
    failureCount: Number(row.failure_count || 0),
    evidence: row.last_evidence,
  }));
}

export async function evaluateJamesMutationOutcome(
  experimentPrompt: string,
  blueprint: any,
  report: { passed?: boolean; hardFailures?: string[]; softWarnings?: string[] },
  sourceEventKey?: string,
) {
  const directive = await getJamesMutationDirective(String(blueprint?.world || "fun-zone"));
  const passed = report.passed === true;
  const action = directive.action;
  const outcome = passed ? "success" : "failure";
  const mutation = action + " | " + String(experimentPrompt).slice(0, 240);

  const lineage = directive.winner?.strategy
    ? await recordJamesStrategyLineage({
        parentStrategy: directive.winner.strategy,
        childStrategy: mutation,
        targetContext: String(blueprint?.world || "fun-zone") + ":" + String(blueprint?.genre || "unknown"),
        mutation: action,
        outcome,
        sourceEventKey,
      })
    : null;

  if (directive.winner?.strategy && !lineage) {
    throw new Error("Strategy lineage could not be persisted; mutation outcome must be retried.");
  }

  return {
    action,
    outcome,
    shouldPromote: passed,
    shouldRollback: !passed && action === "rollback-and-open-new-branch",
    hardFailures: report.hardFailures || [],
    softWarnings: report.softWarnings || [],
    lineage,
  };
}

export async function recordJamesStrategyLineage(input: {
  parentStrategy: string;
  childStrategy: string;
  targetContext: string;
  mutation: string;
  outcome?: "success" | "failure" | "candidate";
  sourceEventKey?: string;
}) {
  const client = db();
  if (!client) return null;

  const pattern = "fun-zone:strategy-lineage:" + clean(input.targetContext, 160);
  const strategy = "Parent: " + input.parentStrategy + " -> Child: " + input.childStrategy;
  const { data: existing } = await client
    .from("james_experiences")
    .select("id,success_count,failure_count,confidence,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const priorEvidence = existing?.last_evidence && typeof existing.last_evidence === "object"
    ? existing.last_evidence as Record<string, unknown>
    : {};
  if (input.sourceEventKey && priorEvidence.sourceEventKey === input.sourceEventKey) {
    return { pattern, confidence: Number(existing?.confidence || 0.5), successCount: Number(existing?.success_count || 0), failureCount: Number(existing?.failure_count || 0), duplicate: true };
  }

  const successCount = Number(existing?.success_count || 0) + (input.outcome === "success" ? 1 : 0);
  const failureCount = Number(existing?.failure_count || 0) + (input.outcome === "failure" ? 1 : 0);
  const total = successCount + failureCount;
  const confidence = Math.min(0.99, Math.max(0.1, total
    ? successCount / total * 0.7 + Number(existing?.confidence || 0.5) * 0.3
    : 0.5));

  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: ["fun-zone-strategy-lineage"],
    status: "active",
    last_evidence: {
      parentStrategy: input.parentStrategy,
      childStrategy: input.childStrategy,
      mutation: input.mutation,
      targetContext: input.targetContext,
      outcome: input.outcome || "candidate",
      recordedAt: new Date().toISOString(),
      sourceEventKey: input.sourceEventKey || null,
    },
  };

  const result = existing?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.id)
    : await client.from("james_experiences").insert(memory);

  if (result.error) {
    console.warn("James strategy lineage recording failed:", result.error.message);
    return null;
  }

  return { pattern, confidence: Number(confidence.toFixed(3)), successCount, failureCount };
}

export async function recordJamesStrategyComparisonMemory(input: {
  parentStrategyId: string;
  candidateStrategyId: string;
  targetContext: string;
  mutation: string;
  parentQuality: number | null;
  candidateQuality: number;
  improvement: number | null;
  improved: boolean | null;
  blueprintDiversity?: { mutationVerified?: boolean | null; beforeFingerprint?: string | null; afterFingerprint?: string | null } | null;
  experimentId?: string;
  sourceEventKey?: string;
}) {
  const client = db();
  if (!client) return null;

  const outcome = input.improved === true ? "success" : input.improved === false ? "failure" : "candidate";
  const pattern = "fun-zone:strategy-comparison:" + clean(
    input.parentStrategyId + ":" + input.candidateStrategyId,
    220,
  );
  const strategy = "Parent " + input.parentStrategyId + " -> Candidate " + input.candidateStrategyId;
  const { data: existing } = await client
    .from("james_experiences")
    .select("id,success_count,failure_count,confidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const priorEvidence = existing?.last_evidence && typeof existing.last_evidence === "object"
    ? existing.last_evidence as Record<string, unknown>
    : {};
  if (input.sourceEventKey && priorEvidence.sourceEventKey === input.sourceEventKey) {
    return {
      pattern,
      outcome,
      confidence: Number(existing?.confidence || 0.5),
      successCount: Number(existing?.success_count || 0),
      failureCount: Number(existing?.failure_count || 0),
      duplicate: true,
    };
  }

  const successCount = Number(existing?.success_count || 0) + (outcome === "success" ? 1 : 0);
  const failureCount = Number(existing?.failure_count || 0) + (outcome === "failure" ? 1 : 0);
  const total = successCount + failureCount;
  const confidence = Math.min(
    0.99,
    Math.max(0.1, total
      ? successCount / total * 0.7 + Number(existing?.confidence || 0.5) * 0.3
      : 0.5),
  );

  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: ["fun-zone-strategy-comparison", "retired-strategy-learning"],
    status: "active",
    last_evidence: {
      parentStrategyId: input.parentStrategyId,
      candidateStrategyId: input.candidateStrategyId,
      parentQuality: input.parentQuality,
      candidateQuality: input.candidateQuality,
      improvement: input.improvement,
      improved: input.improved,
      mutation: input.mutation,
      blueprintDiversity: input.blueprintDiversity || null,
      targetContext: input.targetContext,
      experimentId: input.experimentId || null,
      sourceEventKey: input.sourceEventKey || null,
      outcome,
      lesson: input.improved === false
        ? "Candidate mutation underperformed its retired parent; preserve the parent failure evidence and avoid repeating this mutation without a materially different branch."
        : input.improved === true
          ? "Candidate mutation improved on the retired parent; retain the causal mutation as evidence for future synthesis."
          : "Candidate has no causal parent baseline yet; require fresh evidence before treating it as an improvement.",
      recordedAt: new Date().toISOString(),
    },
  };

  const result = existing?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.id)
    : await client.from("james_experiences").insert(memory);

  if (result.error) {
    console.warn("James strategy comparison memory recording failed:", result.error.message);
    return null;
  }

  return {
    pattern,
    outcome,
    confidence: Number(confidence.toFixed(3)),
    successCount,
    failureCount,
  };
}

export async function evolveJamesComposedStrategy(input: {
  strategy: string;
  sources: string[];
  targetContext: string;
  mutation: string;
}) {
  const client = db();
  if (!client) return null;

  const basePattern = "fun-zone:composed-strategy:" + clean(input.targetContext, 160);
  const strategy = input.strategy + " Mutation: " + input.mutation;
  const { data: prior } = await client
    .from("james_experiences")
    .select("id,confidence,success_count,failure_count")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", basePattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const successCount = Number(prior?.success_count || 0);
  const failureCount = Number(prior?.failure_count || 0);
  const total = successCount + failureCount;
  const confidence = Math.min(
    0.99,
    Math.max(0.1, 0.45 + (total ? successCount / total : 0.5) * 0.45 + Math.min(0.1, total * 0.01)),
  );

  return {
    pattern: basePattern,
    strategy,
    sources: input.sources,
    mutation: input.mutation,
    confidence: Number(confidence.toFixed(3)),
    evidenceCount: total,
    status: prior && failureCount >= 3 && successCount / Math.max(1, total) < 0.4 ? "blocked" : "candidate",
  };
}

export async function promoteJamesComposedStrategy(
  composition: { strategy: string | null; sources: string[]; confidence: number; compositionScore: number },
  targetContext: string,
  passed: boolean,
) {
  const client = db();
  if (!client || !composition.strategy) return null;

  const pattern = "fun-zone:composed-strategy:" + clean(targetContext, 180);
  const strategy = composition.strategy;
  const { data: existing } = await client
    .from("james_experiences")
    .select("id,success_count,failure_count")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const successCount = Number(existing?.success_count || 0) + (passed ? 1 : 0);
  const failureCount = Number(existing?.failure_count || 0) + (passed ? 0 : 1);
  const total = successCount + failureCount;
  const successRate = total ? successCount / total : 0;
  const confidence = Math.min(0.99, Math.max(0.1, composition.confidence * 0.7 + successRate * 0.3));

  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: ["fun-zone-composition", ...composition.sources.slice(0, 5)],
    status: "active",
    last_evidence: {
      source: "knowledge-composition",
      targetContext,
      compositionScore: composition.compositionScore,
      sources: composition.sources,
      successRate: Number(successRate.toFixed(3)),
      recordedAt: new Date().toISOString(),
    },
  };

  const result = existing?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.id)
    : await client.from("james_experiences").insert(memory);

  if (result.error) {
    console.warn("James composed strategy promotion failed:", result.error.message);
    return null;
  }

  return { pattern, strategy, successRate: Number(successRate.toFixed(3)), confidence: Number(confidence.toFixed(3)) };
}

export function composeJamesKnowledgeStrategies(
  knowledge: Array<{ strategy: string; confidence: number; relevance: number; successRate: number }>,
  limit = 3,
) {
  const selected = knowledge
    .filter((item) => item.relevance > 0 || item.confidence >= 0.8)
    .sort((a, b) =>
      (b.relevance * 0.5 + b.confidence * 0.3 + b.successRate * 0.2) -
      (a.relevance * 0.5 + a.confidence * 0.3 + a.successRate * 0.2),
    )
    .slice(0, Math.max(1, Math.min(5, limit)));

  if (!selected.length) {
    return {
      strategy: null,
      sources: [],
      confidence: 0,
      compositionScore: 0,
    };
  }

  const compositionScore = selected.reduce(
    (sum, item) => sum + item.relevance * 0.5 + item.confidence * 0.3 + item.successRate * 0.2,
    0,
  ) / selected.length;

  return {
    strategy: selected.map((item, index) => "Component " + (index + 1) + ": " + item.strategy).join(" | "),
    sources: selected.map((item) => item.strategy),
    confidence: Number(
      Math.min(0.99, selected.reduce((sum, item) => sum + item.confidence, 0) / selected.length).toFixed(3),
    ),
    compositionScore: Number(Math.min(0.99, compositionScore).toFixed(3)),
  };
}

export async function retrieveJamesRelevantKnowledge(input: { world: string; genre: string; mechanics: string[]; capabilityKey?: string; limit?: number }) {
  const client = db();
  if (!client) return [];
  const tokens = [input.world, input.genre, ...input.mechanics.slice(0, 6), input.capabilityKey || ""].map(String).map((v) => v.toLowerCase()).filter(Boolean);
  const { data, error } = await client.from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,capabilities,status,last_evidence")
    .eq("user_id", SYSTEM_USER_ID).eq("status", "active").like("pattern", "fun-zone:%").limit(40);
  if (error) {
    console.warn("James relevant knowledge retrieval failed:", error.message);
    return [];
  }
  return (data || []).map((row) => {
    const text = [row.pattern, row.strategy, ...(Array.isArray(row.capabilities) ? row.capabilities : [])].join(" ").toLowerCase();
    const hits = tokens.filter((token) => text.includes(token)).length;
    const relevance = tokens.length ? hits / tokens.length : 0;
    const success = Number(row.success_count || 0);
    const failure = Number(row.failure_count || 0);
    const rate = success + failure ? success / (success + failure) : 0;
    const score = relevance * 0.5 + Number(row.confidence || 0) * 0.3 + rate * 0.2;
    return { pattern: row.pattern, strategy: row.strategy, confidence: Number(row.confidence || 0), successRate: Number(rate.toFixed(3)), relevance: Number(relevance.toFixed(3)), score: Number(score.toFixed(3)), evidence: row.last_evidence };
  }).filter((item) => item.relevance > 0 || item.confidence >= 0.8)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(20, input.limit || 8)));
}

export async function getJamesActiveKnowledge(limit = 10) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_experiences")
    .select("pattern,strategy,confidence,last_evidence,status")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("status", "active")
    .like("pattern", "fun-zone:knowledge-supersession:%")
    .order("confidence", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    console.warn("James active knowledge retrieval failed:", error.message);
    return [];
  }

  return (data || []).map((row) => {
    const evidence = row.last_evidence && typeof row.last_evidence === "object"
      ? row.last_evidence as Record<string, unknown>
      : {};
    return {
      knowledgeKey: evidence.knowledgeKey || row.pattern,
      latestVersion: Number(evidence.latestVersion || 1),
      priorVersion: evidence.priorVersion ? Number(evidence.priorVersion) : null,
      supersedes: Boolean(evidence.supersedes),
      coexist: Boolean(evidence.coexist),
      contextOverlap: Number(evidence.contextOverlap || 0),
      reason: evidence.reason || row.strategy,
      confidence: Number(row.confidence || 0),
    };
  });
}

export async function getJamesKnowledgeVersions(limit = 12) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,last_evidence,status")
    .eq("user_id", SYSTEM_USER_ID)
    .like("pattern", "fun-zone:knowledge-version:%")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(30, limit)));

  if (error) {
    console.warn("James knowledge version retrieval failed:", error.message);
    return [];
  }

  return (data || []).map((row) => {
    const evidence = row.last_evidence && typeof row.last_evidence === "object"
      ? row.last_evidence as Record<string, unknown>
      : {};
    return {
      pattern: row.pattern,
      version: Number(evidence.version || 1),
      previousVersion: Number(evidence.previousVersion || 0),
      knowledgeKey: evidence.knowledgeKey || row.pattern,
      confidence: Number(row.confidence || 0),
      successCount: Number(row.success_count || 0),
      failureCount: Number(row.failure_count || 0),
      principle: evidence.principle || row.strategy,
      contexts: Array.isArray(evidence.contexts) ? evidence.contexts : [],
      recordedAt: evidence.recordedAt || null,
    };
  });
}

export async function versionJamesConsolidatedKnowledge(limit = 8, sourceEventKey?: string) {
  const client = db();
  if (!client) return [];

  const knowledge = await consolidateJamesGameKnowledge(30);
  const results = [];

  for (const item of knowledge.slice(0, limit)) {
    const pattern = "fun-zone:knowledge-version:" + clean(item.knowledgeKey, 180);
    const strategy = "Knowledge version: " + item.principle;
    const { data: existing } = await client
      .from("james_experiences")
      .select("id,success_count,failure_count,confidence,last_evidence,capabilities")
      .eq("user_id", SYSTEM_USER_ID)
      .eq("pattern", pattern)
      .eq("strategy", strategy)
      .maybeSingle();

    const previousEvidence = existing?.last_evidence && typeof existing.last_evidence === "object"
      ? existing.last_evidence as Record<string, unknown>
      : {};
    if (sourceEventKey && previousEvidence.sourceEventKey === sourceEventKey) {
      results.push({
        knowledgeKey: item.knowledgeKey,
        version: Number(previousEvidence.version || 0),
        previousVersion: Number(previousEvidence.previousVersion || 0),
        confidence: item.confidence,
        successRate: item.successRate,
        duplicate: true,
      });
      continue;
    }
    const previousVersion = Number(previousEvidence.version || 0);
    const version = previousVersion + 1;
    const memory = {
      user_id: SYSTEM_USER_ID,
      pattern,
      strategy,
      confidence: item.confidence,
      success_count: Number(existing?.success_count || 0) + (item.successRate >= 0.75 ? 1 : 0),
      failure_count: Number(existing?.failure_count || 0) + (item.successRate < 0.75 ? 1 : 0),
      capabilities: item.capabilities,
      status: "active",
      last_evidence: {
        source: "knowledge-consolidation",
        version,
        previousVersion,
        knowledgeKey: item.knowledgeKey,
        evidenceCount: item.evidenceCount,
        successRate: item.successRate,
        confidence: item.confidence,
        contexts: item.contexts,
        principle: item.principle,
        supersedes: previousVersion > 0 ? pattern + ":v" + previousVersion : null,
        recordedAt: new Date().toISOString(),
        sourceEventKey: sourceEventKey || null,
      },
    };

    const result = existing?.id
      ? await client.from("james_experiences").update(memory).eq("id", existing.id)
      : await client.from("james_experiences").insert(memory);

    if (!result.error) {
      results.push({
        knowledgeKey: item.knowledgeKey,
        version,
        previousVersion,
        confidence: item.confidence,
        successRate: item.successRate,
      });
    }
  }

  return results;
}

export async function consolidateJamesGameKnowledge(limit = 8) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,capabilities,status,updated_at")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("status", "active")
    .like("pattern", "fun-zone:%")
    .order("updated_at", { ascending: false })
    .limit(60);

  if (error) {
    console.warn("James knowledge consolidation retrieval failed:", error.message);
    return [];
  }

  const groups = new Map<string, {
    evidence: number;
    success: number;
    failure: number;
    confidence: number[];
    strategies: string[];
    patterns: string[];
  }>();

  for (const row of data || []) {
    const capabilities = Array.isArray(row.capabilities)
      ? row.capabilities.filter((value): value is string => typeof value === "string")
      : [];
    const key = capabilities.sort().slice(0, 6).join("+") || String(row.pattern);
    const group = groups.get(key) || {
      evidence: 0,
      success: 0,
      failure: 0,
      confidence: [],
      strategies: [],
      patterns: [],
    };
    group.success += Number(row.success_count || 0);
    group.failure += Number(row.failure_count || 0);
    group.evidence += Number(row.success_count || 0) + Number(row.failure_count || 0);
    group.confidence.push(Number(row.confidence || 0));
    group.strategies.push(String(row.strategy || ""));
    group.patterns.push(String(row.pattern || ""));
    groups.set(key, group);
  }

  const knowledge = Array.from(groups.entries()).map(([key, group]) => {
    const total = group.evidence;
    const successRate = total ? group.success / total : 0;
    const confidence = group.confidence.length
      ? group.confidence.reduce((sum, value) => sum + value, 0) / group.confidence.length
      : 0;
    return {
      knowledgeKey: clean("fun-zone-knowledge:" + key, 220),
      capabilities: key.split("+").filter(Boolean),
      evidenceCount: total,
      successRate: Number(successRate.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      strategyCount: new Set(group.strategies.filter(Boolean)).size,
      contexts: Array.from(new Set(group.patterns)).slice(0, 8),
      principle: successRate >= 0.75
        ? "Prefer this capability combination when context evidence is compatible."
        : "Treat this capability combination as provisional and require more contextual evidence.",
    };
  }).sort((a, b) =>
    b.confidence - a.confidence ||
    b.successRate - a.successRate ||
    b.evidenceCount - a.evidenceCount,
  );

  return knowledge.slice(0, Math.max(1, Math.min(20, limit)));
}

export async function getJamesContradictionMemory(limit = 6) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,capabilities,status")
    .eq("user_id", SYSTEM_USER_ID)
    .like("pattern", "fun-zone:contradiction:%")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    console.warn("James contradiction memory retrieval failed:", error.message);
    return [];
  }

  return (data || []).map((row) => ({
    pattern: row.pattern,
    strategy: row.strategy,
    confidence: Number(row.confidence || 0),
    failureCount: Number(row.failure_count || 0),
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
  }));
}

export async function getJamesContextualLearningMemory(
  world: string,
  genre: string,
  mechanics: string[],
) {
  const client = db();
  if (!client) return [];

  const contextTokens = [world, genre, ...mechanics.slice(0, 6)].map((v) => String(v).toLowerCase());
  const { data, error } = await client
    .from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,capabilities,status")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("status", "active")
    .like("pattern", "fun-zone:%")
    .order("confidence", { ascending: false })
    .limit(40);

  if (error) {
    console.warn("James contextual memory retrieval failed:", error.message);
    return [];
  }

  return (data || [])
    .map((row) => {
      const pattern = String(row.pattern || "").toLowerCase();
      const strategy = String(row.strategy || "").toLowerCase();
      const capabilities = Array.isArray(row.capabilities) ? row.capabilities : [];
      const contextHits = contextTokens.filter((token) =>
        token && (pattern.includes(token) || strategy.includes(token) || capabilities.some((capability) => String(capability).toLowerCase().includes(token))),
      ).length;
      const success = Number(row.success_count || 0);
      const failure = Number(row.failure_count || 0);
      const total = success + failure;
      const successRate = total ? success / total : 0;
      const relevance = contextTokens.length ? contextHits / contextTokens.length : 0;
      return {
        pattern: row.pattern,
        strategy: row.strategy,
        confidence: Number(row.confidence || 0),
        successRate: Number(successRate.toFixed(3)),
        relevance: Number(relevance.toFixed(3)),
        capabilities,
      };
    })
    .filter((row) => row.relevance > 0)
    .sort((a, b) =>
      (b.relevance - a.relevance) ||
      (b.successRate - a.successRate) ||
      (b.confidence - a.confidence),
    )
    .slice(0, 6);
}

export async function getJamesLearningModeMemory() {
  const client = db();
  if (!client) return null;

  const { data, error } = await client
    .from("james_experiences")
    .select("pattern,confidence,success_count,failure_count,status")
    .eq("user_id", SYSTEM_USER_ID)
    .like("pattern", "fun-zone:learning-mode:%")
    .order("updated_at", { ascending: false })
    .limit(4);

  if (error) {
    console.warn("James learning mode memory retrieval failed:", error.message);
    return null;
  }

  const result: Record<string, { successRate: number; confidence: number; status: string }> = {};
  for (const row of data || []) {
    const mode = String(row.pattern).replace("fun-zone:learning-mode:", "");
    const success = Number(row.success_count || 0);
    const failure = Number(row.failure_count || 0);
    const total = success + failure;
    result[mode] = {
      successRate: total ? Number((success / total).toFixed(3)) : 0,
      confidence: Number(row.confidence || 0),
      status: String(row.status || "active"),
    };
  }
  return result;
}

export async function calculateJamesEvidenceTrust(input: {
  source: string;
  quality: number;
  passed: boolean;
  contextCount?: number;
  evidenceCount?: number;
}) {
  const reliability = await getJamesEvidenceReliability(input.source);
  const quality = Math.max(0, Math.min(1, input.quality));
  const corroboration = Math.min(1, Math.max(0, (input.contextCount || 1) / 3));
  const repetition = Math.min(1, Math.max(0, (input.evidenceCount || 1) / 5));
  const trust = quality * 0.35 +
    reliability.reliability * 0.35 +
    corroboration * 0.15 +
    repetition * 0.15;

  return {
    trust: Number(Math.max(0.1, Math.min(0.99, trust)).toFixed(3)),
    sourceReliability: reliability.reliability,
    corroboration: Number(corroboration.toFixed(3)),
    repetition: Number(repetition.toFixed(3)),
  };
}

export async function getJamesEvidenceReliability(source: string) {
  const client = db();
  if (!client) return { reliability: 0.5, evidenceCount: 0 };

  const { data, error } = await client
    .from("james_experiences")
    .select("strategy,success_count,failure_count,confidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("status", "active")
    .limit(60);

  if (error) {
    console.warn("James evidence reliability retrieval failed:", error.message);
    return { reliability: 0.5, evidenceCount: 0 };
  }

  const normalized = source.toLowerCase();
  const related = (data || []).filter((row) =>
    String(row.strategy || "").toLowerCase().includes(normalized),
  );
  const success = related.reduce((sum, row) => sum + Number(row.success_count || 0), 0);
  const failure = related.reduce((sum, row) => sum + Number(row.failure_count || 0), 0);
  const total = success + failure;
  const rate = total ? success / total : 0.5;
  const confidence = related.length
    ? related.reduce((sum, row) => sum + Number(row.confidence || 0), 0) / related.length
    : 0.5;

  return {
    reliability: Number((Math.max(0.1, Math.min(0.99, rate * 0.7 + confidence * 0.3))).toFixed(3)),
    evidenceCount: total,
  };
}

export function calculateJamesEvidenceWeight(input: {
  quality: number;
  passed: boolean;
  evidenceCount?: number;
  contextCount?: number;
  isTransfer?: boolean;
  isGeneralized?: boolean;
}) {
  const quality = Math.max(0, Math.min(1, input.quality));
  const evidenceCount = Math.max(1, input.evidenceCount || 1);
  const contextCount = Math.max(1, input.contextCount || 1);
  let weight = 0.25 + quality * 0.5;
  if (input.passed) weight += 0.1;
  if (evidenceCount >= 3) weight += 0.05;
  if (contextCount >= 2) weight += 0.05;
  if (input.isTransfer) weight += 0.05;
  if (input.isGeneralized) weight += 0.1;
  return Number(Math.min(1, weight).toFixed(3));
}

export async function recordJamesCoreSkillLineage(
  capabilityKey: string,
  evidence: {
    source: string;
    quality: number;
    passed: boolean;
    context?: string;
    previousCompetence?: number;
    newCompetence?: number;
    previousConfidence?: number;
    newConfidence?: number;
    reason?: string;
    sourceEventKey?: string;
  },
) {
  const client = db();
  if (!client || !capabilityKey.startsWith("fun-zone-core:")) return null;

  const { data: current } = await client
    .from("james_self_model")
    .select("last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("capability_key", capabilityKey)
    .maybeSingle();

  const previous = current?.last_evidence && typeof current.last_evidence === "object"
    ? current.last_evidence as Record<string, unknown>
    : {};
  if (evidence.sourceEventKey && previous.sourceEventKey === evidence.sourceEventKey) {
    return previous.current || null;
  }

  const lineage = {
    source: evidence.source,
    quality: Number(Math.max(0, Math.min(1, evidence.quality)).toFixed(3)),
    passed: evidence.passed,
    context: evidence.context || null,
    previousCompetence: evidence.previousCompetence ?? null,
    newCompetence: evidence.newCompetence ?? null,
    previousConfidence: evidence.previousConfidence ?? null,
    newConfidence: evidence.newConfidence ?? null,
    reason: evidence.reason || null,
    sourceEventKey: evidence.sourceEventKey || null,
    recordedAt: new Date().toISOString(),
    previousEvidence: previous,
  };

  const { error } = await client
    .from("james_self_model")
    .update({
      last_evidence: {
        source: "evidence-lineage",
        current: lineage,
        history: Array.isArray(previous.history)
          ? [lineage, ...previous.history].slice(0, 12)
          : [lineage],
      },
    })
    .eq("user_id", SYSTEM_USER_ID)
    .eq("capability_key", capabilityKey);

  if (error) {
    console.warn("James evidence lineage recording failed:", error.message);
    return null;
  }

  return lineage;
}

export async function recordJamesKnowledgeContradiction(input: {
  capabilityKey: string;
  previousQuality: number;
  observedQuality: number;
  previousContext?: string | null;
  observedContext?: string | null;
  resolution: string;
  sourceEventKey?: string;
}) {
  const client = db();
  if (!client || !input.capabilityKey.startsWith("fun-zone-core:")) return null;

  const pattern = "fun-zone:contradiction:" + clean(input.capabilityKey, 180);
  const strategy = "Preserve contradiction history and require contextual evidence before resolving conflicting knowledge.";
  const { data: existing } = await client
    .from("james_experiences")
    .select("id,success_count,failure_count,confidence,capabilities,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const priorEvidence = existing?.last_evidence && typeof existing.last_evidence === "object"
    ? existing.last_evidence as Record<string, unknown>
    : {};
  if (input.sourceEventKey && priorEvidence.sourceEventKey === input.sourceEventKey) {
    return {
      pattern,
      contradictionMagnitude: Number(Math.abs(input.observedQuality - input.previousQuality).toFixed(3)),
      previousContext: input.previousContext || null,
      observedContext: input.observedContext || null,
      resolution: input.resolution,
      confidence: Number(existing?.confidence || 0.1),
      duplicate: true,
    };
  }

  const contradictionMagnitude = Math.abs(input.observedQuality - input.previousQuality);
  const successCount = Number(existing?.success_count || 0);
  const failureCount = Number(existing?.failure_count || 0) + 1;
  const total = successCount + failureCount;
  const confidence = Math.min(0.99, Math.max(0.1, 0.45 + Math.min(0.45, total * 0.05)));
  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: [
      input.capabilityKey,
      "fun-zone-knowledge-arbitration",
      "fun-zone-contradiction-memory",
    ],
    last_evidence: {
      ...priorEvidence,
      sourceEventKey: input.sourceEventKey || null,
      contradictionMagnitude: Number(contradictionMagnitude.toFixed(3)),
    },
    status: "active",
  };

  const result = existing?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.id)
    : await client.from("james_experiences").insert(memory);

  if (result.error) {
    console.warn("James contradiction memory failed:", result.error.message);
    return null;
  }

  return {
    pattern,
    contradictionMagnitude: Number(contradictionMagnitude.toFixed(3)),
    previousContext: input.previousContext || null,
    observedContext: input.observedContext || null,
    resolution: input.resolution,
    confidence: Number(confidence.toFixed(3)),
  };
}

export function arbitrateJamesEvidence(
  candidates: Array<{
    source: string;
    quality: number;
    trust: number;
    passed: boolean;
    context?: string | null;
    recordedAt?: string | null;
  }>,
) {
  const ranked = candidates
    .map((candidate) => {
      const quality = Math.max(0, Math.min(1, candidate.quality));
      const trust = Math.max(0.1, Math.min(0.99, candidate.trust));
      const recency = candidate.recordedAt
        ? Math.max(0, Math.min(1, 1 - Math.max(0, Date.now() - Date.parse(candidate.recordedAt)) / (90 * 86400000)))
        : 0.5;
      const corroboration = candidate.context ? 1 : 0.5;
      const score = trust * 0.45 + quality * 0.3 + recency * 0.15 + corroboration * 0.1;
      return { ...candidate, score: Number(score.toFixed(3)) };
    })
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0] || null;
  const averageQuality = ranked.length
    ? ranked.reduce((sum, item) => sum + item.quality, 0) / ranked.length
    : 0;

  return {
    winner,
    ranked,
    consensusQuality: Number(averageQuality.toFixed(3)),
    conflict: ranked.length > 1 && Math.abs(ranked[0].quality - ranked[1].quality) >= 0.2,
    reason: winner
      ? "Evidence ranked by trust, quality, recency, and contextual corroboration."
      : "No evidence candidates available.",
  };
}

export async function resolveJamesCoreSkillConflict(
  capabilityKey: string,
  observed: { competence: number; confidence: number; passed: boolean; quality: number; evidence: number },
) {
  const client = db();
  if (!client || !capabilityKey.startsWith("fun-zone-core:")) return null;

  const { data: current, error } = await client
    .from("james_self_model")
    .select("id,competence,confidence,evidence_count,success_count,failure_count,status,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("capability_key", capabilityKey)
    .maybeSingle();

  if (error || !current) return null;

  const oldCompetence = Number(current.competence || 0);
  const oldConfidence = Number(current.confidence || 0);
  const oldEvidence = Number(current.evidence_count || 0);
  const oldSuccess = Number(current.success_count || 0);
  const oldFailure = Number(current.failure_count || 0);
  const previousEvidence = current.last_evidence && typeof current.last_evidence === "object"
    ? current.last_evidence as Record<string, unknown>
    : {};
  const previousHistory = Array.isArray(previousEvidence.history) ? previousEvidence.history : [];
  const historicalCandidates = previousHistory.slice(0, 6).map((item) => {
    const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      source: String(entry.source || "historical"),
      quality: Number(entry.quality || entry.newCompetence || oldCompetence),
      trust: Number(entry.evidenceTrust || entry.newConfidence || oldConfidence),
      passed: Boolean(entry.passed),
      context: entry.context ? String(entry.context) : null,
      recordedAt: entry.recordedAt ? String(entry.recordedAt) : null,
    };
  });
  const observedQuality = Math.max(0, Math.min(1, observed.quality));
  const evidenceTrust = await calculateJamesEvidenceTrust({
    source: "fun-zone-experiment-verification",
    quality: observedQuality,
    passed: observed.passed,
    contextCount: 1,
    evidenceCount: observed.evidence,
  });
  const arbitration = arbitrateJamesEvidence([
    ...historicalCandidates,
    {
      source: "current-observation",
      quality: observedQuality,
      trust: evidenceTrust.trust,
      passed: observed.passed,
      context: "current-context",
      recordedAt: new Date().toISOString(),
    },
  ]);
  const sourceReliability = { reliability: evidenceTrust.sourceReliability, evidenceCount: 0 };
  const evidenceWeight = calculateJamesEvidenceWeight({
    quality: observedQuality,
    passed: observed.passed,
    evidenceCount: observed.evidence,
    contextCount: 1,
    isTransfer: true,
    isGeneralized: true,
  }) * evidenceTrust.trust;
  const conflict = Math.abs(observedQuality - oldCompetence) >= 0.2;
  const newEvidence = oldEvidence + Math.max(1, observed.evidence);
  const newSuccess = oldSuccess + (observed.passed ? Math.max(1, observed.evidence) : 0);
  const newFailure = oldFailure + (observed.passed ? 0 : Math.max(1, observed.evidence));
  const empiricalRate = newEvidence ? newSuccess / newEvidence : 0;
  const arbitrationQuality = arbitration.winner ? Number(arbitration.winner.quality) : observedQuality;
  const competence = Math.max(0.1, Math.min(0.99, oldCompetence * (1 - evidenceWeight) + arbitrationQuality * evidenceWeight * 0.65 + empiricalRate * evidenceWeight * 0.35));
  const confidence = Math.max(0.1, Math.min(0.99, oldConfidence * 0.4 + Math.min(0.95, 0.2 + newEvidence / 20) * 0.6));
  const status = competence >= 0.85 && confidence >= 0.8 && newEvidence >= 12
    ? "strong"
    : competence >= 0.7 && newEvidence >= 5
      ? "competent"
      : "developing";

  const result = await client.from("james_self_model").update({
    competence,
    confidence,
    evidence_count: newEvidence,
    success_count: newSuccess,
    failure_count: newFailure,
    status,
    next_learning_action: conflict
      ? "Resolve conflicting evidence with another fresh contextual experiment before increasing confidence."
      : "Continue validating this generalized skill in diverse contexts.",
    last_evidence: {
      source: "core-skill-conflict-resolution",
      conflict,
      previousCompetence: oldCompetence,
      observedQuality,
      observedPassed: observed.passed,
      observedEvidence: observed.evidence,
      evidenceWeight,
      sourceReliability: sourceReliability.reliability,
      evidenceTrust: evidenceTrust.trust,
      arbitrationScore: arbitration.winner?.score ?? null,
      arbitrationQuality,
      corroboration: evidenceTrust.corroboration,
      sourceEvidenceCount: sourceReliability.evidenceCount,
      empiricalRate: Number(empiricalRate.toFixed(3)),
    },
  }).eq("id", current.id);

  if (result.error) {
    console.warn("James core skill conflict resolution failed:", result.error.message);
    return null;
  }

  return {
    capabilityKey,
    conflict,
    previousCompetence: Number(oldCompetence.toFixed(3)),
    observedQuality: Number(observedQuality.toFixed(3)),
    competence: Number(competence.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    status,
    nextAction: conflict
      ? "Run another contextual experiment before increasing confidence."
      : "Continue diverse contextual validation.",
  };
}

export async function getJamesSkillsNeedingCorroboration(limit = 6) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_self_model")
    .select("capability_key,capability_name,competence,confidence,evidence_count,last_evidence,status")
    .eq("user_id", SYSTEM_USER_ID)
    .like("capability_key", "fun-zone-core:%")
    .neq("status", "blocked")
    .order("confidence", { ascending: true })
    .limit(20);

  if (error) {
    console.warn("James corroboration retrieval failed:", error.message);
    return [];
  }

  return (data || []).filter((skill) => {
    const evidence = skill.last_evidence && typeof skill.last_evidence === "object"
      ? skill.last_evidence as Record<string, unknown>
      : {};
    const history = Array.isArray(evidence.history) ? evidence.history : [];
    const contexts = new Set(
      history
        .map((item) => item && typeof item === "object" ? String((item as Record<string, unknown>).context || "") : "")
        .filter(Boolean),
    );
    return Number(skill.evidence_count || 0) < 5 || contexts.size < 2 || Number(skill.confidence || 0) < 0.7;
  }).slice(0, limit).map((skill) => ({
    capabilityKey: skill.capability_key,
    capabilityName: skill.capability_name,
    competence: Number(skill.competence || 0),
    confidence: Number(skill.confidence || 0),
    evidenceCount: Number(skill.evidence_count || 0),
    reason: Number(skill.evidence_count || 0) < 5
      ? "insufficient-evidence"
      : "insufficient-context-corroboration",
  }));
}

export async function revalidateJamesCoreSkills(limit = 12) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_self_model")
    .select("id,capability_key,competence,confidence,evidence_count,success_count,failure_count,status,last_evidence,next_learning_action,updated_at")
    .eq("user_id", SYSTEM_USER_ID)
    .like("capability_key", "fun-zone-core:%")
    .neq("status", "blocked")
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(30, limit)));

  if (error) {
    console.warn("James core skill revalidation retrieval failed:", error.message);
    return [];
  }

  const now = Date.now();
  const results = [];
  for (const skill of data || []) {
    const updatedAt = Date.parse(String(skill.updated_at || ""));
    const ageDays = Number.isFinite(updatedAt) ? Math.max(0, (now - updatedAt) / 86400000) : 0;
    if (ageDays < 7) continue;

    const decay = Math.min(0.12, 0.02 + Math.floor(ageDays / 30) * 0.02);
    const competence = Math.max(0.1, Number(skill.competence || 0) - decay * 0.5);
    const confidence = Math.max(0.1, Number(skill.confidence || 0) - decay);
    const status = competence >= 0.85 && confidence >= 0.8 ? "strong" : competence >= 0.7 ? "competent" : "developing";

    const result = await client.from("james_self_model").update({
      competence,
      confidence,
      status,
      next_learning_action: "Revalidate this generalized skill in a fresh context; restore confidence only with new evidence.",
      last_evidence: {
        source: "core-skill-revalidation",
        ageDays: Number(ageDays.toFixed(1)),
        decay: Number(decay.toFixed(3)),
      },
    }).eq("id", skill.id);

    if (!result.error) {
      results.push({
        capabilityKey: skill.capability_key,
        ageDays: Number(ageDays.toFixed(1)),
        competence: Number(competence.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
        status,
      });
    }
  }

  return results;
}

export async function getJamesGeneralizedCoreSkills(limit = 12) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_self_model")
    .select("capability_key,capability_name,competence,confidence,evidence_count,success_count,failure_count,status,last_evidence,next_learning_action")
    .eq("user_id", SYSTEM_USER_ID)
    .like("capability_key", "fun-zone-core:%")
    .neq("status", "blocked")
    .order("competence", { ascending: false })
    .order("confidence", { ascending: false })
    .limit(Math.max(1, Math.min(30, limit)));

  if (error) {
    console.warn("James generalized core skill retrieval failed:", error.message);
    return [];
  }

  return (data || []).map((skill) => ({
    key: skill.capability_key,
    name: skill.capability_name,
    competence: Number(skill.competence || 0),
    confidence: Number(skill.confidence || 0),
    evidenceCount: Number(skill.evidence_count || 0),
    successCount: Number(skill.success_count || 0),
    failureCount: Number(skill.failure_count || 0),
    status: skill.status,
    lastEvidence: skill.last_evidence,
    nextLearningAction: skill.next_learning_action,
  }));
}

export type JamesMutationEvidence = {
  action: string;
  successCount: number;
  failureCount: number;
  averageQuality: number;
  diversityRate: number | null;
  comparisonImprovement: number | null;
};

export type JamesMutationTournamentEntry = JamesMutationEvidence & {
  score: number;
  explorationBonus: number;
  rank: number;
};

export function runJamesMutationTournament(
  evidence: JamesMutationEvidence[],
  excludedMutations: string[] = [],
  explorationRate = 0.15,
): JamesMutationTournamentEntry[] {
  const excluded = new Set(excludedMutations);
  const pool = evidence.filter((item) => item.action && !excluded.has(item.action));
  const maxSamples = Math.max(1, ...pool.map((item) => item.successCount + item.failureCount));
  return pool.map((item) => {
    const total = item.successCount + item.failureCount;
    const successRate = total ? item.successCount / total : 0;
    const diversity = item.diversityRate === null ? 0.5 : item.diversityRate;
    const comparison = item.comparisonImprovement === null ? 0 : Math.max(-1, Math.min(1, item.comparisonImprovement));
    const evidenceStrength = Math.min(1, total / maxSamples);
    const uncertainty = 1 - evidenceStrength;
    const explorationBonus = explorationRate * uncertainty;
    const score = successRate * 0.40 +
      item.averageQuality * 0.25 +
      diversity * 0.20 +
      ((comparison + 1) / 2) * 0.10 +
      explorationBonus;
    return { ...item, score, explorationBonus };
  }).sort((a,b) => b.score-a.score || b.successCount-a.successCount)
    .map((item,index) => ({...item,rank:index+1}));
}

export function selectJamesMutationFromEvidence(
  evidence: JamesMutationEvidence[],
  fallback: string,
  excludedMutations: string[] = [],
) {
  const excluded = new Set(excludedMutations);
  const candidates = evidence.filter((item) => item.action && !excluded.has(item.action)).map((item) => {
    const total = item.successCount + item.failureCount;
    const successRate = total ? item.successCount / total : 0;
    const diversity = item.diversityRate === null ? 0.5 : item.diversityRate;
    const comparison = item.comparisonImprovement === null ? 0 : Math.max(-1, Math.min(1, item.comparisonImprovement));
    const score = successRate * 0.45 + item.averageQuality * 0.25 + diversity * 0.20 + ((comparison + 1) / 2) * 0.10;
    return { ...item, score, total };
  }).sort((a, b) => b.score - a.score || b.total - a.total);
  return candidates[0]?.action || (excluded.has(fallback) ? "rollback-and-open-new-branch" : fallback);
}

export function chooseJamesStrategyMutation(input: {
  compositionScore: number;
  confidence: number;
  failureCount?: number;
  empiricalEvidence?: JamesMutationEvidence[];
  excludedMutations?: string[];
}) {
  const failureCount = input.failureCount || 0;
  if (input.empiricalEvidence?.length) {
    const fallback = failureCount >= 3
      ? "change-one-component-and-add-regression-check"
      : input.compositionScore < 0.65
        ? "simplify-composition-and-test-one-new-component"
        : input.confidence >= 0.8
          ? "small-contextual-variation"
          : "bounded-parameter-variation";
    return selectJamesMutationFromEvidence(input.empiricalEvidence, fallback, input.excludedMutations || []);
  }
  if (failureCount >= 3) return "change-one-component-and-add-regression-check";
  if (input.compositionScore < 0.65) return "simplify-composition-and-test-one-new-component";
  if (input.confidence >= 0.8) return "small-contextual-variation";
  return "bounded-parameter-variation";
}

export function chooseJamesMutationStrategy(input: {
  tournamentScore: number;
  successRate: number;
  confidence: number;
  memoryRate: number;
  failureCount: number;
}) {
  if (input.failureCount >= 3 && input.successRate < 0.5) {
    return {
      action: "rollback-and-open-new-branch",
      reason: "Repeated failures outweigh current evidence; preserve the parent and explore a materially different branch.",
    };
  }
  if (input.tournamentScore >= 0.82 && input.successRate >= 0.8) {
    return {
      action: "preserve-and-make-small-mutation",
      reason: "Strong tournament evidence supports exploitation with a bounded contextual variation.",
    };
  }
  if (input.memoryRate >= 0.75 && input.confidence >= 0.75) {
    return {
      action: "reuse-with-contextual-mutation",
      reason: "Historical tournament memory supports reuse, but the new context should still be verified.",
    };
  }
  return {
    action: "open-new-branch",
    reason: "Evidence is not strong enough for aggressive exploitation; create a bounded alternative and compare it.",
  };
}

export async function evaluateJamesTournamentWithMemory(targetContext?: string, limit = 5) {
  const branches = await getJamesStrategyBranches(targetContext, Math.max(limit, 5));
  const memory = await getJamesTournamentMemory(targetContext, 10);
  const rankings = scoreJamesTournamentWithMemory(branches, memory).slice(0, Math.max(1, Math.min(5, limit)));
  return {
    status: rankings.length ? "memory-ranked" : "no-candidates",
    targetContext: targetContext || "global",
    winner: rankings[0] || null,
    rankings,
    memoryCount: memory.length,
    rule: "Historical tournament memory contributes bounded weight; fresh empirical evidence remains dominant.",
  };
}

export async function evaluateJamesStrategyTournament(targetContext?: string, limit = 5) {
  const branches = await getJamesStrategyBranches(targetContext, limit);
  const tournament = runJamesStrategyTournament(branches);
  return {
    targetContext: targetContext || "global",
    ...tournament,
    evaluatedAt: new Date().toISOString(),
  };
}

export async function getJamesStrategyBranches(targetContext?: string, limit = 3) {
  const lineage = await getJamesStrategyLineage(targetContext, 20);
  return selectJamesStrategyBranches(lineage, limit);
}

export async function getJamesTournamentMemory(targetContext?: string, limit = 6) {
  const client = db();
  if (!client) return [];

  let query = client
    .from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("status", "active")
    .contains("capabilities", ["fun-zone-strategy-tournament"])
    .order("confidence", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (targetContext) query = query.like("pattern", "fun-zone:tournament:" + clean(targetContext, 160));

  const { data, error } = await query;
  if (error) {
    console.warn("James tournament memory retrieval failed:", error.message);
    return [];
  }

  return (data || []).map((row) => ({
    pattern: row.pattern,
    strategy: row.strategy,
    confidence: Number(row.confidence || 0),
    successCount: Number(row.success_count || 0),
    failureCount: Number(row.failure_count || 0),
    evidence: row.last_evidence,
  }));
}

export function applyJamesMutationDirectiveToBlueprint(
  blueprint: any,
  directive: { action: string; winner?: { strategy?: string } | null },
) {
  const next = JSON.parse(JSON.stringify(blueprint));
  const addUnique = (key: string, values: string[], max = 12) => {
    next[key] = Array.from(new Set([...(Array.isArray(next[key]) ? next[key] : []), ...values])).slice(0, max);
  };
  const appendProgression = (text: string) => {
    next.progression = clean(String(next.progression || "") + " " + text, 1400);
  };
  const appendCoreLoop = (text: string) => {
    next.coreLoop = clean(String(next.coreLoop || "") + " " + text, 900);
  };
  const appendObjective = (text: string) => {
    next.objective = clean(String(next.objective || "") + " " + text, 700);
  };

  const action = directive.action;
  if (action === "rollback-and-open-new-branch") {
    // Materially change one gameplay branch while preserving the user's core concept.
    addUnique("mechanics", ["puzzle", "explore"]);
    addUnique("playerActions", ["interact", "inspect", "move"]);
    addUnique("controls", ["alternate touch interaction path"]);
    addUnique("testRequirements", [
      "failed-strategy regression check",
      "new branch verification",
      "compare changed mechanic against retired branch",
    ]);
    next.coreLoop = clean("Explore, inspect, interact, and solve a short deterministic branch before the original loop. " + String(next.coreLoop || ""), 900);
    appendObjective("Complete the alternate branch and demonstrate that the retired failure mode is not reproduced.");
    appendProgression("Mutation branch: replaced the primary interaction path with an inspect-and-puzzle branch; verify this concrete change.");
  } else if (action === "change-one-component-and-add-regression-check") {
    const seed = clean(
      String(directive.winner?.strategy || "") + "|" +
      String(next.world || "") + "|" + String(next.genre || "") + "|" +
      String(next.mechanics || ""),
      500,
    );
    const component = ["objective", "mechanics", "playerActions", "controls"][
      Math.abs([...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % 4
    ];
    if (component === "objective") {
      appendObjective("Use a single explicit intermediate checkpoint before the final win condition.");
    } else if (component === "mechanics") {
      addUnique("mechanics", ["explore"]);
    } else if (component === "playerActions") {
      addUnique("playerActions", ["inspect"]);
    } else {
      addUnique("controls", ["alternate input path"]);
    }
    addUnique("testRequirements", ["one-component mutation regression check", "compare mutated component against parent strategy"]);
    appendProgression("Mutation branch: changed exactly one bounded component (" + component + ") and retained the rest for controlled comparison.");
  } else if (action === "preserve-and-make-small-mutation") {
    addUnique("testRequirements", ["regression check for winning strategy", "contextual variation verification"]);
    appendProgression("Mutation branch: preserve proven components and vary one contextual parameter only.");
  } else if (action === "reuse-with-contextual-mutation") {
    addUnique("testRequirements", ["cross-context strategy verification", "alternate implementation path"]);
    addUnique("mechanics", ["explore"]);
    appendCoreLoop(" Apply the proven loop in the current context through an alternate implementation path.");
    appendProgression("Mutation branch: reused the proven principle with a context-specific implementation change.");
  } else {
    addUnique("mechanics", ["explore"]);
    addUnique("testRequirements", ["new strategy branch verification", "compare branch against previous evidence"]);
    appendProgression("Mutation branch: opened a bounded alternative exploration path before exploitation.");
  }

  return next;
}

export async function getJamesMutationDirective(targetContext?: string) {
  const candidateText = String(targetContext || "").toLowerCase();
  if (candidateText.includes("candidate-strategy:")) {
    if (candidateText.includes("rollback-and-open-new-branch") ||
        candidateText.includes("materially different branch") ||
        candidateText.includes("repeated failures")) {
      return {
        action: "rollback-and-open-new-branch",
        reason: "The synthesized candidate explicitly requests a materially different branch after terminal failure evidence.",
        winner: null,
      };
    }
    if (candidateText.includes("change-one-component-and-add-regression-check")) {
      return {
        action: "change-one-component-and-add-regression-check",
        reason: "The synthesized candidate requests a controlled one-component mutation with regression evidence.",
        winner: null,
      };
    }
    if (candidateText.includes("small-contextual-variation")) {
      return {
        action: "preserve-and-make-small-mutation",
        reason: "The synthesized candidate requests a bounded contextual variation.",
        winner: null,
      };
    }
  }

  const tournament = await evaluateJamesTournamentWithMemory(targetContext, 5);
  if (!tournament.winner) {
    return {
      action: "open-new-branch",
      reason: "No tournament evidence is available.",
      winner: null,
    };
  }

  const winner = tournament.winner;
  const decision = chooseJamesMutationStrategy({
    tournamentScore: Number(winner.tournamentScore || 0),
    successRate: Number(winner.empiricalSuccessRate || 0),
    confidence: Number(winner.confidence || 0),
    memoryRate: Number(winner.tournamentMemoryRate || 0),
    failureCount: Number(winner.failureCount || 0),
  });

  return { ...decision, winner };
}

export async function getJamesTournamentDirective(targetContext?: string) {
  const tournament = await evaluateJamesStrategyTournament(targetContext, 5);
  if (tournament.status !== "tournament-ready" || !tournament.winner) {
    return { status: "unavailable", directive: "No tournament winner is available; use normal bounded strategy selection." };
  }

  const winner = tournament.winner;
  return {
    status: "available",
    winnerStrategy: winner.strategy,
    winnerScore: winner.score,
    winnerSuccessRate: winner.successRate,
    winnerConfidence: winner.confidence,
    directive:
      winner.successRate >= 0.75
        ? "Prefer the tournament-leading strategy as the primary candidate, while preserving alternatives for contextual verification."
        : "Use the tournament leader only as a candidate; require fresh verification before treating it as a preferred strategy.",
  };
}

export type JamesValidatedMetaStrategy = {
  strategyId: string; taskClass: string | null; strategy: string; confidence: number;
  evidenceCount: number; successCount: number; failureCount: number; relevanceScore: number;
};

export async function getJamesValidatedMetaStrategies(input?: { taskClass?: string | null; limit?: number }) {
  const client = db(); if (!client) return [];
  const limit = Math.max(1, Math.min(10, input?.limit ?? 5));
  let query = client.from("james_meta_strategy_synthesis")
    .select("id,task_class,strategy,confidence,evidence_count,success_count,failure_count,status,updated_at")
    .eq("status", "validated").order("confidence", { ascending: false })
    .order("evidence_count", { ascending: false }).order("updated_at", { ascending: false }).limit(limit);
  if (input?.taskClass) query = query.or("task_class.eq." + input.taskClass + ",task_class.is.null");
  const { data, error } = await query;
  if (error) { console.warn("James validated meta-strategy retrieval failed:", error.message); return []; }
  return (data || []).map((row) => {
    const successCount=Number(row.success_count||0), failureCount=Number(row.failure_count||0);
    const evidenceCount=Number(row.evidence_count||(successCount+failureCount));
    const confidence=Math.max(0,Math.min(1,Number(row.confidence||0)));
    const successRate=successCount+failureCount>0?successCount/(successCount+failureCount):0.5;
    const evidenceWeight=Math.min(1,evidenceCount/10);
    return { strategyId:String(row.id), taskClass:typeof row.task_class==="string"?row.task_class:null, strategy:String(row.strategy||""), confidence,evidenceCount,successCount,failureCount,relevanceScore:Number((confidence*.45+successRate*.35+evidenceWeight*.20).toFixed(4)) };
  }).filter((item)=>item.strategy.length>0);
}
export async function getJamesRetiredStrategySynthesisDirective(input: { strategyId?: string | null; taskClass?: string | null } = {}) {
  const client = db();
  if (!client) return null;
  let query = client.from("james_meta_strategy_synthesis")
    .select("id,task_class,strategy,status,confidence,evidence_count,success_count,failure_count,updated_at")
    .eq("status", "deprecated").order("updated_at", { ascending: false }).limit(5);
  if (input.strategyId) query = query.eq("id", input.strategyId);
  if (input.taskClass) query = query.or("task_class.eq." + input.taskClass + ",task_class.is.null");
  const { data, error } = await query;
  if (error) { console.warn("James retired strategy synthesis retrieval failed:", error.message); return null; }
  const retired = (data || [])[0];
  if (!retired) return null;
  const failureCount = Number(retired.failure_count || 0);
  const evidenceCount = Number(retired.evidence_count || 0);

  // Read causal comparison memories before selecting the next mutation.
  // This prevents synthesis from blindly repeating a mutation that already
  // underperformed its retired parent.
  const { data: comparisonMemories } = await client
    .from("james_experiences")
    .select("pattern,strategy,confidence,success_count,failure_count,last_evidence")
    .eq("status", "active")
    .contains("capabilities", ["fun-zone-strategy-comparison", "retired-strategy-learning"])
    .ilike("pattern", "fun-zone:strategy-comparison:" + String(retired.id) + ":%")
    .order("updated_at", { ascending: false })
    .limit(10);

  const failedMutations = (comparisonMemories || [])
    .filter((memory) => Number(memory.failure_count || 0) > Number(memory.success_count || 0))
    .map((memory) => {
      const evidence = memory.last_evidence && typeof memory.last_evidence === "object"
        ? memory.last_evidence as Record<string, unknown>
        : {};
      return String(evidence.mutation || "retired-strategy-synthesis");
    });

  const successfulMutations = (comparisonMemories || [])
    .filter((memory) => Number(memory.success_count || 0) > Number(memory.failure_count || 0))
    .map((memory) => {
      const evidence = memory.last_evidence && typeof memory.last_evidence === "object"
        ? memory.last_evidence as Record<string, unknown>
        : {};
      return String(evidence.mutation || "retired-strategy-synthesis");
    });

  const empiricalMutationEvidence = (comparisonMemories || []).map((memory) => {
    const evidence = memory.last_evidence && typeof memory.last_evidence === "object"
      ? memory.last_evidence as Record<string, unknown>
      : {};
    const candidateQuality = Number(evidence.candidateQuality);
    const parentQuality = Number(evidence.parentQuality);
    const improvement = Number.isFinite(candidateQuality) && Number.isFinite(parentQuality)
      ? Number((candidateQuality - parentQuality).toFixed(4))
      : null;
    const diversity = evidence.blueprintDiversity && typeof evidence.blueprintDiversity === "object"
      ? evidence.blueprintDiversity as Record<string, unknown>
      : null;
    return {
      action: String(evidence.mutation || "retired-strategy-synthesis"),
      successCount: Number(memory.success_count || 0),
      failureCount: Number(memory.failure_count || 0),
      averageQuality: Number.isFinite(candidateQuality) ? candidateQuality : Number(retired.confidence || 0),
      diversityRate: diversity && typeof diversity.mutationVerified === "boolean"
        ? (diversity.mutationVerified ? 1 : 0)
        : null,
      comparisonImprovement: improvement,
    };
  });

  const mutationTournament = runJamesMutationTournament(empiricalMutationEvidence, failedMutations);

  const tournamentMemoryPattern = "fun-zone:tournament:" + String(retired.id) + ":" + String(retired.task_class || input.taskClass || "fun-zone-game-director");
  const { data: tournamentMemoryRows } = await client
    .from("james_experiences")
    .select("last_evidence,confidence,success_count,failure_count,updated_at")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", tournamentMemoryPattern)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(3);
  const rememberedTournamentRankings = (tournamentMemoryRows || [])
    .flatMap((row) => {
      const evidence = row.last_evidence && typeof row.last_evidence === "object"
        ? row.last_evidence as Record<string, unknown>
        : {};
      return Array.isArray(evidence.rankings) ? evidence.rankings : [];
    })
    .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {})
    .filter((item) => typeof item.strategy === "string" && !failedMutations.includes(String(item.strategy)))
    .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999));
  const rememberedTournamentMutation = rememberedTournamentRankings[0]
    ? String(rememberedTournamentRankings[0].strategy)
    : null;
  const tournamentMemory = (tournamentMemoryRows || []).flatMap((row) => {
    const evidence = row.last_evidence && typeof row.last_evidence === "object"
      ? row.last_evidence as Record<string, unknown>
      : {};
    const selectedMutation = String(evidence.selectedMutation || "");
    const outcomeEvents = Array.isArray(evidence.outcomeEvents)
      ? evidence.outcomeEvents
      : [];
    const successCount = Number(row.success_count || 0);
    const failureCount = Number(row.failure_count || 0);
    return selectedMutation
      ? [{
          strategy: "Tournament winner: " + selectedMutation,
          confidence: Number(row.confidence || evidence.winnerConfidence || 0),
          successCount,
          failureCount,
          outcomeEvents,
        }]
      : [];
  });

  const calibratedMutationTournament = scoreJamesMutationTournamentWithMemory(
    mutationTournament,
    tournamentMemory,
  );
  const calibratedWinner = calibratedMutationTournament[0] || null;
  const tournamentMutation = calibratedWinner?.action || rememberedTournamentMutation || null;

  if (calibratedMutationTournament.length) {
    await recordJamesTournamentMemory({
      targetContext: String(retired.id) + ":" + String(retired.task_class || input.taskClass || "fun-zone-game-director"),
      winnerStrategy: tournamentMutation || "no-selected-mutation",
      winnerScore: Number(calibratedWinner?.tournamentScore || calibratedWinner?.score || 0),
      winnerSuccessRate: calibratedWinner
        ? Number((calibratedWinner.successCount / Math.max(1, calibratedWinner.successCount + calibratedWinner.failureCount)).toFixed(4))
        : 0,
      winnerConfidence: calibratedWinner
        ? Number(calibratedWinner.averageQuality || 0)
        : 0,
      selectedMutation: tournamentMutation,
      excludedMutations: failedMutations,
      reason: "Calibrated tournament score combines fresh mutation evidence with maturity-weighted historical tournament memory while preserving exploration and failed-mutation exclusions.",
      rankings: calibratedMutationTournament.slice(0, 5).map((entry) => ({
        rank: entry.rank,
        strategy: entry.action,
        score: entry.tournamentScore,
        successRate: entry.successCount / Math.max(1, entry.successCount + entry.failureCount),
        confidence: entry.averageQuality,
        evidenceCount: entry.successCount + entry.failureCount,
        explorationBonus: entry.explorationBonus,
      })),
    });
  }

  let mutation = chooseJamesStrategyMutation({
    compositionScore: Math.max(0, Number(retired.confidence || 0) - 0.2),
    confidence: Number(retired.confidence || 0),
    failureCount: Math.max(failureCount, 3),
    empiricalEvidence: empiricalMutationEvidence,
    excludedMutations: failedMutations,
  });
  if (tournamentMutation && !failedMutations.includes(tournamentMutation)) mutation = tournamentMutation;

  // Force a materially different branch when the previous mutation is known
  // to have underperformed its parent.
  if (failedMutations.length > 0 && failedMutations.includes(mutation)) {
    mutation = failedMutations.includes("rollback-and-open-new-branch")
      ? "change-one-component-and-add-regression-check"
      : "rollback-and-open-new-branch";
  }

  const memoryInstruction = failedMutations.length
    ? " Known failed mutations: " + Array.from(new Set(failedMutations)).join(", ") + ". Do not repeat them without a materially different implementation."
    : "";
  const excludedMutations = Array.from(new Set(failedMutations)).sort();
  const branchFingerprint = excludedMutations.length
    ? excludedMutations.join("|")
    : "no-known-failed-mutation";
  const successInstruction = successfulMutations.length
    ? " Successful comparison mutations available for controlled reuse: " + Array.from(new Set(successfulMutations)).join(", ") + ". Reuse only with fresh verification."
    : "";
  const tournamentInstruction = calibratedMutationTournament.length
    ? " Calibrated mutation tournament ranking: " + calibratedMutationTournament.slice(0, 5).map((entry) =>
        entry.rank + ":" + entry.action + "=" + entry.tournamentScore.toFixed(3) +
        " memoryReliability=" + entry.tournamentMemoryReliability.toFixed(2)
      ).join(", ") + "."
    : rememberedTournamentRankings.length
      ? " Remembered mutation tournament ranking: " + rememberedTournamentRankings.slice(0, 5).map((entry) => String(entry.rank || "?") + ":" + String(entry.strategy) + "=" + Number(entry.score || 0).toFixed(3)).join(", ") + "."
      : "";

  const mutationDirective = chooseJamesMutationStrategy({
    tournamentScore: 0, successRate: 0, confidence: Number(retired.confidence || 0),
    memoryRate: 0, failureCount: Math.max(failureCount, 3),
  });
  return {
    retiredStrategyId: String(retired.id),
    taskClass: typeof retired.task_class === "string" ? retired.task_class : null,
    strategy: String(retired.strategy || ""),
    directive: { ...mutationDirective, action: mutation },
    synthesisPrompt: "A previous strategy has been terminally retired. Do not resurrect or edit it. Preserve its failure as historical evidence, identify the concrete failure mode, and create a new strategy identity using a materially different branch. Use mutation='" + mutation + "'. Evidence count=" + evidenceCount + "." + memoryInstruction + successInstruction + tournamentInstruction,
    excludedMutations,
    branchFingerprint,
  };
}

async function persistJamesRetiredStrategyCandidate(directive: {
  retiredStrategyId: string; taskClass: string | null; strategy: string; synthesisPrompt: string;
  directive: { action: string; reason: string };
  excludedMutations?: string[];
  branchFingerprint?: string;
}) {
  const client = db();
  if (!client) return null;
  const taskClass = directive.taskClass || "fun-zone-game-director";
  const mutationAction = clean(directive.directive.action, 120).replace(/[^a-zA-Z0-9_-]+/g, "-");
  const excludedMutations = Array.from(new Set(directive.excludedMutations || [])).sort();
  const branchFingerprint = clean(directive.branchFingerprint || (excludedMutations.join("|") || "no-known-failed-mutation"), 180);
  const fingerprintHash = [...branchFingerprint].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7).toString(36);
  const baseKey = clean("meta:" + taskClass + ":retired:" + directive.retiredStrategyId + ":mutation:" + mutationAction + ":branch:" + fingerprintHash, 500);
  const { data: existingRows } = await client.from("james_meta_strategy_synthesis")
    .select("id,strategy_key,task_class,strategy,status,confidence,evidence_count,success_count,failure_count,created_at")
    .like("strategy_key", baseKey + "%").order("created_at", { ascending: false }).limit(20);
  const existing = (existingRows || []).find((row) => row.status !== "deprecated") || existingRows?.[0] || null;
  if (existing?.id && existing.status !== "deprecated") {
    return {
      strategyId: String(existing.id), strategyKey: String(existing.strategy_key),
      taskClass: String(existing.task_class || taskClass), strategy: String(existing.strategy || ""),
      sourcePatterns: ["retired:" + directive.retiredStrategyId, "mutation:" + directive.directive.action, "task:" + taskClass],
      status: String(existing.status), reused: true,
    };
  }
  const deprecatedBranches = (existingRows || []).filter((row) => row.status === "deprecated");
  const branchOrdinal = deprecatedBranches.length ? deprecatedBranches.length + 1 : 0;
  const strategyKey = branchOrdinal ? baseKey + ":branch:" + branchOrdinal : baseKey;
  const strategy = clean("New branch synthesized from retired strategy " + directive.retiredStrategyId +
    ". Do not resurrect the retired identity. Apply mutation '" + directive.directive.action +
    "'. Preserve the failure as evidence and verify the new branch with fresh sandbox evidence." +
    (branchOrdinal ? " This is fresh synthesis branch " + branchOrdinal + "; do not reuse the prior candidate identity." : ""), 1000);
  const sourcePatterns = ["retired:" + directive.retiredStrategyId, "mutation:" + directive.directive.action, "task:" + taskClass,
    "branch-fingerprint:" + fingerprintHash,
    ...excludedMutations.map((value) => "excluded-mutation:" + value),
    ...(branchOrdinal ? ["fresh-branch:" + branchOrdinal] : [])];
  const { data, error } = await client.rpc("synthesize_james_meta_strategy", {
    p_strategy_key: strategyKey, p_task_class: taskClass, p_strategy: strategy,
    p_source_patterns: sourcePatterns, p_confidence: 0.5,
  });
  if (error) { console.warn("James retired-strategy candidate persistence unavailable:", error.message); return null; }
  return { strategyId: typeof data === "string" ? data : null, strategyKey, taskClass, strategy, sourcePatterns, status: "candidate", reused: false };
}

export async function createJamesGameExperimentPlan() {
  const client = db();
  if (!client) return null;

  const [{ data, error }, recoveryDirectives, exploration, modeMemory, transferKnowledge, coreSkills, corroborationTargets, contradictionMemory, consolidatedKnowledge] = await Promise.all([
    client
      .from("james_self_model")
      .select("capability_key, capability_name, competence, confidence, evidence_count, next_learning_action, status")
      .eq("user_id", SYSTEM_USER_ID)
      .order("competence", { ascending: true })
      .order("confidence", { ascending: true })
      .limit(7),
    getJamesRecoveryDirectives(4),
    getJamesStrategyExploration(),
    getJamesLearningModeMemory(),
    consolidateJamesTransferKnowledge(8),
    getJamesGeneralizedCoreSkills(8),
    getJamesSkillsNeedingCorroboration(6),
    getJamesContradictionMemory(6),
    consolidateJamesGameKnowledge(8),
    getJamesTournamentDirective(),
  ]);

  if (error) {
    console.warn("James experiment planning failed:", error.message);
    return null;
  }

  const target = (data || []).find((item) =>
    String(item.capability_key).startsWith("fun-zone-") &&
    item.status !== "strong",
  ) || (data || [])[0];

  const scoredRecoveryDirectives = recoveryDirectives
    .map((directive) => {
      const total = directive.successCount + directive.failureCount;
      const empiricalRate = total > 0 ? directive.successCount / total : 0;
      const score = empiricalRate * 0.6 + directive.confidence * 0.3 + Math.min(0.1, total * 0.01);
      return { ...directive, empiricalRate, score };
    })
    .sort((a, b) => b.score - a.score);

  const recoveryDirective = scoredRecoveryDirectives[0];
  const tournamentDirective = await getJamesTournamentDirective();
  const learningMode = selectJamesLearningMode({
    competence: Number(target?.competence || 0),
    confidence: Number(target?.confidence || 0),
    evidenceCount: Number(target?.evidence_count || 0),
    explorationAvailable: Boolean(exploration?.shouldExplore),
    explorationRate: exploration?.candidate?.rate,
    explorationModeSuccessRate: modeMemory?.explore?.successRate,
    explorationModeConfidence: modeMemory?.explore?.confidence,
    exploitModeSuccessRate: modeMemory?.exploit?.successRate,
    exploitModeConfidence: modeMemory?.exploit?.confidence,
  });
  const tournamentContext = tournamentDirective.status === "available"
    ? " Strategy tournament directive: " + tournamentDirective.directive + " Winner confidence: " + Number(tournamentDirective.winnerConfidence || 0).toFixed(3) + ", success rate: " + Number(tournamentDirective.winnerSuccessRate || 0).toFixed(3) + "."
    : "";
  const recoveryContext = recoveryDirective
    ? " Recovery directive selected from James experience memory: " +
      recoveryDirective.strategy +
      " Empirical success rate: " +
      recoveryDirective.empiricalRate.toFixed(3) +
      ", confidence: " +
      recoveryDirective.confidence.toFixed(3) +
      ". Capabilities implicated: " +
      recoveryDirective.capabilities.join(", ") +
      ". Do not repeat the previous runner/game execution pattern; make the experiment materially simpler, observable, and restartable."
    : "";

  if (!target) {
    return {
      status: "no-gap",
      title: "Game Brain verification",
      prompt: "Create a small deterministic game experiment that verifies all core runtime contracts." + recoveryContext,
      targetCapability: null,
      recoveryDirective: recoveryDirective ? {
        ...recoveryDirective,
        empiricalRate: recoveryDirective.empiricalRate,
        selectionScore: recoveryDirective.score,
      } : null,
    };
  }

  const key = String(target.capability_key);
  const relevantKnowledge = await retrieveJamesRelevantKnowledge({
    world: "unknown",
    genre: String(target.capability_name),
    mechanics: [],
    capabilityKey: key,
    limit: 6,
  });
  const validatedMetaStrategies = await getJamesValidatedMetaStrategies({ taskClass: key, limit: 5 });
  const selectedMetaStrategy = [...validatedMetaStrategies].sort((a, b) => b.relevanceScore - a.relevanceScore)[0] || null;
  const retiredStrategyDirective = await getJamesRetiredStrategySynthesisDirective({ taskClass: key });
  const synthesizedRetiredStrategy = retiredStrategyDirective ? await persistJamesRetiredStrategyCandidate(retiredStrategyDirective) : null;
  const contextualMemory = await getJamesContextualLearningMemory("unknown", String(target.capability_name), []);
  const transferCandidate = contextualMemory[0] || null;
  const generalizedTransfer = (transferKnowledge || []).find((item) => item.transferable) || null;
  const strongestCoreSkill = coreSkills[0] || null;
  const composedKnowledge = composeJamesKnowledgeStrategies(relevantKnowledge, 3);
  const mutation = chooseJamesStrategyMutation({
    compositionScore: composedKnowledge.compositionScore,
    confidence: composedKnowledge.confidence,
  });
  const evolvedComposition = composedKnowledge.strategy
    ? " Proposed bounded strategy evolution: " + mutation + "."
    : "";
  const relevantKnowledgeContext = composedKnowledge.strategy
    ? " Composed knowledge strategy: " + composedKnowledge.strategy + ". This is a new composition; keep source knowledge unchanged and verify the composition with evidence." + evolvedComposition
    : "";
  const knowledgeContext = consolidatedKnowledge.length
    ? " Consolidated knowledge: apply compatible principles from proven capability combinations, but keep provisional principles under verification."
    : "";
  const contradictionContext = contradictionMemory.length
    ? " Contradiction memory: prior conflicting evidence exists; do not repeat the same assumption. Require fresh contextual evidence before treating the strategy as general."
    : "";
  const corroborationContext = corroborationTargets.length
    ? " Corroboration targets: prioritize fresh evidence for " + corroborationTargets.slice(0, 3).map((item) => String(item.capabilityName)).join(", ") + "."
    : "";
  const coreSkillContext = strongestCoreSkill
    ? " Core skill memory: apply proven generalized skill \"" + String(strongestCoreSkill.name) + "\" with competence " + Number(strongestCoreSkill.competence).toFixed(3) + " and confidence " + Number(strongestCoreSkill.confidence).toFixed(3) + ", then verify it in this context."
    : "";
  const contextualContext = contextualMemory.length
    ? " Contextual memory: prefer strategies whose historical evidence matches this capability/context; do not generalize unrelated contexts blindly."
    : "";
  const transferContext = generalizedTransfer
    ? " Generalized transfer knowledge: this capability pattern has succeeded across multiple contexts. Reuse its core principle, but still verify the target context."
    : transferCandidate
    ? " Generalized transfer knowledge: none yet. Transfer candidate: test the strategy from source pattern \"" + String(transferCandidate.pattern) + "\" in the new experiment. Treat transfer as unproven until runtime evidence confirms it."
    : null;
  const legacyTransferContext = transferCandidate
    ? " Transfer candidate: test the strategy from source pattern \"" + String(transferCandidate.pattern) + "\" in the new experiment. Treat transfer as unproven until runtime evidence confirms it."
    : "";
  const metaStrategyContext = selectedMetaStrategy
    ? " Validated meta-strategy selected from lifecycle state: \"" + selectedMetaStrategy.strategy + "\". Confidence=" + selectedMetaStrategy.confidence.toFixed(3) + ", success=" + selectedMetaStrategy.successCount + ", failure=" + selectedMetaStrategy.failureCount + ", evidence=" + selectedMetaStrategy.evidenceCount + ". Use as bounded guidance and allow fresh runtime evidence to override it."
    : " No validated meta-strategy is available for this capability; remain exploratory and generate fresh evidence.";
  const retirementContext = retiredStrategyDirective
    ? " Retired-strategy synthesis directive: " + retiredStrategyDirective.synthesisPrompt
    : "";
  const synthesizedStrategyContext = synthesizedRetiredStrategy
    ? " Newly synthesized candidate strategy: \"" + synthesizedRetiredStrategy.strategy +
      "\". Candidate status=" + String(synthesizedRetiredStrategy.status || "candidate") +
      ". Strategy ID=" + String(synthesizedRetiredStrategy.strategyId || "pending") +
      ". This candidate must be exercised in this experiment and judged only from fresh sandbox evidence."
    : "";
  const capabilityPrompt =
    key.includes("input")
      ? "Create a small game focused on reliable keyboard and touch movement with an alternate input path."
      : key.includes("objective")
        ? "Create a small game focused on clear objective progression through interaction and collection."
        : key.includes("gameplay-state")
          ? "Create a small game focused on deterministic gameplay state transitions."
          : key.includes("restart")
            ? "Create a small game focused on restart integrity and restoring initial state."
            : key.includes("rendering")
              ? "Create a small game focused on non-blank rendering and visible state changes."
              : key.includes("runtime")
                ? "Create a small game focused on runtime loop, observability hooks, and stable frame progression."
                : "Create a small game experiment that strengthens the weakest Game Brain capability.";

  return {
    status: "experiment",
    title: "James Game Brain experiment: " + String(target.capability_name),
    prompt: capabilityPrompt + relevantKnowledgeContext + knowledgeContext + coreSkillContext + contradictionContext + corroborationContext + contextualContext + transferContext + metaStrategyContext + retirementContext + synthesizedStrategyContext + tournamentContext + recoveryContext +
      (learningMode.mode === "explore" && exploration?.novelMechanic
        ? " Exploration directive: deliberately test the novel mechanic \""+ exploration.novelMechanic + "\" instead of repeating the most recent proven mechanic set. Compare its evidence against the current strategy."
        : " Exploitation directive: reuse proven strategy components first, while preserving regression checks and measurable evidence."),
    targetCapability: {
      key,
      name: target.capability_name,
      competence: Number(target.competence || 0),
      confidence: Number(target.confidence || 0),
      evidenceCount: Number(target.evidence_count || 0),
      nextLearningAction: target.next_learning_action,
    },
    recoveryDirective: recoveryDirective || null,
    exploration: exploration || null,
    learningMode,
    contextualMemory,
    transferCandidate,
    generalizedTransfer,
    coreSkills,
    corroborationTargets,
    contradictionMemory,
    consolidatedKnowledge,
    relevantKnowledge,
    composedKnowledge,
    selectedMetaStrategy,
    validatedMetaStrategies: validatedMetaStrategies.slice(0, 5),
    synthesizedRetiredStrategy,
  };
}

export async function getJamesEffectiveStrategies(limit = 8) {
  const client = db();
  if (!client) return [];

  const max = Math.max(1, Math.min(20, limit));
  const [evaluations, experiences] = await Promise.all([
    client
      .from("james_self_evaluations")
      .select("quality_score, outcome, strengths, evidence")
      .eq("outcome", "success")
      .order("quality_score", { ascending: false })
      .limit(max * 3),
    client
      .from("james_experiences")
      .select("pattern, strategy, confidence, success_count, failure_count, capabilities")
      .eq("status", "active")
      .gt("success_count", 0)
      .order("confidence", { ascending: false })
      .order("success_count", { ascending: false })
      .limit(max * 3),
  ]);

  if (evaluations.error) {
    console.warn("James effective self-evaluation retrieval failed:", evaluations.error.message);
  }
  if (experiences.error) {
    console.warn("James effective experience retrieval failed:", experiences.error.message);
  }

  const learned = (evaluations.data || [])
    .map((row) => {
      const evidence = row.evidence && typeof row.evidence === "object"
        ? row.evidence as Record<string, unknown>
        : {};
      return {
        strategy_fingerprint:
          typeof evidence.strategy_fingerprint === "string"
            ? evidence.strategy_fingerprint
            : null,
        strategy_comparison:
          evidence.strategy_comparison && typeof evidence.strategy_comparison === "object"
            ? evidence.strategy_comparison as Record<string, unknown>
            : null,
        quality: Number(row.quality_score || 0),
        strengths: Array.isArray(row.strengths)
          ? row.strengths.filter((value): value is string => typeof value === "string")
          : [],
      };
    })
    .filter((item) => item.strategy_fingerprint);

  // Reuse strategies that survived promotion into durable Experience memory.
  // The fingerprint is stored inside the strategy record so it remains provider-free
  // and can reconstruct concrete mechanics/actions/controls on future builds.
  const experienceStrategies = (experiences.data || [])
    .map((row) => {
      const strategy = typeof row.strategy === "string" ? row.strategy : "";
      const fingerprintMatch = strategy.match(/fingerprint::([^]+?)\s*::strategy::/);
      const fingerprint = fingerprintMatch?.[1] || null;
      const successCount = Number(row.success_count || 0);
      const failureCount = Number(row.failure_count || 0);
      const quality = successCount + failureCount > 0
        ? successCount / (successCount + failureCount)
        : Number(row.confidence || 0);
      return {
        strategy_fingerprint: fingerprint,
        quality,
        strengths: Array.isArray(row.capabilities)
          ? row.capabilities.filter((value): value is string => typeof value === "string")
          : [],
      };
    })
    .filter((item) => item.strategy_fingerprint && item.quality >= 0.75);

  const deduped = new Map<string, {
    strategy_fingerprint: string;
    quality: number;
    strengths: string[];
  }>();
  for (const item of [...learned, ...experienceStrategies]) {
    if (!item.strategy_fingerprint) continue;
    const previous = deduped.get(item.strategy_fingerprint);
    if (!previous || item.quality > previous.quality) {
      deduped.set(item.strategy_fingerprint, {
        strategy_fingerprint: item.strategy_fingerprint,
        quality: item.quality,
        strengths: item.strengths || [],
      });
    }
  }

  return [...deduped.values()]
    .sort((a, b) => b.quality - a.quality)
    .slice(0, max);
}

export async function getJamesFailedStrategies(limit = 8) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_experiences")
    .select("id, pattern, strategy, confidence, success_count, failure_count, capabilities, status, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    console.warn("James failed-strategy retrieval failed:", error.message);
    return [];
  }

  return (data || [])
    .filter((item) => Number(item.success_count || 0) + Number(item.failure_count || 0) > 0)
    .map((item) => ({
      id: item.id,
      pattern: item.pattern,
      strategy: item.strategy,
      confidence: item.confidence,
      success_count: Number(item.success_count || 0),
      failure_count: Number(item.failure_count || 0),
      capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
      success_rate: (Number(item.success_count || 0) + Number(item.failure_count || 0)) > 0
        ? Number(item.success_count || 0) /
          (Number(item.success_count || 0) + Number(item.failure_count || 0))
        : 0,
    }))
    .sort((a, b) => a.success_rate - b.success_rate || b.failure_count - a.failure_count)
    .slice(0, Math.max(1, Math.min(20, limit)));
}

export async function getJamesGameAdaptations(limit = 8) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_self_model")
    .select("capability_key, capability_name, competence, confidence, last_evidence, next_learning_action")
    .eq("user_id", SYSTEM_USER_ID)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    console.warn("James game adaptation retrieval failed:", error.message);
    return [];
  }

  return (data || [])
    .map((item) => {
      const evidence = item.last_evidence && typeof item.last_evidence === "object"
        ? item.last_evidence as Record<string, unknown>
        : {};
      return {
        capability_key: item.capability_key,
        capability_name: item.capability_name,
        competence: item.competence,
        confidence: item.confidence,
        next_learning_action: item.next_learning_action,
        adaptation_directive:
          typeof evidence.adaptation_directive === "string"
            ? evidence.adaptation_directive
            : null,
        transfer_success_rate:
          typeof evidence.transfer_success_rate === "number"
            ? evidence.transfer_success_rate
            : null,
      };
    })
    .filter((item) => Boolean(item.adaptation_directive))
    .slice(0, Math.max(1, Math.min(20, limit)));
}

function selectTransferAdaptation<T extends {
  capability_key?: string | null;
  transfer_success_rate?: number | null;
}>(items: T[]) {
  return [...items]
    .filter((item) => typeof item.capability_key === "string")
    .sort((a, b) => {
      const ar = Number(a.transfer_success_rate ?? 1);
      const br = Number(b.transfer_success_rate ?? 1);
      return ar - br;
    });
}

export async function evaluateJamesRecoveryDirectiveImpact(
  experimentPrompt: string | null | undefined,
  blueprint: GameBlueprint,
  report: TestReport,
  sourceEventKey?: string,
) {
  const client = db();
  if (!client) return null;

  const influenced = typeof experimentPrompt === "string" &&
    (experimentPrompt.includes("Recovery directive from previous abandoned runners") ||
      experimentPrompt.includes("Recovery directive selected from James experience memory:"));
  if (!influenced) {
    return {
      influenced: false,
      evaluated: false,
      reason: "Experiment was not marked as recovery-directive influenced.",
    };
  }

  const currentQuality = gameQuality(report);
  const currentOutcome = report.passed ? "success" : currentQuality >= 0.5 ? "partial" : "failure";
  const { data: prior } = await client
    .from("james_self_evaluations")
    .select("quality_score,outcome,evidence,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const pattern = clean(
    "fun-zone:" + blueprint.world + ":" + blueprint.genre + ":" + blueprint.mechanics.slice(0, 4).join("+"),
    300,
  );

  const baseline = (prior || []).find((row) => {
    const evidence = row.evidence && typeof row.evidence === "object"
      ? row.evidence as Record<string, unknown>
      : {};
    return evidence.pattern === pattern;
  });

  if (!baseline) {
    return {
      influenced: true,
      evaluated: false,
      currentQuality,
      currentOutcome,
      baselineQuality: null,
      improvement: null,
      directiveEffective: null,
      reason: "No comparable pre-directive experiment exists yet.",
    };
  }

  const baselineQuality = Number(baseline.quality_score || 0);
  const improvement = Number((currentQuality - baselineQuality).toFixed(4));
  const directiveEffective = improvement > 0 && report.passed === true;

  const strategyPattern = "fun-zone:recovery-directive";
  const strategy = "Apply recovery directive only when it improves comparable experiment quality without repeating stale-runner execution failures.";
  const { data: existing } = await client
    .from("james_experiences")
    .select("id,success_count,failure_count,confidence,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", strategyPattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const priorEvidence = existing?.last_evidence && typeof existing.last_evidence === "object"
    ? existing.last_evidence as Record<string, unknown>
    : {};
  if (sourceEventKey && priorEvidence.sourceEventKey === sourceEventKey) {
    const priorTotal = Number(existing?.success_count || 0) + Number(existing?.failure_count || 0);
    return {
      influenced: true,
      evaluated: true,
      currentQuality,
      currentOutcome,
      baselineQuality,
      baselineOutcome: baseline.outcome,
      improvement,
      directiveEffective,
      duplicate: true,
      directiveMemory: {
        successCount: Number(existing?.success_count || 0),
        failureCount: Number(existing?.failure_count || 0),
        successRate: Number((priorTotal ? Number(existing?.success_count || 0) / priorTotal : 0).toFixed(3)),
        confidence: Number(existing?.confidence || 0.1),
      },
    };
  }

  const successCount = Number(existing?.success_count || 0) + (directiveEffective ? 1 : 0);
  const failureCount = Number(existing?.failure_count || 0) + (directiveEffective ? 0 : 1);
  const total = successCount + failureCount;
  const rate = total ? successCount / total : 0;
  const confidence = Math.min(0.99, Math.max(0.1, 0.45 + rate * 0.45 + Math.min(0.1, total * 0.01)));
  const status = rate < 0.4 && failureCount >= 3 ? "blocked" : "active";

  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern: strategyPattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: ["fun-zone-runtime-observability", "fun-zone-restart-integrity"],
    status,
    last_evidence: {
      source: "recovery-directive-impact",
      sourceEventKey: sourceEventKey || null,
      directiveEffective,
      improvement,
      baselineQuality,
      currentQuality,
    },
  };

  const persistence = existing?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.id)
    : await client.from("james_experiences").insert(memory);

  if (persistence.error) {
    console.warn("James recovery directive impact persistence failed:", persistence.error.message);
    throw new Error("Recovery directive impact could not be persisted; verification will resume this stage.");
  }

  return {
    influenced: true,
    evaluated: true,
    currentQuality,
    currentOutcome,
    baselineQuality,
    baselineOutcome: baseline.outcome,
    improvement,
    directiveEffective,
    comparisonBasis: "same-world-genre-mechanics-pattern",
    directiveMemory: {
      successCount,
      failureCount,
      successRate: Number(rate.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      status,
    },
  };
}

export async function evaluateJamesExploreExploitImpact(
  experimentPrompt: string | null | undefined,
  blueprint: GameBlueprint,
  report: TestReport,
  sourceEventKey?: string,
) {
  const client = db();
  if (!client || typeof experimentPrompt !== "string") return null;

  const mode = experimentPrompt.includes("Exploration directive:")
    ? "explore"
    : experimentPrompt.includes("Exploitation directive:")
      ? "exploit"
      : null;
  if (!mode) return null;

  const currentQuality = gameQuality(report);
  const { data: prior } = await client
    .from("james_self_evaluations")
    .select("quality_score,outcome,evidence,created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const pattern = clean(
    "fun-zone:" + blueprint.world + ":" + blueprint.genre + ":" + blueprint.mechanics.slice(0, 4).join("+"),
    300,
  );
  const comparable = (prior || []).filter((row) => {
    const evidence = row.evidence && typeof row.evidence === "object"
      ? row.evidence as Record<string, unknown>
      : {};
    return evidence.pattern === pattern;
  });

  const baseline = comparable[0];
  if (!baseline) {
    return {
      mode,
      evaluated: false,
      currentQuality,
      reason: "No comparable prior experiment exists for Explore/Exploit comparison.",
    };
  }

  const baselineQuality = Number(baseline.quality_score || 0);
  const improvement = Number((currentQuality - baselineQuality).toFixed(4));
  const better = report.passed === true && improvement > 0;

  const strategyPattern = "fun-zone:learning-mode:" + mode;
  const strategy = "Use " + mode + " mode when its measured experiment quality improves over the comparable prior strategy.";
  const { data: existing } = await client
    .from("james_experiences")
    .select("id,success_count,failure_count,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", strategyPattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const priorEvidence = existing?.last_evidence && typeof existing.last_evidence === "object"
    ? existing.last_evidence as Record<string, unknown>
    : {};
  if (sourceEventKey && priorEvidence.sourceEventKey === sourceEventKey) {
    const priorTotal = Number(existing?.success_count || 0) + Number(existing?.failure_count || 0);
    return {
      mode,
      evaluated: true,
      currentQuality,
      baselineQuality,
      improvement,
      better,
      successRate: Number((priorTotal ? Number(existing?.success_count || 0) / priorTotal : 0).toFixed(3)),
      confidence: Number(existing?.confidence || 0.1),
      duplicate: true,
    };
  }

  const successCount = Number(existing?.success_count || 0) + (better ? 1 : 0);
  const failureCount = Number(existing?.failure_count || 0) + (better ? 0 : 1);
  const total = successCount + failureCount;
  const successRate = total ? successCount / total : 0;
  const confidence = Math.min(0.99, Math.max(0.1, 0.45 + successRate * 0.45 + Math.min(0.1, total * 0.01)));
  const status = successRate < 0.4 && failureCount >= 3 ? "blocked" : "active";
  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern: strategyPattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: ["fun-zone-strategy-selection"],
    status,
    last_evidence: {
      source: "learning-mode",
      sourceEventKey: sourceEventKey || null,
      mode,
      better,
      improvement,
      baselineQuality,
      currentQuality,
    },
  };

  const persistence = existing?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.id)
    : await client.from("james_experiences").insert(memory);

  if (persistence.error) {
    console.warn("James learning-mode persistence failed:", persistence.error.message);
    throw new Error("Learning mode impact could not be persisted; verification will resume this stage.");
  }

  return {
    mode,
    evaluated: true,
    currentQuality,
    baselineQuality,
    improvement,
    better,
    successRate: Number(successRate.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    status,
  };
}

export async function promoteJamesExplorationResult(
  experimentPrompt: string | null | undefined,
  blueprint: GameBlueprint,
  report: TestReport,
  sourceEventKey?: string,
) {
  const client = db();
  if (!client || typeof experimentPrompt !== "string" || !experimentPrompt.includes("Exploration directive:")) {
    return { explored: false, promoted: false };
  }

  const pattern = clean(
    "fun-zone:exploration:" + blueprint.world + ":" + blueprint.genre,
    300,
  );
  const mechanics = blueprint.mechanics.slice(0, 6).join("+");
  const strategy = "Exploration strategy: test novel mechanic set " + mechanics + " and promote it only when runtime evidence passes.";
  const { data: existing } = await client
    .from("james_experiences")
    .select("id,success_count,failure_count,confidence,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("strategy", strategy)
    .maybeSingle();

  const priorEvidence = existing?.last_evidence && typeof existing.last_evidence === "object"
    ? existing.last_evidence as Record<string, unknown>
    : {};
  if (sourceEventKey && priorEvidence.sourceEventKey === sourceEventKey) {
    return {
      explored: true,
      promoted: report.passed,
      successRate: Number((Number(existing?.success_count || 0) / Math.max(1, Number(existing?.success_count || 0) + Number(existing?.failure_count || 0))).toFixed(3)),
      confidence: Number(existing?.confidence || 0),
      duplicate: true,
    };
  }

  const successCount = Number(existing?.success_count || 0) + (report.passed ? 1 : 0);
  const failureCount = Number(existing?.failure_count || 0) + (report.passed ? 0 : 1);
  const total = successCount + failureCount;
  const successRate = total ? successCount / total : 0;
  const confidence = Math.min(0.99, Math.max(0.1, 0.45 + successRate * 0.45 + Math.min(0.1, total * 0.01)));
  const status = successRate < 0.4 && failureCount >= 3 ? "blocked" : "active";

  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: blueprint.mechanics.slice(0, 6).map((mechanic) => "fun-zone-mechanic:" + mechanic),
    status,
    last_evidence: {
      source: "exploration-promotion",
      sourceEventKey: sourceEventKey || null,
      passed: report.passed === true,
      mechanics,
    },
  };

  const result = existing?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.id)
    : await client.from("james_experiences").insert(memory);

  if (result.error) {
    console.warn("James exploration promotion failed:", result.error.message);
    throw new Error("Exploration promotion could not be persisted; verification will resume this stage.");
  }

  return {
    explored: true,
    promoted: report.passed,
    successRate: Number(successRate.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    status,
  };
}

export async function evolveJamesStrategyMemory(
  blueprint: GameBlueprint,
  report: TestReport,
  sourceEventKey?: string,
) {
  const client = db();
  if (!client) return null;

  const pattern = clean(
    "fun-zone:" + blueprint.world + ":" + blueprint.genre + ":" + blueprint.mechanics.slice(0, 4).join("+"),
    300,
  );
  const { data: rows, error } = await client
    .from("james_experiences")
    .select("id, pattern, strategy, confidence, success_count, failure_count, capabilities,last_evidence")
    .eq("status", "active")
    .limit(40);

  if (error) {
    console.warn("James strategy evolution retrieval failed:", error.message);
    return null;
  }

  const relevant = (rows || []).filter((row) => {
    const capabilities = Array.isArray(row.capabilities) ? row.capabilities : [];
    const strategy = typeof row.strategy === "string" ? row.strategy : "";
    return row.pattern === pattern || capabilities.some((capability) =>
      strategy.includes(capability) ||
      blueprint.testRequirements.some((test) => test.includes(capability)),
    );
  });

  const updates = [];
  for (const row of relevant) {
    const success = Number(row.success_count || 0);
    const failure = Number(row.failure_count || 0);
    const total = success + failure;
    if (!total) continue;

    const rate = success / total;
    // Confidence follows repeated empirical evidence, not a single success.
    const confidence = Math.max(
      0.1,
      Math.min(0.99, 0.45 + rate * 0.45 + Math.min(0.1, total * 0.01)),
    );
    const status = rate >= 0.8 && total >= 3
      ? "active"
      : rate < 0.4 && failure >= 3
        ? "blocked"
        : "active";

    const priorEvidence = row.last_evidence && typeof row.last_evidence === "object"
      ? row.last_evidence as Record<string, unknown>
      : {};
    if (sourceEventKey && priorEvidence.strategyEvolutionEventKey === sourceEventKey) {
      continue;
    }

    const result = await client
      .from("james_experiences")
      .update({
        confidence,
        status,
        last_evidence: {
          ...priorEvidence,
          strategyEvolutionEventKey: sourceEventKey || null,
          strategyEvolutionOutcome: report.passed ? "success" : "failure",
          strategyEvolutionRecordedAt: new Date().toISOString(),
        },
      })
      .eq("id", row.id);

    if (!result.error) {
      updates.push({
        id: row.id,
        pattern: row.pattern,
        successRate: Number(rate.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
        status,
      });
    }
  }

  return {
    pattern,
    currentOutcome: report.passed ? "success" : "failure",
    evolvedStrategies: updates,
  };
}

export function applyJamesEffectiveStrategies(
  blueprint: GameBlueprint,
  strategies: Array<{
    strategy_fingerprint?: string | null;
    quality?: number | null;
    strengths?: string[];
  }>,
): GameBlueprint {
  // Synthesize concrete components from proven fingerprints. This is intentionally
  // deterministic: James can reuse learned implementation knowledge without a provider.
  const useful = [...strategies]
    .filter((item) => Array.isArray(item.strengths) && item.strengths.length && item.strategy_fingerprint)
    .sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0))
    .slice(0, 3);

  if (!useful.length) return blueprint;

  const mechanics = [...blueprint.mechanics];
  const actions = [...blueprint.playerActions];
  const controls = [...blueprint.controls];
  const tests = [...blueprint.testRequirements];
  const add = (list: string[], value: string) => {
    if (value && !list.includes(value)) list.push(value);
  };
  const knownMechanics = new Set([
    "explore", "collect", "combat", "survival", "stealth", "racing",
    "puzzle", "rescue", "farming", "shooting", "escort", "dialogue",
  ]);
  const knownActions = new Set([
    "move", "interact", "collect", "attack", "dodge", "hide",
    "shoot", "jump", "drive", "swim", "talk", "farm", "rescue",
  ]);

  for (const strategy of useful) {
    const parts = String(strategy.strategy_fingerprint).split(" | ");
    const provenMechanics = (parts[2] || "").split("+").filter((value) => knownMechanics.has(value));
    const provenActions = (parts[3] || "").split("+").filter((value) => knownActions.has(value));
    const provenControls = (parts[4] || "").split("+").filter(Boolean);

    // Reuse only components that are compatible with the current blueprint.
    // Never replace the current world/genre/theme with a prior game's context.
    for (const value of provenMechanics) add(mechanics, value);
    for (const value of provenActions) add(actions, value);
    for (const value of provenControls) add(controls, value);

    const quality = Number(strategy.quality || 0).toFixed(2);
    add(tests, "Validate synthesized strategy component set (quality " + quality + ")");
  }

  for (const capability of new Set(useful.flatMap((item) => item.strengths || []))) {
    if (capability.includes("input")) add(tests, "Regression-check synthesized input strategy");
    if (capability.includes("objective")) add(tests, "Regression-check synthesized objective strategy");
    if (capability.includes("gameplay-state")) add(tests, "Regression-check synthesized gameplay-state strategy");
    if (capability.includes("restart")) add(tests, "Regression-check synthesized restart strategy");
    if (capability.includes("rendering")) add(tests, "Regression-check synthesized rendering strategy");
  }

  return {
    ...blueprint,
    mechanics: Array.from(new Set(mechanics)).slice(0, 12),
    playerActions: Array.from(new Set(actions)).slice(0, 12),
    controls: Array.from(new Set(controls)).slice(0, 8),
    progression: clean(
      blueprint.progression +
        " James synthesized concrete components from " + useful.length +
        " proven strategies. These components must be validated in the current game context.",
      1600,
    ),
    testRequirements: Array.from(new Set(tests)).slice(0, 28),
  };
}

export function applyJamesFailedStrategyAvoidance(
  blueprint: GameBlueprint,
  failedStrategies: Array<{
    pattern?: string | null;
    strategy?: string | null;
    confidence?: number | null;
    failure_count?: number | null;
    capabilities?: string[];
  }>,
): GameBlueprint {
  const relevant = failedStrategies
    .filter((item) => typeof item.strategy === "string" && item.strategy)
    .slice(0, 5);

  if (!relevant.length) return blueprint;

  const failedPatterns = relevant.map((item) => item.pattern || "unknown").join(" | ");
  const failedStrategiesText = relevant.map((item) => item.strategy).join(" | ");
  const mechanics = [...blueprint.mechanics];
  const actions = [...blueprint.playerActions];
  const controls = [...blueprint.controls];
  const add = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
  };

  const failedCapabilities = [...new Set(
    relevant.flatMap((item) => Array.isArray(item.capabilities) ? item.capabilities : []),
  )];

  // Make avoidance concrete: when a failed experience involved a capability,
  // deliberately introduce a different interaction/mechanic path for the next build.
  for (const capability of failedCapabilities) {
    if (capability.includes("input")) {
      add(actions, "move");
      add(controls, "touch + keyboard movement");
      add(blueprint.testRequirements, "Test an alternate input path before objective progression");
    } else if (capability.includes("objective")) {
      add(actions, "interact");
      add(mechanics, "explore");
      add(blueprint.testRequirements, "Test objective progression through exploration instead of the previous interaction path");
    } else if (capability.includes("gameplay-state")) {
      add(mechanics, "collect");
      add(actions, "interact");
      add(blueprint.testRequirements, "Test state transition through a different mechanic");
    } else if (capability.includes("restart")) {
      add(actions, "restart");
      add(controls, "restart");
      add(blueprint.testRequirements, "Test restart after a different state-changing sequence");
    }
  }

  const failedMechanics = new Set(
    relevant
      .flatMap((item) => String(item.pattern || "").split(":"))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const alternativeMechanics = ["explore", "collect", "puzzle", "rescue", "survival", "stealth"];
  const alternative = alternativeMechanics.find((mechanic) =>
    !failedMechanics.has(mechanic) && !mechanics.includes(mechanic),
  );
  if (alternative) add(mechanics, alternative);

  return {
    ...blueprint,
    mechanics: mechanics.slice(0, 12),
    playerActions: actions.slice(0, 16),
    controls: controls.slice(0, 12),
    progression: clean(
      blueprint.progression +
        " James failure memory: do not repeat these previously failed strategies: " +
        failedStrategiesText +
        ". Failed patterns: " + failedPatterns +
        ". Use a materially different implementation approach and verify the affected capability.",
      1400,
    ),
    testRequirements: Array.from(new Set(blueprint.testRequirements)).slice(0, 24),
  };
}

export function applyJamesGameAdaptations(
  blueprint: GameBlueprint,
  adaptations: Array<{
    capability_key?: string | null;
    capability_name?: string | null;
    adaptation_directive?: string | null;
    transfer_success_rate?: number | null;
  }>,
): GameBlueprint {
  const useful = selectTransferAdaptation(adaptations)
    .filter((item) => typeof item.adaptation_directive === "string" && item.adaptation_directive)
    .slice(0, 6);

  if (!useful.length) return blueprint;

  const tests = [...blueprint.testRequirements];
  const actions = [...blueprint.playerActions];
  const mechanics = [...blueprint.mechanics];
  const add = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
  };

  for (const item of useful) {
    const key = String(item.capability_key || "");
    if (key.includes("input")) {
      add(actions, "move");
      add(tests, "Verify input through an alternate interaction path");
    } else if (key.includes("objective")) {
      add(actions, "interact");
      add(mechanics, "collect");
      add(tests, "Verify objective progression through a different interaction path");
    } else if (key.includes("gameplay-state")) {
      add(mechanics, "explore");
      add(tests, "Verify gameplay state transition under a different mechanic");
    } else if (key.includes("restart")) {
      add(actions, "restart");
      add(tests, "Verify restart after state-changing gameplay");
    } else {
      add(tests, "Verify " + (item.capability_name || key) + " under a changed game context");
    }
  }

  return {
    ...blueprint,
    mechanics: mechanics.slice(0, 12),
    playerActions: actions.slice(0, 16),
    testRequirements: Array.from(new Set(tests)).slice(0, 24),
    progression: clean(
      blueprint.progression +
        " James adaptation memory: " +
        useful.map((item) => item.adaptation_directive).join(" | ") +
        " Build this game using a changed implementation path rather than repeating the failed transfer pattern.",
      1400,
    ),
  };
}

export async function getJamesGameLessons(limit = 8) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_reflections")
    .select("lesson, confidence, observation, what_failed, created_at")
    .eq("user_id", SYSTEM_USER_ID)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    console.warn("James game learning retrieval failed:", error.message);
    return [];
  }

  return data || [];
}

export function applyJamesGameLessons(
  blueprint: GameBlueprint,
  lessons: Array<{ lesson?: string | null }>,
): GameBlueprint {
  const useful = lessons
    .map((item) => (typeof item.lesson === "string" ? clean(item.lesson, 220) : ""))
    .filter(Boolean)
    .slice(0, 5);

  if (!useful.length) return blueprint;

  return {
    ...blueprint,
    progression: clean(
      blueprint.progression +
        " James learned from previous verified Fun Zone runs: " +
        useful.join(" | "),
      1200,
    ),
    visualStyle: clean(
      blueprint.visualStyle +
        " · learned runtime constraints: " +
        useful.slice(0, 3).join(" · "),
      500,
    ),
  };
}


export async function getJamesPendingExperiment(input: { userId?: string | null }) {
  const client = db();
  if (!client) return null;

  let query = client
    .from("james_game_experiments")
    .select("id,user_id,conversation_id,capability_key,capability_name,prompt,blueprint,game_html,status,attempt,test_report,learning_result,created_at,verified_at")
    .eq("status", "pending_verification")
    .order("created_at", { ascending: true })
    .limit(1);

  if (input.userId) {
    query = query.eq("user_id", input.userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Pending experiment lookup failed: " + error.message);
  return data;
}

export async function claimJamesGameExperiment(input: { userId?: string | null }) {
  const client = db();
  if (!client) return null;
  const { data, error } = await client.rpc("claim_james_game_experiment", {
    p_user_id: input.userId ?? null,
  });
  if (error) throw new Error("Game experiment claim failed: " + error.message);
  return data;
}

function getJamesBlueprintFingerprint(blueprint: any) {
  const stable = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return "[" + value.map(stable).join("|") + "]";
    if (typeof value === "object") return "{" + Object.keys(value).sort().map((key) => key + ":" + stable(value[key])).join("|") + "}";
    return String(value);
  };
  const relevant = {
    genre: blueprint?.genre,
    world: blueprint?.world,
    mechanics: blueprint?.mechanics,
    playerActions: blueprint?.playerActions,
    controls: blueprint?.controls,
    objective: blueprint?.objective,
    progression: blueprint?.progression,
    coreLoop: blueprint?.coreLoop,
  };
  return [...stable(relevant)].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7).toString(36);
}

export async function applyJamesAutonomousMutationToExperimentBlueprint(blueprint: any, targetContext?: string) {
  const directive = await getJamesMutationDirective(targetContext);
  const mutatedBlueprint = applyJamesMutationDirectiveToBlueprint(blueprint, directive);
  const beforeFingerprint = getJamesBlueprintFingerprint(blueprint);
  const afterFingerprint = getJamesBlueprintFingerprint(mutatedBlueprint);
  return {
    directive,
    blueprint: mutatedBlueprint,
    diversity: {
      beforeFingerprint,
      afterFingerprint,
      structurallyChanged: beforeFingerprint !== afterFingerprint,
      mutationVerified: beforeFingerprint !== afterFingerprint,
    },
  };
}

export async function createJamesGameExperimentJob(input: {
  userId?: string | null;
  conversationId?: string | null;
}) {
  const plan = await createJamesGameExperimentPlan();
  if (!plan || plan.status !== "experiment") {
    return { status: "no-gap" as const, plan };
  }

  const { createAutonomousGameBlueprint } = await import("./localBlueprint");
  const { buildAutonomousGameHtml } = await import("./jamesAutonomousGameEngine");
  const blueprint = createAutonomousGameBlueprint(plan.prompt);
  const gameHtml = buildAutonomousGameHtml(blueprint);
  const client = db();
  const selectedMetaStrategy = plan.selectedMetaStrategy as JamesValidatedMetaStrategy | null;
  const synthesizedRetiredStrategy = plan.synthesizedRetiredStrategy as {
    strategyId: string | null; strategyKey: string; taskClass: string; strategy: string; sourcePatterns: string[];
  } | null;
  const experimentStrategy = synthesizedRetiredStrategy?.strategyId
    ? {
        strategyId: synthesizedRetiredStrategy.strategyId,
        strategyTaskClass: synthesizedRetiredStrategy.taskClass,
        strategySelectionScore: null,
        strategySelectionEvidenceCount: 0,
        strategySelectionSource: "retired-strategy-synthesis",
        strategyKey: synthesizedRetiredStrategy.strategyKey,
        baselineValidatedStrategyId: selectedMetaStrategy?.strategyId || null,
        baselineValidatedStrategyScore: selectedMetaStrategy?.relevanceScore ?? null,
      }
    : selectedMetaStrategy
      ? {
          strategyId: selectedMetaStrategy.strategyId,
          strategyTaskClass: selectedMetaStrategy.taskClass,
          strategySelectionScore: selectedMetaStrategy.relevanceScore,
          strategySelectionEvidenceCount: selectedMetaStrategy.evidenceCount,
          strategySelectionSource: "validated-meta-strategy-lifecycle",
          baselineValidatedStrategyId: selectedMetaStrategy.strategyId,
          baselineValidatedStrategyScore: selectedMetaStrategy.relevanceScore,
        }
      : null;

  if (!client) {
    return {
      status: "pending-verification" as const,
      experimentId: null,
      plan,
      blueprint,
      gameHtml,
    };
  }

  const { data, error } = await client
    .from("james_game_experiments")
    .insert({
      user_id: input.userId ?? null,
      conversation_id: input.conversationId ?? null,
      capability_key: plan.targetCapability?.key || null,
      capability_name: plan.targetCapability?.name || null,
      prompt: plan.prompt,
      blueprint,
      game_html: gameHtml,
      status: "pending_verification",
      attempt: 0,
      learning_result: experimentStrategy
        ? experimentStrategy
        : { strategySelectionSource: "no-validated-meta-strategy" },
    })
    .select("id")
    .single();

  if (error) throw new Error("Experiment persistence failed: " + error.message);

  return {
    status: "pending-verification" as const,
    experimentId: data?.id || null,
    plan,
    blueprint,
    gameHtml,
    strategyId: experimentStrategy?.strategyId || null,
  };
}export async function recordJamesTournamentMemory(input: {
  targetContext: string;
  winnerStrategy: string;
  winnerScore: number;
  winnerSuccessRate: number;
  winnerConfidence: number;
  selectedMutation?: string | null;
  excludedMutations?: string[];
  reason?: string;
  rankings: Array<{
    rank: number;
    strategy: string;
    score: number;
    successRate: number;
    confidence: number;
    evidenceCount: number;
    explorationBonus?: number;
  }>;
}) {
  const client = db();
  if (!client) return null;

  const pattern = "fun-zone:tournament:" + clean(input.targetContext, 160);
  const strategy = "Tournament winner: " + input.winnerStrategy;
  const existing = await client
    .from("james_experiences")
    .select("id,success_count,failure_count,confidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("strategy", strategy)
    .maybeSingle();

  // This function records a selection/ranking snapshot, not an experiment outcome.
  // Success/failure counts must be changed only by recordJamesTournamentOutcomeFeedback()
  // after sandbox verification. Otherwise a pre-experiment ranking would masquerade as
  // observed evidence and contaminate future mutation selection.
  const successCount = Number(existing.data?.success_count || 0);
  const failureCount = Number(existing.data?.failure_count || 0);
  const confidence = Number(existing.data?.confidence || 0.1);

  const priorEvidence = existing.data?.id
    ? await client.from("james_experiences")
        .select("last_evidence")
        .eq("id", existing.data.id)
        .maybeSingle()
    : { data: null };
  const previousEvidence = priorEvidence.data?.last_evidence &&
    typeof priorEvidence.data.last_evidence === "object"
    ? priorEvidence.data.last_evidence as Record<string, unknown>
    : {};
  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: ["fun-zone-strategy-tournament"],
    status: "active",
    // Ranking snapshots are replaceable, but observed outcome events are immutable
    // history for duplicate protection and calibration.
    last_evidence: {
      ...previousEvidence,
      winnerScore: input.winnerScore,
      winnerSuccessRate: input.winnerSuccessRate,
      winnerConfidence: input.winnerConfidence,
      selectedMutation: input.selectedMutation || input.winnerStrategy,
      excludedMutations: Array.from(new Set(input.excludedMutations || [])).slice(0, 12),
      reason: input.reason || "Tournament ranking combined empirical success, quality, diversity, parent improvement, and uncertainty-driven exploration.",
      rankings: input.rankings.slice(0, 5),
      targetContext: input.targetContext,
      recordedAt: new Date().toISOString(),
    },
  };

  const result = existing.data?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.data.id)
    : await client.from("james_experiences").insert(memory);

  if (result.error) {
    console.warn("James tournament memory recording failed:", result.error.message);
    return null;
  }

  return {
    pattern,
    confidence: Number(confidence.toFixed(3)),
    successCount,
    failureCount,
  };
}

export async function recordJamesTournamentOutcomeFeedback(input: {
  targetContext: string;
  mutationAction?: string | null;
  experimentId: string;
  sourceEventKey: string;
  passed: boolean;
  quality: number;
}) {
  const client = db();
  if (!client) return null;
  const pattern = "fun-zone:tournament:" + clean(input.targetContext, 160);
  const { data: rows, error } = await client
    .from("james_experiences")
    .select("id,strategy,success_count,failure_count,confidence,last_evidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("status", "active")
    .limit(20);
  if (error) {
    console.warn("James tournament outcome memory retrieval failed:", error.message);
    return null;
  }
  const matchingRows = (rows || []).filter((item) => {
    const evidence = item.last_evidence && typeof item.last_evidence === "object"
      ? item.last_evidence as Record<string, unknown>
      : {};
    return input.mutationAction
      ? String(evidence.selectedMutation || "") === input.mutationAction
      : true;
  });
  // Never attach an outcome to an arbitrary tournament row. If mutation identity is
  // available it must match exactly; without it, only a single unambiguous row is safe.
  const row = matchingRows.length === 1 ? matchingRows[0] : null;
  if (!row) {
    return {
      updated: false,
      reason: matchingRows.length > 1 ? "ambiguous-tournament-memory" : "tournament-memory-not-found",
    };
  }
  const evidence = row.last_evidence && typeof row.last_evidence === "object"
    ? row.last_evidence as Record<string, unknown>
    : {};
  const outcomeEvents = Array.isArray(evidence.outcomeEvents)
    ? evidence.outcomeEvents.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    : [];
  if (outcomeEvents.some((event) => String(event.sourceEventKey || "") === input.sourceEventKey)) {
    return { updated: false, reason: "duplicate-outcome-event", memoryId: row.id };
  }
  const successCount = Number(row.success_count || 0) + (input.passed ? 1 : 0);
  const failureCount = Number(row.failure_count || 0) + (input.passed ? 0 : 1);
  const total = successCount + failureCount;
  const successRate = total ? successCount / total : 0;
  const quality = Math.max(0, Math.min(1, Number(input.quality || 0)));
  const confidence = Math.min(0.99, Math.max(0.1,
    successRate * 0.55 + quality * 0.35 + Math.min(0.1, total * 0.01),
  ));
  const nextEvidence = {
    ...evidence,
    latestOutcome: input.passed ? "success" : "failure",
    latestQuality: quality,
    latestExperimentId: input.experimentId,
    latestSourceEventKey: input.sourceEventKey,
    outcomeEvents: [
      ...outcomeEvents.slice(-19),
      { sourceEventKey: input.sourceEventKey, experimentId: input.experimentId, passed: input.passed, quality, recordedAt: new Date().toISOString() },
    ],
  };
  const result = await client.from("james_experiences").update({
    success_count: successCount,
    failure_count: failureCount,
    confidence,
    last_evidence: nextEvidence,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (result.error) {
    console.warn("James tournament outcome memory update failed:", result.error.message);
    return null;
  }
  return { updated: true, memoryId: row.id, mutation: input.mutationAction || String(evidence.selectedMutation || ""), successCount, failureCount, successRate: Number(successRate.toFixed(3)), confidence: Number(confidence.toFixed(3)), quality };
}

export function runJamesStrategyTournament(
  branches: Array<{ strategy: string; confidence: number; successCount: number; failureCount: number; branchScore?: number }>,
) {
  const candidates = selectJamesStrategyBranches(branches, Math.min(5, branches.length || 1));
  if (!candidates.length) return { status: "no-candidates", winner: null, rankings: [] };

  const rankings = candidates.map((candidate, index) => ({
    rank: index + 1,
    strategy: candidate.strategy,
    score: candidate.branchScore || 0,
    successRate: candidate.successRate,
    confidence: candidate.confidence,
    evidenceCount: candidate.successCount + candidate.failureCount,
  }));

  const winner = rankings[0];
  return {
    status: "tournament-ready",
    winner,
    rankings,
    rule: "Rank by empirical success, confidence, and repeated evidence; retain non-winning branches for future contextual testing.",
  };
}

export function scoreJamesTournamentWithMemory(
  branches: Array<{ strategy: string; confidence: number; successCount: number; failureCount: number; branchScore?: number }>,
  memory: Array<{ strategy: string; confidence: number; successCount: number; failureCount: number }>,
) {
  return branches
    .map((branch) => {
      const historical = memory.find((item) => item.strategy === "Tournament winner: " + branch.strategy);
      const total = branch.successCount + branch.failureCount;
      const empirical = total ? branch.successCount / total : 0;
      const memoryTotal = historical ? historical.successCount + historical.failureCount : 0;
      const memoryRate = historical && memoryTotal ? historical.successCount / memoryTotal : 0;

      // Calibrated memory earns influence only as repeated evidence accumulates.
      // Sparse history is shrunk toward neutral so one experiment cannot dominate.
      const memoryReliability = historical
        ? Math.min(1, memoryTotal / 8)
        : 0;
      const rawMemoryScore = historical
        ? memoryRate * 0.5 + historical.confidence * 0.5
        : 0.5;
      const calibratedMemoryScore = 0.5 + (rawMemoryScore - 0.5) * memoryReliability;
      const effectiveMemoryWeight = 0.25 * memoryReliability;
      const baseWeight = 1 - effectiveMemoryWeight;
      const score = (
        empirical * (baseWeight * 0.60) +
        branch.confidence * (baseWeight * 0.40) +
        calibratedMemoryScore * effectiveMemoryWeight
      );

      return {
        ...branch,
        empiricalSuccessRate: empirical,
        tournamentMemoryRate: memoryRate,
        tournamentMemoryScore: Number(calibratedMemoryScore.toFixed(4)),
        tournamentMemoryReliability: Number(memoryReliability.toFixed(4)),
        tournamentScore: Number(score.toFixed(4)),
      };
    })
    .sort((a, b) => b.tournamentScore - a.tournamentScore || b.successCount - a.successCount);
}

export function scoreJamesMutationTournamentWithMemory(
  tournament: JamesMutationTournamentEntry[],
  memory: Array<{ strategy: string; confidence: number; successCount: number; failureCount: number }>,
) {
  return tournament
    .map((entry) => {
      const historical = memory.find((item) => item.strategy === "Tournament winner: " + entry.action);
      const memoryTotal = historical
        ? historical.successCount + historical.failureCount
        : 0;
      const memoryRate = historical && memoryTotal
        ? historical.successCount / memoryTotal
        : 0;
      const memoryReliability = historical
        ? Math.min(1, memoryTotal / 8)
        : 0;
      const rawMemoryScore = historical
        ? memoryRate * 0.5 + historical.confidence * 0.5
        : 0.5;
      const calibratedMemoryScore = 0.5 + (rawMemoryScore - 0.5) * memoryReliability;
      const effectiveMemoryWeight = 0.25 * memoryReliability;
      const tournamentScore = Number(entry.score || 0);
      const score = tournamentScore * (1 - effectiveMemoryWeight) +
        calibratedMemoryScore * effectiveMemoryWeight;

      return {
        ...entry,
        tournamentScore: Number(score.toFixed(4)),
        tournamentMemoryRate: Number(memoryRate.toFixed(4)),
        tournamentMemoryScore: Number(calibratedMemoryScore.toFixed(4)),
        tournamentMemoryReliability: Number(memoryReliability.toFixed(4)),
      };
    })
    .sort((a, b) =>
      b.tournamentScore - a.tournamentScore ||
      b.successCount - a.successCount ||
      b.score - a.score,
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function selectJamesStrategyBranches(
  strategies: Array<{ strategy: string; confidence: number; successCount: number; failureCount: number }>,
  branchLimit = 3,
) {
  return [...strategies]
    .map((item) => {
      const total = item.successCount + item.failureCount;
      const successRate = total ? item.successCount / total : 0;
      const score = successRate * 0.55 + item.confidence * 0.35 + Math.min(0.1, total * 0.01);
      return { ...item, successRate, branchScore: Number(score.toFixed(4)) };
    })
    .sort((a, b) => b.branchScore - a.branchScore)
    .slice(0, Math.max(1, Math.min(5, branchLimit)));
}

export function chooseJamesStrategyRecovery(lineage: Array<{ successCount: number; failureCount: number; confidence: number }>) {
  const best = [...lineage].sort((a, b) =>
    (b.successCount - a.successCount) ||
    (b.confidence - a.confidence),
  )[0];

  if (!best) return {
    action: "continue-evolution",
    reason: "No prior lineage evidence available.",
  };

  const total = best.successCount + best.failureCount;
  const rate = total ? best.successCount / total : 0;
  return rate < 0.4 && best.failureCount >= 2
    ? {
        action: "fallback-to-parent",
        reason: "Child strategy has weak historical lineage evidence; restore the parent strategy before another mutation.",
      }
    : {
        action: "continue-evolution",
        reason: "Lineage evidence supports continuing bounded strategy evolution.",
      };
}



