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

export async function getJamesFailedStrategies(limit = 8) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_experiences")
    .select("pattern, strategy, confidence, failure_count, capabilities, updated_at")
    .eq("status", "active")
    .gt("failure_count", 0)
    .order("confidence", { ascending: true })
    .order("failure_count", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    console.warn("James failed-strategy retrieval failed:", error.message);
    return [];
  }

  return (data || []).map((item) => ({
    pattern: item.pattern,
    strategy: item.strategy,
    confidence: item.confidence,
    failure_count: item.failure_count,
    capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
  }));
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
