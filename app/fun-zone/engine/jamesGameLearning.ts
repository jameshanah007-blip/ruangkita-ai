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

  const successCount = Number(existing.data?.success_count || 0) + (input.winnerSuccessRate >= 0.75 ? 1 : 0);
  const failureCount = Number(existing.data?.failure_count || 0) + (input.winnerSuccessRate < 0.75 ? 1 : 0);
  const confidence = Math.min(0.99, Math.max(0.1,
    Number(input.winnerConfidence) * 0.7 + Number(existing.data?.confidence || input.winnerConfidence) * 0.3,
  ));

  const memory = {
    user_id: SYSTEM_USER_ID,
    pattern,
    strategy,
    confidence,
    success_count: successCount,
    failure_count: failureCount,
    capabilities: ["fun-zone-strategy-tournament"],
    status: "active",
    last_evidence: {
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
  const row = (rows || []).find((item) => {
    const evidence = item.last_evidence && typeof item.last_evidence === "object"
      ? item.last_evidence as Record<string, unknown>
      : {};
    return !input.mutationAction || String(evidence.selectedMutation || "") === input.mutationAction;
  }) || rows?.[0];
  if (!row) return null;
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
  return { updated: true, memoryId: row.id, mutation: input.mutationAction || String(nextEvidence.selectedMutation || ""), successCount, failureCount, successRate: Number(successRate.toFixed(3)), confidence: Number(confidence.toFixed(3)), quality };
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
      const memoryScore = historical
        ? memoryRate * 0.5 + historical.confidence * 0.5
        : 0;
      const score = empirical * 0.45 + branch.confidence * 0.3 + memoryScore * 0.25;
      return {
        ...branch,
        empiricalSuccessRate: empirical,
        tournamentMemoryRate: memoryRate,
        tournamentMemoryScore: memoryScore,
        tournamentScore: Number(score.toFixed(4)),