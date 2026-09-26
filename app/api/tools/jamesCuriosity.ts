import { createClient } from "@supabase/supabase-js";

export type JamesCuriosityProposal = {
  topic: string;
  question: string;
  importance: number;
  evidence: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const MAX_TEXT = 300;

function getSupabase() {
  if (!supabaseUrl || !supabaseSecretKey) return null;
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function validId(value: string) {
  return /^[0-9a-fA-F-]{20,100}$/.test(value);
}

function cleanText(value: unknown, max = MAX_TEXT) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clamp(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export async function saveJamesCuriosity(
  userId: string,
  conversationId: string,
  proposals: JamesCuriosityProposal[],
) {
  const supabase = getSupabase();
  if (!supabase || !validId(userId) || !validId(conversationId)) return;

  const safe = proposals
    .map((item) => ({
      user_id: userId,
      conversation_id: conversationId,
      topic: cleanText(item.topic, 160),
      question: cleanText(item.question, 400),
      importance: clamp(item.importance),
      evidence: cleanText(item.evidence, 400),
      status: "open",
    }))
    .filter((item) => item.topic && item.question && item.importance >= 0.60)
    .slice(0, 3);

  if (!safe.length) return;

  const { error } = await supabase.from("james_curiosity").insert(safe);
  if (error) console.error("James curiosity save error:", error.message);
}

export async function getOpenJamesCuriosity(userId: string, limit = 8) {
  const supabase = getSupabase();
  if (!supabase || !validId(userId)) return [];

  const { data, error } = await supabase
    .from("james_curiosity")
    .select("id, topic, question, importance, status, evidence, updated_at")
    .eq("user_id", userId)
    .in("status", ["open", "exploring"])
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error) {
    console.error("James curiosity read error:", error.message);
    return [];
  }

  return data || [];
}
