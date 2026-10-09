import { getGlobalGrowth } from "../../api/tools/jamesGlobalLearning";
import { getJamesDecisionMemory } from "../../api/tools/jamesDecisionMemory";
import { runJamesBrain, type JamesBrainRequest } from "./jamesBrain";
import type { JamesResourceTask } from "../../api/tools/jamesResourceManager";

function taskForMode(mode: JamesBrainRequest["mode"]): JamesResourceTask {
  if (mode === "chat") return "chat";
  if (mode === "game_director" || mode === "planning") return "planning";
  if (mode === "game_debugger") return "verification";
  if (mode === "learning") return "learning";
  return "reasoning";
}

export async function runJamesBrainWithSharedKnowledge(
  input: JamesBrainRequest
) {
  const task = taskForMode(input.mode);

  const [globalGrowth, decisions] = await Promise.all([
    getGlobalGrowth(8),
    getJamesDecisionMemory(task, 8),
  ]).catch((error: unknown) => {
    const detail = error instanceof Error
      ? error.message
      : (() => {
          try {
            return JSON.stringify(error);
          } catch {
            return String(error);
          }
        })();
    console.error("James shared knowledge retrieval failed before AI generation", {
      task,
      errorType: error instanceof Error ? error.name : typeof error,
      message: detail,
    });
    throw new Error(
      `James shared knowledge retrieval failed before AI generation: ${detail}`,
      { cause: error }
    );
  });

  const shared = [
    input.context || "",
    globalGrowth.length
      ? [
          "SHARED JAMES LEARNING — aggregated, non-identifying:",
          ...globalGrowth.map(
            (item) =>
              `- ${item.category}:${item.key} = ${item.value} (consensus ${Number(item.consensus_score || 0).toFixed(2)})`
          ),
        ].join("\n")
      : "",
    decisions.length
      ? [
          "SHARED JAMES DECISION HISTORY:",
          ...decisions.map(
            (item) =>
              `- ${item.task}/${item.mode}: ${item.outcome}; quality=${Number(item.quality || 0).toFixed(2)}; verified=${item.verified}`
          ),
        ].join("\n")
      : "",
  ].filter(Boolean).join("\n\n");

  return runJamesBrain({
    ...input,
    context: shared,
  });
}
