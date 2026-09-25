import { createClient } from "@supabase/supabase-js";

type MemoryMessage = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseSecretKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function validId(value: string) {
  return /^[0-9a-fA-F-]{20,100}$/.test(value);
}

export async function getJamesMemory(userId: string, conversationId: string) {
  const supabase = getSupabase();

  if (!supabase || !validId(userId) || !validId(conversationId)) {
    return {
      summary: "",
      messages: [] as MemoryMessage[],
      available: false,
    };
  }

  const { data: messages, error } = await supabase
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("James memory read error:", error.message);
    return {
      summary: "",
      messages: [] as MemoryMessage[],
      available: false,
    };
  }

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("summary")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return {
    summary: conversation?.summary || "",
    messages: [...(messages || [])].reverse(),
    available: true,
  };
}

export async function saveJamesTurn(input: {
  userId: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  intent: string;
  tool: string;
}) {
  const supabase = getSupabase();

  if (
    !supabase ||
    !validId(input.userId) ||
    !validId(input.conversationId)
  ) {
    return;
  }

  const { error: conversationError } = await supabase
    .from("ai_conversations")
    .upsert(
      {
        id: input.conversationId,
        user_id: input.userId,
        title: input.userMessage.slice(0, 120),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (conversationError) {
    console.error(
      "James conversation save error:",
      conversationError.message
    );
    return;
  }

  const { error: messageError } = await supabase
    .from("ai_messages")
    .insert([
      {
        conversation_id: input.conversationId,
        user_id: input.userId,
        role: "user",
        content: input.userMessage,
        intent: input.intent,
        tool: input.tool,
      },
      {
        conversation_id: input.conversationId,
        user_id: input.userId,
        role: "assistant",
        content: input.assistantMessage,
        intent: input.intent,
        tool: input.tool,
      },
    ]);

  if (messageError) {
    console.error("James message save error:", messageError.message);
  }
}
