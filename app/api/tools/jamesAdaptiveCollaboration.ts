import {
  generateWithJamesProviderCollaboration,
  generateWithJamesResourceManager,
  type JamesResourceResult,
  type JamesResourceTask,
} from "./jamesResourceManager";
import {
  buildCollaborationPrompt,
  selectJamesCollaborationProviders,
} from "./jamesProviderCollaboration";

export async function runJamesAdaptiveCollaboration(input: {
  request: string;
  task: JamesResourceTask;
}) {
  const selected = await selectJamesCollaborationProviders(input.task, 3);

  const results = await generateWithJamesProviderCollaboration(
    input.task,
    {
      systemInstruction:
        "Kerjakan bagian tugas secara independen. Jangan mengarang fakta eksternal.",
      prompt: buildCollaborationPrompt(input.request, input.task, selected[0] || "openai"),
      temperature: 0.2,
      maxOutputTokens: 1800,
    },
    selected
  );

  if (results.length < 2) {
    const fallback = await generateWithJamesResourceManager(input.task, {
      systemInstruction: "Kerjakan task James dengan akurat dan ringkas.",
      prompt: input.request,
      temperature: 0.2,
      maxOutputTokens: 1800,
    });
    return {
      mode: "fallback",
      results: [fallback],
      selectedProviders: [fallback.provider],
    };
  }

  return {
    mode: "multi",
    results,
    selectedProviders: results.map((item) => item.provider),
  };
}

export function formatJamesCollaborationContext(results: JamesResourceResult[]) {
  return results.map((item, index) => [
    "COLLABORATOR " + (index + 1),
    "Provider: " + item.provider,
    "Model: " + item.model,
    "Task: " + item.task,
    "Result:",
    item.text.slice(0, 5000),
  ].join("\n")).join("\n\n");
}
