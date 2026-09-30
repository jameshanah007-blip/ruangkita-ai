
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

export async function applyJamesAutonomousMutationToExperimentBlueprint(blueprint: any, targetContext?: string) {
  const directive = await getJamesMutationDirective(targetContext);
  return {
    directive,
    blueprint: applyJamesMutationDirectiveToBlueprint(blueprint, directive),
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
    strategyId: string | null;
    strategyKey: string;
    taskClass: string;
    strategy: string;
    sourcePatterns: string[];
  } | null;
  // A synthesized branch exists specifically to generate fresh evidence after
  // terminal retirement. It therefore becomes the experiment target even when
  // an older validated strategy is available. The validated strategy remains
  // recorded as a baseline/context reference rather than stealing the trial.
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