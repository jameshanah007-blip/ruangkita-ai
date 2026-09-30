import { retrieveJamesValidatedStrategies, type JamesValidatedStrategy } from "./jamesValidatedStrategyRetrieval";

export type JamesStrategyRuntimeContext = {
  taskClass: string;
  strategies: JamesValidatedStrategy[];
  guidance: string;
};

export async function buildJamesStrategyRuntimeContext(
  taskClass: string,
  task: string,
  limit = 3,
): Promise<JamesStrategyRuntimeContext> {
  const strategies = await retrieveJamesValidatedStrategies(taskClass, limit);
  const guidance = strategies.length
    ? [
        "Validated strategy guidance is available for this task.",
        "Use it as bounded evidence-informed guidance, not as an absolute command.",
        "Prefer stronger current evidence when it conflicts with stored strategy.",
        "",
        ...strategies.map((item, index) =>
          [
            "Strategy " + (index + 1) + ": " + item.strategy,
            "Confidence: " + item.confidence.toFixed(3),
            "Evidence count: " + item.evidence_count,
            "Success count: " + item.success_count,
            "Failure count: " + item.failure_count,
            "Relevance: " + item.relevance_score.toFixed(3),
          ].join("\n"),
        ),
      ].join("\n")
    : "No validated strategy is currently available; derive a strategy from current evidence.";

  return { taskClass, strategies, guidance: guidance + "\n\nCurrent task: " + task };
}
