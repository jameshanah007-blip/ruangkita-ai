import { createClient } from "@supabase/supabase-js";

type SocialMemory = {
  personName: string;
  relationship: string;
  confidence: number;
  evidence: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseSecretKey) return null;
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeSearchName(value: string) {
  return value.replace(/[^\p{L}\p{N} _-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function extractNames(text: string) {
  const matches = text.match(/\b[A-ZÀ-Ý][a-zà-ÿ]{1,30}\b/g) || [];
  return [...new Set(matches.map((name) => name.trim()))].slice(0, 5);
}

function relationshipLabel(memoryKey: string, memoryValue: string) {
  const key = normalize(memoryKey);
  const value = normalize(memoryValue);
  if (key.includes("classmate") || key.includes("teman_sekelas") || value.includes("teman sekelas")) return "teman sekelas";
  if (key.includes("friend") || key.includes("teman") || value.includes("teman")) return "teman";
  if (key.includes("sibling") || key.includes("saudara") || value.includes("kakak") || value.includes("adik")) return "saudara";
  if (key.includes("family") || key.includes("keluarga") || value.includes("keluarga")) return "keluarga";
  return "kenalan";
}

export async function getJamesSocialMemory(userId: string, userRequest: string) {
  const supabase = getSupabase();
  if (!supabase || !userId || !userRequest.trim()) return "";

  const { data: ownIdentity } = await supabase
    .from("james_memories")
    .select("memory_value, confidence")
    .eq("user_id", userId)
    .eq("memory_type", "identity")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const storedPersonName = clean(ownIdentity?.memory_value, 120);
  const currentPersonName =
    storedPersonName ||
    clean(
      userRequest.match(/\b(?:saya|aku|nama saya|nama aku)\s*[:=]?\s*([A-ZÀ-Ý][a-zà-ÿ]{1,30})\b/i)?.[1],
      120
    );
  const { data: ownRelationships, error: relationshipError } = await supabase
    .from("james_memories")
    .select("memory_key, memory_value, confidence, source_excerpt")
    .eq("user_id", userId)
    .eq("memory_type", "relationship")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(20);

  if (relationshipError) return "";

  const relationshipText = ownRelationships
    .map((item) => `${item.memory_key || ""} ${item.memory_value || ""} ${item.source_excerpt || ""}`)
    .join(" ");
  const names = extractNames(relationshipText);

  const { data: identities, error: identityError } = await supabase
    .from("james_memories")
    .select("user_id, memory_key, memory_value, confidence, source_excerpt")
    .eq("memory_type", "identity")
    .eq("status", "active")
    .in("memory_value", names)
    .order("confidence", { ascending: false })
    .limit(100);

  if (identityError || !identities?.length) return "";

  const associations: SocialMemory[] = [];
  const identityByUser = new Map<string, { name: string; confidence: number }>();
  for (const identity of identities) {
    const name = clean(identity.memory_value, 120);
    if (identity.user_id && name) {
      identityByUser.set(identity.user_id, {
        name,
        confidence: Number(identity.confidence) || 0,
      });
    }
  }

  // Direct relationships: the current user's own profile mentions another person.
  for (const identity of identities) {
    if (!identity.user_id || identity.user_id === userId) continue;
    const personName = clean(identity.memory_value, 120);
    if (!personName || !names.some((name) => normalize(name) === normalize(personName))) continue;

    for (const relationship of ownRelationships) {
      const combined = `${relationship.memory_key || ""} ${relationship.memory_value || ""} ${relationship.source_excerpt || ""}`;
      if (!normalize(combined).includes(normalize(personName))) continue;
      associations.push({
        personName,
        relationship: relationshipLabel(relationship.memory_key || "", relationship.memory_value || ""),
        confidence: Math.min(Number(relationship.confidence) || 0, Number(identity.confidence) || 0),
        evidence: clean(relationship.source_excerpt || relationship.memory_value, 240),
      });
    }
  }

  // Reverse relationships: another RuangKita member may have described a relationship with the current user.
  if (currentPersonName) {
    const safeCurrentPersonName = safeSearchName(currentPersonName);
    if (!safeCurrentPersonName) return "";

    const { data: allRelationships } = await supabase
      .from("james_memories")
      .select("user_id, memory_key, memory_value, confidence, source_excerpt")
      .eq("memory_type", "relationship")
      .eq("status", "active")
      .or(
        `memory_key.ilike.%${safeCurrentPersonName}%,memory_value.ilike.%${safeCurrentPersonName}%,source_excerpt.ilike.%${safeCurrentPersonName}%`
      )
      .order("confidence", { ascending: false })
      .limit(50);

    const reverseUserIds = [...new Set(
      (allRelationships || [])
        .map((relationship) => relationship.user_id)
        .filter((id): id is string => Boolean(id) && id !== userId)
    )];

    const { data: reverseIdentities } = reverseUserIds.length
      ? await supabase
          .from("james_memories")
          .select("user_id, memory_value, confidence")
          .eq("memory_type", "identity")
          .eq("status", "active")
          .in("user_id", reverseUserIds)
          .order("confidence", { ascending: false })
          .limit(100)
      : { data: [] };

    const reverseIdentityByUser = new Map<string, { name: string; confidence: number }>();
    for (const identity of reverseIdentities || []) {
      const name = clean(identity.memory_value, 120);
      if (!identity.user_id || !name || reverseIdentityByUser.has(identity.user_id)) continue;
      reverseIdentityByUser.set(identity.user_id, {
        name,
        confidence: Number(identity.confidence) || 0,
      });
    }

    for (const relationship of allRelationships || []) {
      if (!relationship.user_id || relationship.user_id === userId) continue;
      const combined = `${relationship.memory_key || ""} ${relationship.memory_value || ""} ${relationship.source_excerpt || ""}`;
      if (!normalize(combined).includes(normalize(currentPersonName))) continue;

      const sourcePerson = reverseIdentityByUser.get(relationship.user_id);
      if (!sourcePerson) continue;

      associations.push({
        personName: sourcePerson.name,
        relationship: relationshipLabel(relationship.memory_key || "", relationship.memory_value || ""),
        confidence: Math.min(Number(relationship.confidence) || 0, sourcePerson.confidence),
        evidence: clean(relationship.source_excerpt || relationship.memory_value, 240),
      });
    }
  }

  const unique = [...new Map(associations.map((item) => [`${normalize(item.personName)}:${item.relationship}`, item])).values()]
    .filter((item) => item.confidence >= 0.8)
    .slice(0, 5);

  if (!unique.length) return "";

  const request = normalize(userRequest);
  const socialSignals = /\b(halo|hai|saya|aku|nama|siapa|teman|temanku|kelas|sekelas|keluarga|saudara|kakak|adik)\b/i;
  const introductionSignal = /\b(?:saya|aku|nama saya|nama aku)\s*[:=]?\s*[a-zà-ÿ]/i;

  const scored = unique
    .map((item) => {
      const personMentioned = request.includes(normalize(item.personName));
      const relationshipMentioned =
        request.includes(normalize(item.relationship)) ||
        (item.relationship === "teman sekelas" && /\b(sekelas|satu kelas)\b/i.test(request));
      const conversationalSignal = socialSignals.test(request);
      const introduction = introductionSignal.test(request);

      let relevance = 0;
      if (personMentioned) relevance += 4;
      if (relationshipMentioned) relevance += 3;
      if (conversationalSignal) relevance += 1;
      if (introduction) relevance += 1;

      return { item, relevance };
    })
    .filter(({ relevance }) => relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.item.confidence - a.item.confidence)
    .slice(0, 3)
    .map(({ item }) => item);

  if (!scored.length) return "";

  return `MEMORI SOSIAL RUANGKITA:
James memiliki hubungan komunitas yang relevan dengan pengguna saat ini:
${scored.map((item) => `- ${item.personName}: ${item.relationship} (confidence ${item.confidence.toFixed(2)})`).join("\n")}

Gunakan hubungan ini hanya jika benar-benar relevan dengan percakapan. Jangan mengarang hubungan baru. Jangan mengungkap informasi pribadi pengguna lain yang tidak diperlukan. Jika menyebut hubungan seseorang, gunakan bahasa natural dan jangan membahas database atau mekanisme internal.`;
}
