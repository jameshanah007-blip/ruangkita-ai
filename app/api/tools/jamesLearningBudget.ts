import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function configuredLimit() {
  const value = Number(process.env.JAMES_DAILY_LEARNING_CALL_BUDGET ?? 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(100, Math.floor(value))) : 8;
}

export async function reserveJamesLearningCalls(calls = 1) {
  const supabase = db();
  if (!supabase) return true;

  const amount = Math.max(1, Math.floor(calls));
  const limit = configuredLimit();

  const { data, error } = await supabase.rpc("reserve_james_learning_budget", {
    p_calls: amount,
    p_max_calls: limit,
  });

  if (error) {
    console.error("James learning budget reservation failed:", error.message);
    return false;
  }

  return data === true;
}

export function getJamesDailyLearningBudget() {
  return configuredLimit();
}
