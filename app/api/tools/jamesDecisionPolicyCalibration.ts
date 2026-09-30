import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function calibrateJamesDecisionPolicy(
  policyKey: string,
  windowDays = 90,
) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("calibrate_james_decision_policy", {
    p_policy_key: policyKey,
    p_window_days: windowDays,
  });

  if (error) {
    console.warn("James decision policy calibration unavailable:", error.message);
    return null;
  }

  return data;
}

export async function getJamesDecisionPolicyCalibration(policyKey: string) {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("james_decision_policy_calibration")
    .select("*")
    .eq("policy_key", policyKey)
    .maybeSingle();

  if (error) {
    console.warn("James decision policy calibration read unavailable:", error.message);
    return null;
  }

  return data;
}
