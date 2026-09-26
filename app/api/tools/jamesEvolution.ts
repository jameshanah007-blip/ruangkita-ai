import { createClient } from "@supabase/supabase-js";

export type JamesGrowth = {
  communication_style: Record<string, string>;
  interests: string[];
  learned_topics: string[];
  lessons: string[];
  preferences: Record<string, string>;
  evolution_version: number;
};

export type JamesEvolutionProposal = {
  category: "communication_style" | "interest" | "learned_topic" | "lesson" | "preference";
  key: string;
  value: string;
  reason: string;
  confidence: number;
  source_excerpt: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const MAX_ITEMS = 20;
const MAX_TEXT = 240;

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

function clampConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function uniqueStrings(values: unknown, max = MAX_ITEMS) {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => cleanText(value))
      .filter(Boolean)
  )].slice(-max);
}

function cleanRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [cleanText(key, 60), cleanText(item, 160)])
      .filter(([key, item]) => Boolean(key && item))
      .slice(-MAX_ITEMS)
  );
}

export async function getJamesGrowth(userId: string): Promise<JamesGrowth> {
  const fallback: JamesGrowth = {
    communication_style: {},
    interests: [],
    learned_topics: [],
    lessons: [],
    preferences: {},
    evolution_version: 1,
  };

  const supabase = getSupabase();
  if (!supabase || !validId(userId)) return fallback;

  const { data, error } = await supabase
    .from("james_growth_state")
    .select("communication_style, interests, learned_topics, lessons, preferences, evolution_version")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("James growth read error:", error.message);
    return fallback;
  }

  return {
    communication_style: cleanRecord(data.communication_style),
    interests: uniqueStrings(data.interests),
    learned_topics: uniqueStrings(data.learned_topics),
    lessons: uniqueStrings(data.lessons),
    preferences: cleanRecord(data.preferences),
    evolution_version: typeof data.evolution_version === "number" ? data.evolution_version : 1,
  };
}

export async function applyJamesEvolution(
  userId: string,
  conversationId: string,
  userRequest: string,
  proposals: JamesEvolutionProposal[]
) {
  const supabase = getSupabase();
  if (!supabase || !validId(userId) || !validId(conversationId)) return;

  const safe = proposals
    .map((proposal) => ({
      category: proposal.category,
      key: cleanText(proposal.key, 60),
      value: cleanText(proposal.value),
      reason: cleanText(proposal.reason),
      confidence: clampConfidence(proposal.confidence),
      source_excerpt: cleanText(proposal.source_excerpt, 320),
    }))
    .filter((proposal) =>
      proposal.key &&
      proposal.value &&
      proposal.confidence >= 0.70 &&
      proposal.source_excerpt.length >= 3 &&
      userRequest.toLowerCase().includes(proposal.source_excerpt.toLowerCase())
    )
    .slice(0, 5);

  if (!safe.length) return;

  const current = await getJamesGrowth(userId);
  const next = {
    communication_style: { ...current.communication_style },
    interests: [...current.interests],
    learned_topics: [...current.learned_topics],
    lessons: [...current.lessons],
    preferences: { ...current.preferences },
    evolution_version: current.evolution_version + 1,
  };

  for (const proposal of safe) {
    if (proposal.category === "communication_style") {
      next.communication_style[proposal.key] = proposal.value;
    } else if (proposal.category === "preference") {
      next.preferences[proposal.key] = proposal.value;
    } else if (proposal.category === "interest") {
      next.interests = [...new Set([...next.interests, proposal.value])].slice(-MAX_ITEMS);
    } else if (proposal.category === "learned_topic") {
      next.learned_topics = [...new Set([...next.learned_topics, proposal.value])].slice(-MAX_ITEMS);
    } else if (proposal.category === "lesson") {
      next.lessons = [...new Set([...next.lessons, proposal.value])].slice(-MAX_ITEMS);
    }
  }

  const { error: stateError } = await supabase
    .from("james_growth_state")
    .upsert({
      user_id: userId,
      communication_style: next.communication_style,
      interests: next.interests,
      learned_topics: next.learned_topics,
      lessons: next.lessons,
      preferences: next.preferences,
      evolution_version: next.evolution_version,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (stateError) {
    console.error("James growth save error:", stateError.message);
    return;
  }

  const { error: eventError } = await supabase
    .from("james_evolution_events")
    .insert(safe.map((proposal) => ({
      user_id: userId,
      conversation_id: conversationId,
      category: proposal.category,
      key: proposal.key,
      value: proposal.value,
      reason: proposal.reason,
      confidence: proposal.confidence,
      source_excerpt: proposal.source_excerpt,
      status: "applied",
    })));

  if (eventError) console.error("James evolution event save error:", eventError.message);
}

export async function saveJamesFeedback(input: {
  userId: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  rating: "helpful" | "not_helpful";
  feedback?: string;
}) {
  const supabase = getSupabase();
  if (!supabase || !validId(input.userId) || !validId(input.conversationId)) {
    return false;
  }

  const feedback = cleanText(input.feedback || "", 500);
  const { error } = await supabase.from("james_feedback").insert({
    user_id: input.userId,
    conversation_id: input.conversationId,
    user_message: cleanText(input.userMessage, 1000),
    assistant_message: cleanText(input.assistantMessage, 2000),
    rating: input.rating,
    feedback,
  });

  if (error) {
    console.error("James feedback save error:", error.message);
    return false;
  }

  return true;
}

export async function getRecentJamesFeedback(
  userId: string,
  conversationId: string,
  limit = 5
) {
  const supabase = getSupabase();
  if (!supabase || !validId(userId) || !validId(conversationId)) return [];

  const { data, error } = await supabase
    .from("james_feedback")
    .select("rating, feedback, user_message, assistant_message, created_at")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 5));

  if (error) {
    console.error("James feedback read error:", error.message);
    return [];
  }

  return (data || []).map((item) => ({
    rating: item.rating as "helpful" | "not_helpful",
    feedback: cleanText(item.feedback || "", 500),
    userMessage: cleanText(item.user_message || "", 1000),
    assistantMessage: cleanText(item.assistant_message || "", 2000),
    createdAt: item.created_at,
  }));
}
