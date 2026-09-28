import { generateWithJamesResourceManager } from "./jamesResourceManager";
import type { JamesCapability } from "./jamesIntelligence";

export type JamesTaskAction = {
  id: string;
  goal: string;
  capability: JamesCapability;
  input: string;
  dependsOn: string[];
  status: "pending" | "running" | "completed" | "failed";
};

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function validCapability(value: unknown): value is JamesCapability {
  return value === "chat" ||
    value === "calculator" ||
    value === "web_search" ||
    value === "document" ||
    value === "planner";
}

function clean(value: unknown, max = 600) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeActions(parsed: Record<string, unknown>): JamesTaskAction[] {
  const raw = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: JamesTaskAction[] = [];

  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;

    const value = item as Record<string, unknown>;
    const capability = value.capability;
    if (!validCapability(capability)) return;

    const dependencies = Array.isArray(value.dependsOn)
      ? value.dependsOn
          .filter((dependency): dependency is string => typeof dependency === "string")
          .slice(0, 8)
      : [];

    const goal = clean(value.goal, 300);
    const input = clean(value.input, 700);
    if (!goal || !input) return;

    actions.push({
      id: clean(value.id, 40) || "step-" + (index + 1),
      goal,
      capability,
      input,
      dependsOn: dependencies,
      status: "pending",
    });
  });

  return actions.slice(0, 8);
}

export async function planJamesTaskActions(input: {
  request: string;
  intelligencePlan: unknown;
  conversationContext?: string;
  previousState?: string;
}): Promise<JamesTaskAction[]> {
  try {
    const result = await generateWithJamesResourceManager("planning", {
      prompt: [
        "Pecah permintaan pengguna menjadi subtugas yang dapat dieksekusi James.",
        "",
        "PERMINTAAN:",
        input.request,
        "",
        "INTELLIGENCE PLAN:",
        JSON.stringify(input.intelligencePlan),
        "",
        "KONTEKS:",
        input.conversationContext || "(tidak ada)",
        "",
        "STATE SEBELUMNYA:",
        input.previousState || "(belum ada)",
        "",
        "Gunakan hanya capability: chat, calculator, web_search, document, planner.",
        "Setiap subtugas harus konkret dan punya input yang jelas.",
        "Gunakan dependsOn agar urutan kerja eksplisit.",
        "Jangan membuat subtugas yang tidak diperlukan.",
        "Jika tugas sederhana, buat sesedikit mungkin subtugas.",
        "",
        "Output JSON saja:",
        "{",
        "  \"actions\": [",
        "    {",
        "      \"id\": \"step-1\",",
        "      \"goal\": \"tujuan langkah\",",
        "      \"capability\": \"web_search\",",
        "      \"input\": \"input langkah\",",
        "      \"dependsOn\": []",
        "    }",
        "  ]",
        "}"
      ].join("\n"),
      systemInstruction:
        "Kamu adalah task decomposition engine James. Pecah pekerjaan secara minimal, aman, deterministik, dan dapat dieksekusi. Jangan menjawab pengguna.",
      temperature: 0.1,
      maxOutputTokens: 1800,
    });

    const parsed = extractJson(result.text);
    if (!parsed) return [];

    const actions = normalizeActions(parsed);

    const knownIds = new Set(actions.map((action) => action.id));
    return actions.map((action) => ({
      ...action,
      dependsOn: action.dependsOn.filter((dependency) =>
        knownIds.has(dependency) && dependency !== action.id
      ),
    }));
  } catch (error) {
    console.warn("James task planner unavailable.", error);
    return [];
  }
}
