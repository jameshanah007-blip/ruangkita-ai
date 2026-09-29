import { createClient } from "@supabase/supabase-js";
import type { GameBlueprint, TestReport } from "../laboratory/types";

const SYSTEM_USER_ID = "system:fun-zone";

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
) {
  const client = db();
  if (!client) return null;

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

function gameQuality(report: TestReport) {
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
) {
  const client = db();
  if (!client) return null;

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
          hardFailures: failed.slice(0, 8),
          softWarnings: warnings.slice(0, 8),
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
    const transferTests = priorTransferRows.length + (transferTested ? 1 : 0);
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

export async function createJamesGameExperimentPlan() {
  const client = db();
  if (!client) return null;

  const [{ data, error }, recoveryDirectives, exploration, modeMemory] = await Promise.all([
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
    prompt: capabilityPrompt + recoveryContext +
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
    .select("id,success_count,failure_count,confidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", strategyPattern)
    .eq("strategy", strategy)
    .maybeSingle();

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
  };

  if (existing?.id) {
    await client.from("james_experiences").update(memory).eq("id", existing.id);
  } else {
    await client.from("james_experiences").insert(memory);
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
    .select("id,success_count,failure_count")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", strategyPattern)
    .eq("strategy", strategy)
    .maybeSingle();

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
  };

  if (existing?.id) await client.from("james_experiences").update(memory).eq("id", existing.id);
  else await client.from("james_experiences").insert(memory);

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
    .select("id,success_count,failure_count,confidence")
    .eq("user_id", SYSTEM_USER_ID)
    .eq("pattern", pattern)
    .eq("strategy", strategy)
    .maybeSingle();

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
  };

  const result = existing?.id
    ? await client.from("james_experiences").update(memory).eq("id", existing.id)
    : await client.from("james_experiences").insert(memory);

  if (result.error) {
    console.warn("James exploration promotion failed:", result.error.message);
    return { explored: true, promoted: false, successRate };
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
) {
  const client = db();
  if (!client) return null;

  const pattern = clean(
    "fun-zone:" + blueprint.world + ":" + blueprint.genre + ":" + blueprint.mechanics.slice(0, 4).join("+"),
    300,
  );
  const { data: rows, error } = await client
    .from("james_experiences")
    .select("id, pattern, strategy, confidence, success_count, failure_count, capabilities")
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

    const result = await client
      .from("james_experiences")
      .update({ confidence, status })
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
  };
}
