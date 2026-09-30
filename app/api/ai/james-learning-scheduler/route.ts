import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decideJamesAutonomousLearning } from "@/app/api/tools/jamesLearningDecisionGate";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function authorized(request: NextRequest) {
  const secret = process.env.JAMES_LEARNING_SECRET ?? process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decision = await decideJamesAutonomousLearning();

  if (decision.decision !== "learn_now" || !decision.capability) {
    return NextResponse.json({ scheduled: false, ...decision });
  }

  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const evidence = {
    decisionScore: decision.score,
    decisionReasons: decision.reasons,
    scheduledAt: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from("james_learning_queue")
    .select("id,status")
    .eq("topic", decision.capability)
    .in("status", ["pending", "running"])
    .limit(1);

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

  if (existing?.length) {
    return NextResponse.json({
      scheduled: false,
      reason: "existing_task",
      taskId: existing[0].id,
      ...decision,
    });
  }

  const { data: task, error } = await supabase
    .from("james_learning_queue")
    .insert({
      topic: decision.capability,
      priority: Math.max(0.8, decision.score),
      task_type: decision.reasons.some((reason) => reason.toLowerCase().includes("regression")) ? "verification" : "learning",
      reason: decision.reasons.join(" "),
      evidence,
      status: "pending",
    })
    .select("id,topic,priority,task_type,status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ scheduled: true, task, ...decision });
}
