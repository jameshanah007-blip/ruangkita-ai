import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export type JamesLearningQueueItem = {
  id: string;
  topic: string;
  priority: number;
  taskType: "learning" | "verification" | "experiment";
  reason: string;
  status: "pending" | "running" | "completed" | "failed" | "rejected";
  attempts: number;
  claimToken?: string | null;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function enqueueJamesLearningItems(
  items: Array<{
    topic: string;
    priority: number;
    taskType?: JamesLearningQueueItem["taskType"];
    reason?: string;
  }>
) {
  const supabase = db();
  if (!supabase || !items.length) return 0;

  const rows = items.slice(0, 10).map((item) => ({
    topic: item.topic.trim().slice(0, 500),
    priority: Math.max(0, Math.min(1, item.priority)),
    task_type: item.taskType ?? "learning",
    reason: (item.reason ?? "").trim().slice(0, 700),
  })).filter((item) => item.topic);

  if (!rows.length) return 0;

  const { error, data } = await supabase
    .from("james_learning_queue")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("James learning queue enqueue error:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

export async function claimJamesLearningItem(): Promise<JamesLearningQueueItem | null> {
  const supabase = db();
  if (!supabase) return null;

  const claimToken = randomUUID();
  const { data, error } = await supabase.rpc("claim_james_learning_queue_item", {
    p_claim_token: claimToken,
  });

  if (error) {
    console.error("James learning queue claim error:", error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    id: row.id,
    topic: row.topic,
    priority: Number(row.priority),
    taskType: row.task_type,
    reason: row.reason,
    status: row.status,
    attempts: Number(row.attempts),
    claimToken: row.claim_token,
  };
}

export async function finishJamesLearningItem(
  itemId: string,
  claimToken: string,
  result: { status: "completed" | "failed" | "rejected"; evidence?: unknown; error?: string }
) {
  const supabase = db();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("james_learning_queue")
    .update({
      status: result.status,
      evidence: result.evidence ?? null,
      last_error: result.error?.slice(0, 1000) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("claim_token", claimToken)
    .eq("status", "running")
    .select("id");

  if (error) {
    console.error("James learning queue completion error:", error.message);
    return false;
  }

  return (data?.length ?? 0) === 1;
}
