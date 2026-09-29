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
    const diversityCount = new Set([currentPattern, ...priorPatterns]).size;

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
    const status = nextEvidence >= 12 && diversityCount >= 3 && nextCompetence >= 0.85
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
          blueprint: blueprintFingerprint(blueprint),
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

  return {
    outcome: passed ? "success" : quality >= 0.5 ? "partial" : "failure",
    quality,
    capabilities,
    failedCapabilities: failures,
    selfEvaluationId: selfEvaluation.data?.id || null,
    consolidationEvidence: nextEvidence,
  };
}


export async function getJamesGameMastery(limit = 12) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_self_model")
    .select("capability_key, capability_name, competence, confidence, evidence_count, success_count, failure_count, status, next_learning_action")
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
  }>,
): GameBlueprint {
  const relevant = mastery
    .filter((item) => typeof item.capability_key === "string" && item.capability_key.startsWith("fun-zone-"))
    .slice(0, 8);

  if (!relevant.length) return blueprint;

  const competence = (key: string) =>
    Number(relevant.find((item) => item.capability_key === key)?.competence ?? 0.75);
  const developing = relevant.filter((item) => Number(item.competence || 0) < 0.75);
  const strong = relevant.filter((item) => Number(item.competence || 0) >= 0.75);

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

  const masteryContext = relevant.map((item) =>
    (item.capability_name || item.capability_key || "unknown") +
    "=" + Number(item.competence || 0).toFixed(2) +
    " confidence=" + Number(item.confidence || 0).toFixed(2)
  ).join(" | ");

  const learningDirective = developing.length
    ? " Prioritize verification and robust implementation for developing capabilities: " +
      developing.map((item) => item.capability_name || item.capability_key).join(", ") + "."
    : " Maintain verified runtime contracts while exploring new mechanics.";

  return {
    ...blueprint,
    mechanics: mechanics.slice(0, 12),
    playerActions: actions.slice(0, 16),
    controls: controls.slice(0, 12),
    progression: clean(
      blueprint.progression +
      " James capability mastery: " + masteryContext + "." +
      learningDirective,
      1400,
    ),
    testRequirements: Array.from(new Set(tests.concat(
      developing.map((item) => "Verify " + (item.capability_name || item.capability_key)),
      strong.map((item) => "Regression-check " + (item.capability_name || item.capability_key)),
    ))).slice(0, 24),
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
