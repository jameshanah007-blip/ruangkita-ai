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

export async function getJamesPreviousConversationMessages(
  userId: string,
  currentConversationId: string,
  limit = 40,
): Promise<MemoryMessage[]> {
  const supabase = getSupabase();

  if (
    !supabase ||
    !validId(userId) ||
    !validId(currentConversationId)
  ) {
    return [];
  }

  const { data, error } = await supabase
    .from("ai_messages")
    .select("role, content, created_at, conversation_id")
    .eq("user_id", userId)
    .neq("conversation_id", currentConversationId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 80));

  if (error) {
    console.error("James previous conversation memory read error:", error.message);
    return [];
  }

  return [...(data || [])]
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .reverse()
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
      created_at: message.created_at,
    }));
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

function memoryPriority(memoryType: JamesLongTermMemory["memory_type"]) {
  const priorities: Record<JamesLongTermMemory["memory_type"], number> = {
    identity: 5,
    relationship: 5,
    project: 4,
    goal: 4,
    preference: 3,
    interest: 2,
    context: 1,
  };

  return priorities[memoryType] ?? 0;
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

export async function getJamesRelevantConversationMessages(
  userId: string,
  currentConversationId: string,
  userRequest: string,
  limit = 20,
): Promise<MemoryMessage[]> {
  const supabase = getSupabase();
  if (!supabase || !validId(userId) || !validId(currentConversationId)) return [];
  const stopWords = new Set([
    "apa","apakah","yang","dan","atau","dari","dengan","untuk","kamu","aku","saya",
    "kita","masih","pernah","ingat","tentang","sebelumnya","percakapan","chat",
    "obrolan","siapa","namaku","nama","coba","lihat","ini","itu","the","and","what",
    "who","did","you","remember",
  ]);
  const terms=[...new Set(userRequest.toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff\s-]/gi," ")
    .split(/\s+/).map(term=>term.trim())
    .filter(term=>term.length>=3&&!stopWords.has(term)))].slice(0,12);
  const {data,error}=await supabase.from("ai_messages")
    .select("role, content, created_at, conversation_id")
    .eq("user_id",userId).neq("conversation_id",currentConversationId)
    .order("created_at",{ascending:false}).limit(200);
  if(error){console.error("James relevant conversation memory read error:",error.message);return[];}
  const scored=(data||[]).filter(message=>
    (message.role==="user"||message.role==="assistant")&&typeof message.content==="string"&&message.content.trim()
  ).map(message=>{
    const words=new Set(message.content.toLowerCase().split(/\s+/).map((word: string) =>
      word.replace(/^[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]+|[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]+$/gi,"")
    ));
    const score=terms.reduce((sum,term)=>sum+(words.has(term)?3:0),0)+(message.role==="user"?1:0);
    return {message:{role:message.role as "user"|"assistant",content:message.content,created_at:message.created_at},score};
  }).filter(item=>terms.length?item.score>0:true)
    .sort((a,b)=>b.score-a.score||String(b.message.created_at||"").localeCompare(String(a.message.created_at||"")))
    .slice(0,Math.min(Math.max(limit,1),40)).map(item=>item.message);
  return scored.sort((a,b)=>String(a.created_at||"").localeCompare(String(b.created_at||"")));
}

function extractExplicitJamesMemories(userRequest: string): JamesMemoryProposal[] {
  const proposals: JamesMemoryProposal[]=[];
  const cleanName=(value:string)=>value.trim().replace(/^[,.:;!?]+|[,.:;!?]+$/g,"").slice(0,80);
  const identityPatterns=[
    /\b(?:halo|hai)?\s*(?:james[,! ]+)?(?:saya|aku)\s+(?:adalah\s+)?([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{1,40})\b/i,
    /\b(?:nama saya|namaku|nama aku)\s+(?:adalah\s+)?([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{1,40})\b/i,
  ];
  for(const pattern of identityPatterns){
    const match=userRequest.match(pattern); if(!match?.[1]) continue;
    const name=cleanName(match[1]); if(!name||/^(james|kamu|aku|saya)$/i.test(name)) continue;
    proposals.push({memory_type:"identity",memory_key:"self_name:"+name.toLowerCase(),memory_value:name,memory_action:"upsert",confidence:0.99,source_excerpt:match[0].trim().slice(0,400),expires_in_days:null}); break;
  }
  const relationshipPatterns=[
    /\b(?:saya|aku)\s+punya\s+teman\s+namanya\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{1,40})\b/i,
    /\b([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{1,40})\s+(?:juga\s+)?teman\s+(?:saya|aku)\b/i,
    /\b([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{1,40})\s+adalah\s+teman\s+(?:saya|aku)\b/i,
  ];
  for(const pattern of relationshipPatterns){
    const match=userRequest.match(pattern); if(!match?.[1]) continue;
    const name=cleanName(match[1]); if(!name||/^(james|kamu|aku|saya)$/i.test(name)) continue;
    proposals.push({memory_type:"relationship",memory_key:"friend:"+name.toLowerCase(),memory_value:name+" adalah teman pengguna.",memory_action:"upsert",confidence:0.98,source_excerpt:match[0].trim().slice(0,400),expires_in_days:null}); break;
  }
  return proposals.slice(0,3);
}

export async function saveExplicitJamesMemories(userId:string,conversationId:string,userRequest:string){
  const proposals=extractExplicitJamesMemories(userRequest);
  if(!proposals.length)return;
  await saveJamesMemoryProposals(userId,conversationId,userRequest,proposals);
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

  return [...(data || [])]
    .map((memory) => memory as JamesLongTermMemory)
    .sort((a, b) => {
      const priorityDiff = memoryPriority(b.memory_type) - memoryPriority(a.memory_type);
      if (priorityDiff !== 0) return priorityDiff;

      const confidenceDiff = (Number(b.confidence) || 0) - (Number(a.confidence) || 0);
      if (confidenceDiff !== 0) return confidenceDiff;

      return String(b.last_confirmed_at || "").localeCompare(
        String(a.last_confirmed_at || "")
      );
    });
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

        if (error) {
          console.error("James memory supersede error:", error.message);
          continue;
        }
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
        console.error("James replacement memory insert error:", error.message);
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

export async function getJamesMemoryAudit(userId: string, limit = 100) {
  const supabase = getSupabase();
  if (!supabase || !validId(userId)) {
    return {
      counts: { active: 0, superseded: 0, expired: 0, rejected: 0 },
      memories: [] as JamesLongTermMemory[],
    };
  }

  const now = new Date().toISOString();

  const { error: expiryError } = await supabase
    .from("james_memories")
    .update({ status: "expired", updated_at: now })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("expires_at", now);

  if (expiryError) {
    console.error("James memory audit expiry error:", expiryError.message);
  }

  const { data, error } = await supabase
    .from("james_memories")
    .select(
      "id, memory_type, memory_key, memory_value, confidence, status, source_excerpt, last_confirmed_at, expires_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) {
    console.error("James memory audit error:", error.message);
    return {
      counts: { active: 0, superseded: 0, expired: 0, rejected: 0 },
      memories: [] as JamesLongTermMemory[],
    };
  }

  const counts = {
    active: 0,
    superseded: 0,
    expired: 0,
    rejected: 0,
  };

  for (const memory of data || []) {
    const status = memory.status as keyof typeof counts;
    if (status in counts) counts[status] += 1;
  }

  return {
    counts,
    memories: (data || []).map((memory) => ({
      id: memory.id,
      memory_type: memory.memory_type,
      memory_key: memory.memory_key,
      memory_value: memory.memory_value,
      confidence: memory.confidence,
      status: memory.status,
      source_excerpt: memory.source_excerpt,
      last_confirmed_at: memory.last_confirmed_at,
      expires_at: memory.expires_at,
    })) as JamesLongTermMemory[],
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

  // A conversation UUID is not an authorization credential. Before writing,
  // verify that an existing conversation belongs to the signed session user.
  // Without this check, a guessed/obtained conversation ID could be rebound
  // to another user through the upsert on the primary key.
  const { data: existingConversation, error: existingConversationError } = await supabase
    .from("ai_conversations")
    .select("user_id")
    .eq("id", input.conversationId)
    .maybeSingle();

  if (existingConversationError) {
    console.error(
      "James conversation ownership check error:",
      existingConversationError.message
    );
    return;
  }

  if (
    existingConversation &&
    existingConversation.user_id &&
    existingConversation.user_id !== input.userId
  ) {
    console.error("James conversation ownership mismatch.");
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
        tool: input.tool,      },
    ]);

  if (messageError) {
    console.error("James message save error:", messageError.message);
    return;
  }

  const { data: recentMessages } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("user_id", input.userId)
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: false })
    .limit(12);

  const summary = [...(recentMessages || [])]
    .reverse()
    .map((message) => {
      const role = message.role === "user" ? "Pengguna" : "James";
      const content =
        typeof message.content === "string"
          ? message.content.trim().replace(/\s+/g, " ").slice(0, 500)
          : "";
      return content ? `${role}: ${content}` : "";
    })
    .filter(Boolean)
    .join("\n");

  if (summary) {
    const { error: summaryError } = await supabase
      .from("ai_conversations")
      .update({
        summary: summary.slice(-5000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.conversationId)
      .eq("user_id", input.userId);

    if (summaryError) {
      console.error("James conversation summary error:", summaryError.message);
    }
  }
}