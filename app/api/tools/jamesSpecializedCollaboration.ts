import {
  generateWithJamesProviderCollaboration,
  generateWithJamesResourceManager,
  type JamesResourceResult,
  type JamesResourceTask,
} from "./jamesResourceManager";
import { selectJamesCollaborationProviders } from "./jamesProviderCollaboration";
import {
  assignJamesProviderRoles,
  buildJamesRolePrompt,
} from "./jamesProviderRoles";

export async function runJamesSpecializedCollaboration(input: {
  request: string;
  task: JamesResourceTask;
}) {
  const selected = await selectJamesCollaborationProviders(input.task, 3);
  const assignments = assignJamesProviderRoles(selected, input.task);
  const results: JamesResourceResult[] = [];

  for (const assignment of assignments) {
    const previous = results.map((item) => [
      "Provider: " + item.provider,
      "Role: " + assignment.role,
      item.text.slice(0, 6000),
    ].join("\n")).join("\n\n");

    const batch = await generateWithJamesProviderCollaboration(
      input.task,
      {
        systemInstruction:
          "Kerjakan hanya role yang diberikan. Gunakan hasil sebelumnya sebagai evidence kerja, bukan sebagai fakta mutlak.",
        prompt: buildJamesRolePrompt({
          request: input.request,
          role: assignment.role,
          provider: assignment.provider,
          previousResults: previous,
        }),
        temperature: 0.15,
        maxOutputTokens: 1800,
      },
      [assignment.provider]
    );

    if (batch.length) {
      results.push(batch[0]);
    }
  }

  if (results.length < 2) {
    const fallback = await generateWithJamesResourceManager(input.task, {
      systemInstruction: "Selesaikan task James dengan aman dan berdasarkan evidence.",
      prompt: input.request,
      temperature: 0.2,
      maxOutputTokens: 1800,
    });

    return {
      mode: "fallback",
      assignments,
      results: [fallback],
    };
  }

  return {
    mode: "specialized",
    assignments,
    results,
  };
}

export function formatJamesSpecializedContext(results: JamesResourceResult[]) {
  return results.map((item, index) => [
    "SPECIALIZED PROVIDER " + (index + 1),
    "Provider: " + item.provider,
    "Model: " + item.model,
    "Task: " + item.task,
    "Output:",
    item.text.slice(0, 6000),
  ].join("\n")).join("\n\n");
}
