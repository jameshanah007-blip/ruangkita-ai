import { createClient } from "@supabase/supabase-js";

const WINDOW_SECONDS = 60;
const REQUEST_LIMIT = 20;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function consumeJamesRateLimit(userId: string) {
  const supabase = getAdminClient();
  if (!supabase) {
    // Fail closed for AI-consuming endpoints when the limiter cannot run.
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  }

  const { data, error } = await supabase.rpc("consume_james_rate_limit", {
    p_user_id: userId,
    p_limit: REQUEST_LIMIT,
    p_window_seconds: WINDOW_SECONDS,
  });

  if (error || !data?.[0]) {
    console.error("James rate limiter error:", error?.message || "missing result");
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  }

  const result = data[0] as {
    allowed: boolean;
    remaining: number;
    retry_after_seconds: number;
  };

  return {
    allowed: result.allowed === true,
    remaining: Math.max(0, Number(result.remaining) || 0),
    retryAfterSeconds: Math.max(1, Number(result.retry_after_seconds) || 60),
  };
}
