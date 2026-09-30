import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateWithJamesResourceManager } from "@/app/api/tools/jamesResourceManager";
import { beginJamesCapabilityRecovery, verifyJamesCapabilityRecovery } from "@/app/api/tools/jamesRecoveryVerification";
import { updateJamesCapabilityMastery } from "@/app/api/tools/jamesCapabilityMastery";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function authorized(request: NextRequest) {
  const secret = process.env.JAMES_LEARNING_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function textResult(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const claimToken = crypto.randomUUID();
  const { data: item, error: claimError } = await supabase.rpc("claim_james_learning_queue_item", {
    p_claim_token: claimToken,
  });
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!item) return NextResponse.json({ status: "idle" });

  const capability = String(item.topic ?? "").slice(0, 200);
  const taskType = String(item.task_type ?? "learning");
  const baseline = Number(item.evidence?.mastery ?? 0.5);

  try {
    if (taskType === "verification" && item.reason?.toLowerCase().includes("regression")) {
      await beginJamesCapabilityRecovery(capability, baseline, item.id);
    }

    const prompt = `You are James Autonomous Brain operating a closed-loop learning task.
Capability: ${capability}
Task type: ${taskType}
Reason: ${String(item.reason ?? "")}
Existing evidence: ${JSON.stringify(item.evidence ?? null)}

Perform the task as evidence-driven learning. Do not claim mastery merely from generating an explanation.
Return JSON only:
{"lesson":"...","evidence":["..."],"confidence":0,"retest_plan":"...","outcome":"success|failure|partial"}`;

    const result = await generateWithJamesResourceManager("learning", prompt, {
      userId: "system:james-learning-worker",
      maxOutputTokens: 1800,
    });
    const parsed = textResult(result.text);

    if (!parsed?.lesson || !Array.isArray(parsed.evidence)) {
      throw new Error("Learning worker received invalid structured evidence.");
    }

    const outcome = parsed.outcome === "failure" ? "failure" : parsed.outcome === "partial" ? "partial" : "success";
    const quality = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5)));
    const mastery = await updateJamesCapabilityMastery(
      capability,
      outcome,
      quality,
      { lesson: parsed.lesson, evidence: parsed.evidence, retestPlan: parsed.retest_plan ?? null, queueItemId: item.id },
    );

    let recovery = null;
    if (taskType === "verification") {
      recovery = await verifyJamesCapabilityRecovery(
        capability,
        Number(mastery?.mastery ?? baseline),
        { lesson: parsed.lesson, evidence: parsed.evidence, outcome, quality },
      );
    }

    await supabase.from("james_learning_queue").update({
      status: outcome === "failure" ? "failed" : "completed",
      last_error: null,
      evidence: { ...item.evidence, lesson: parsed.lesson, evidence: parsed.evidence, outcome, quality, mastery: mastery?.mastery ?? null, recovery },
      updated_at: new Date().toISOString(),
    }).eq("id", item.id).eq("claim_token", claimToken);

    return NextResponse.json({ status: "completed", itemId: item.id, capability, outcome, mastery, recovery });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("james_learning_queue").update({
      status: "failed",
      last_error: message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq("id", item.id).eq("claim_token", claimToken);
    return NextResponse.json({ status: "failed", itemId: item.id, error: message }, { status: 500 });
  }
}
