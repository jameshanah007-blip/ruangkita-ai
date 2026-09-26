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
    .eq("conversation_id", conversationId)
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

export type JamesLongTermMemory = {
  id: string;
  memory_type: "identity" | "preference" | "interest" | "project" | "goal" | "context" | "relationship";
  memory_key: string;
  memory_value: string;
  memory_action: "upsert" | "supersede";
  confidence: number;
  status: "active" | "superseded" | "expired" | "rejected";
  source_excerpt: string;
  last_confirmed_at?: string;
  expires_at?: string | null;
};

export type JamesMemoryProposal = {
  memory_type: JamesLongTermMemory["memory_type"];
  memory_key: string;
  memory_value: string;
  memory_action: "upsert" | "supersede";
  confidence: number;
  source_excerpt: string;
  expires_in_days?: number | null;
};

const MEMORY_TYPES = new Set<JamesLongTermMemory["memory_type"]>([
  "identity",
  "preference",
  "interest",
  "project",
  "goal",
  "context",
  "relationship",
]);

function cleanMemoryText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampMemoryConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function isSensitiveMemory(text: string) {
  const value = text.toLowerCase();
  const blocked = [
    "password", "kata sandi", "token", "api key", "apikey", "secret",
    "credential", "nomor identitas", "nik", "npwp", "nomor telepon",
    "alamat lengkap", "lokasi presisi", "medical", "medis", "diagnosis",
    "penyakit", "kesehatan", "agama", "politik", "partai", "orientasi seksual",
    "sexual orientation", "rekening", "nomor rekening",
  ];
  return blocked.some((item) => value.includes(item));
}

function memoryExpiry(memoryType: JamesLongTermMemory["memory_type"], days?: number | null) {
  if (memoryType === "identity" || memoryType === "relationship") return null;
  const requested = typeof days === "number" && Number.isFinite(days) ? Math.round(days) : undefined;
  const defaults: Record<string, number> = {
    preference: 180,
    interest: 180,
    project: 90,
    goal: 90,
    context: 30,
  };
  const maxDays = memoryType === "context" ? 90 : 365;
  const safeDays = Math.max(1, Math.min(requested ?? defaults[memoryType], maxDays));
  return new Date(Date.now() + safeDays * 86400000).toISOString();
}

export async function getJamesLongTermMemory(userId: string, limit = 30): Promise<JamesLongTermMemory[]> {
  const supabase = getSupabase();
  if (!supabase || !validId(userId)) return [];

  const now = new Date().toISOString();

  const { error: expiryError } = await supabase
    .from("james_memories")
    .update({ status: "expired", updated_at: now })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("expires_at", now);

  if (expiryError) {
    console.error("James memory expiry error:", expiryError.message);
  }

  const { data, error } = await supabase
    .from("james_memories")
    .select("id, memory_type, memory_key, memory_value, confidence, status, source_excerpt, last_confirmed_at, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) {
    console.error("James long-term memory read error:", error.message);
    return [];
  }

  return (data || []) as JamesLongTermMemory[];
}

export async function saveJamesMemoryProposals(
  userId: string,
  conversationId: string,
  userRequest: string,
  proposals: JamesMemoryProposal[],
) {
  const supabase = getSupabase();
  if (!supabase || !validId(userId) || !validId(conversationId)) return;

  const safe = proposals
    .map((proposal) => ({
      memory_type: proposal.memory_type,
      memory_key: cleanMemoryText(proposal.memory_key, 80).toLowerCase(),
      memory_value: cleanMemoryText(proposal.memory_value, 500),
      memory_action: proposal.memory_action,
      confidence: clampMemoryConfidence(proposal.confidence),
      source_excerpt: cleanMemoryText(proposal.source_excerpt, 400),
      expires_in_days: proposal.expires_in_days,
    }))
    .filter((proposal) =>
      MEMORY_TYPES.has(proposal.memory_type) &&
      proposal.memory_key &&
      proposal.memory_value &&
      (proposal.memory_action === "upsert" || proposal.memory_action === "supersede") &&
      proposal.confidence >= 0.80 &&
      proposal.source_excerpt.length >= 3 &&
      userRequest.toLowerCase().includes(proposal.source_excerpt.toLowerCase()) &&
      !isSensitiveMemory(
        `${proposal.memory_key} ${proposal.memory_value} ${proposal.source_excerpt}`
      )
    )
    .slice(0, 5);

  if (!safe.length) return;

  for (const proposal of safe) {
    const { data: existing } = await supabase
      .from("james_memories")
      .select("id, memory_value, confidence")
      .eq("user_id", userId)
      .eq("memory_type", proposal.memory_type)
      .eq("memory_key", proposal.memory_key)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const expiresAt = memoryExpiry(proposal.memory_type, proposal.expires_in_days);
    const now = new Date().toISOString();

    if (proposal.memory_action === "supersede") {
      if (existing) {
        const { error } = await supabase
          .from("james_memories")
          .update({
            status: "superseded",
            updated_at: now,
            last_confirmed_at: now,
          })
          .eq("id", existing.id);

        if (error) console.error("James memory supersede error:", error.message);
      }
      continue;
    }

    if (existing) {
      const sameValue = existing.memory_value === proposal.memory_value;
      const nextConfidence = Math.max(
        Number(existing.confidence) || 0,
        proposal.confidence
      );

      const { error } = await supabase
        .from("james_memories")
        .update({
          conversation_id: conversationId,
          confidence: nextConfidence,
          source_excerpt: proposal.source_excerpt,
          last_confirmed_at: now,
          expires_at: expiresAt,
          updated_at: now,
          ...(sameValue ? {} : { status: "superseded" }),
        })
        .eq("id", existing.id);

      if (error) {
        console.error("James memory update error:", error.message);
        continue;
      }

      if (!sameValue) {
        await supabase.from("james_memories").insert({
          user_id: userId,
          conversation_id: conversationId,
          memory_type: proposal.memory_type,
          memory_key: proposal.memory_key,
          memory_value: proposal.memory_value,
          confidence: proposal.confidence,
          status: "active",
          source_excerpt: proposal.source_excerpt,
          last_confirmed_at: now,
          expires_at: expiresAt,
          updated_at: now,
        });
      }
      continue;
    }

    const { error } = await supabase.from("james_memories").insert({
      user_id: userId,
      conversation_id: conversationId,
      memory_type: proposal.memory_type,
      memory_key: proposal.memory_key,
      memory_value: proposal.memory_value,
      confidence: proposal.confidence,
      status: "active",
      source_excerpt: proposal.source_excerpt,
      last_confirmed_at: now,
      expires_at: expiresAt,
      updated_at: now,
    });

    if (error) {
      console.error("James memory insert error:", error.message);
    }
  }
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
