import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../../core/ai/aiRouter";
import {
  claimJamesLearningItem,
  finishJamesLearningItem,
} from "../../tools/jamesLearningQueue";
import { reserveJamesLearningCalls } from "../../tools/jamesLearningBudget";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request) {
  const provided = request.headers.get("authorization");
  const secrets = [process.env.JAMES_LEARNING_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .map((value) => `Bearer ${value}`);
  return Boolean(provided && secrets.includes(provided));
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const item = await claimJamesLearningItem();
  if (!item) {
    return NextResponse.json({ ok: true, processed: false, reason: "No pending learning task." });
  }

  const budget = await reserveJamesLearningCalls(1);
  if (!budget) {
    await finishJamesLearningItem(item.id, item.claimToken ?? "", {
      status: "failed",
      error: "Learning budget exhausted before task execution.",
    });
    return NextResponse.json({
      ok: true,
      processed: false,
      taskId: item.id,
      reason: "Learning budget exhausted.",
    });
  }

  try {
    const result = await generateWithAIRouter({
      prompt: `Learning task:
TOPIC: ${item.topic}
PRIORITY: ${item.priority}
TYPE: ${item.taskType}
REASON: ${item.reason}

Perform this learning task for James. Focus on a concrete, reusable lesson.
Do not invent evidence. Distinguish known facts, uncertainty, and proposed next experiment.

Return JSON only:
{"lesson":"...","evidence":["..."],"confidence":0.0,"next_action":"..."}`,
      systemInstruction:
        "You are James Autonomous Learning Worker. Produce a compact evidence-based learning result. Never claim that an action was executed when it was only proposed.",
      temperature: 0.2,
      maxOutputTokens: 1800,
    });

    const parsed = extractJson(result.text);
    const lesson = typeof parsed?.lesson === "string" ? parsed.lesson.trim() : "";
    const evidence = Array.isArray(parsed?.evidence)
      ? parsed.evidence.filter((value): value is string => typeof value === "string").slice(0, 8)
      : [];
    const confidence = typeof parsed?.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;
    const nextAction = typeof parsed?.next_action === "string"
      ? parsed.next_action.trim().slice(0, 500)
      : "";

    if (!lesson) {
      await finishJamesLearningItem(item.id, item.claimToken ?? "", {
        status: "failed",
        error: "Learning worker returned no structured lesson.",
        evidence: { provider: result.provider, raw: result.text.slice(0, 2000) },
      });
      return NextResponse.json({ ok: false, processed: true, taskId: item.id, error: "No structured lesson." }, { status: 502 });
    }

    const finished = await finishJamesLearningItem(item.id, item.claimToken ?? "", {
      status: confidence >= 0.7 ? "completed" : "failed",
      evidence: {
        lesson,
        evidence,
        confidence,
        nextAction,
        provider: result.provider,
        model: result.model,
        completedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: finished,
      processed: true,
      taskId: item.id,
      status: confidence >= 0.7 ? "completed" : "failed",
      provider: result.provider,
      confidence,
    });
  } catch (error) {
    await finishJamesLearningItem(item.id, item.claimToken ?? "", {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, processed: true, taskId: item.id, error: "Learning worker failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
