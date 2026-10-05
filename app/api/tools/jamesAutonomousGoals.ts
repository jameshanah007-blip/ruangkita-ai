import { createClient } from "@supabase/supabase-js";

export type JamesAutonomousGoal = {
  id: string;
  user_id: string;
  conversation_id: string;
  title: string;
  goal: string;
  status: "pending" | "running" | "paused" | "completed" | "failed";
  priority: number;
  max_cycles: number;
  next_run_at: string;
  attempts: number;
  last_result?: string | null;
  last_run_at?: string | null;
  last_error?: string | null;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function createJamesAutonomousGoal(input: {
  userId: string;
  conversationId: string;
  title: string;
  goal: string;
  priority?: number;
  maxCycles?: number;
  nextRunAt?: string;
}) {
  const client = db();
  if (!client) throw new Error("Supabase secret configuration is missing.");

  const { data, error } = await client
    .from("james_autonomous_goals")
    .insert({
      user_id: input.userId,
      conversation_id: input.conversationId,
      title: input.title.trim().slice(0, 160),
      goal: input.goal.trim().slice(0, 8000),
      priority: Math.min(Math.max(input.priority || 50, 0), 100),
      max_cycles: Math.min(Math.max(input.maxCycles || 2, 1), 5),
      next_run_at: input.nextRunAt || new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error("Gagal membuat autonomous goal: " + error.message);
  return data as JamesAutonomousGoal;
}

export async function claimJamesAutonomousGoal() {
  const client = db();
  if (!client) throw new Error("Supabase secret configuration is missing.");

  const { data, error } = await client
    .rpc("claim_james_autonomous_goal")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Gagal melakukan atomic claim autonomous goal: " + error.message);
  }

  if (!data) {
    throw new Error("Tidak ada autonomous goal yang berhasil di-claim.");
  }

  return data as JamesAutonomousGoal;
}

export async function getDueJamesAutonomousGoals(limit = 1) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_autonomous_goals")
    .select("*")
    .eq("status", "pending")
    .lte("next_run_at", new Date().toISOString())
    .order("priority", { ascending: false })
    .order("next_run_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 5));

  if (error) throw new Error("Gagal membaca autonomous goals: " + error.message);
  return (data || []) as JamesAutonomousGoal[];
}

export async function updateJamesAutonomousGoal(
  id: string,
  owner: { userId: string; conversationId: string },
  patch: Partial<Pick<JamesAutonomousGoal, "status" | "next_run_at" | "last_run_at" | "attempts" | "last_result" | "last_error">>,
) {
  const client = db();
  if (!client || !id || !owner.userId || !owner.conversationId) return;

  const { error } = await client
    .from("james_autonomous_goals")
    .update(patch)
    .eq("id", id)
    .eq("user_id", owner.userId)
    .eq("conversation_id", owner.conversationId);

  if (error) throw new Error("Gagal memperbarui autonomous goal: " + error.message);
}
