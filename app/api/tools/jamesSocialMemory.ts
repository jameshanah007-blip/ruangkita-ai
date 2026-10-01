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

  const { data: ownRelationships, error: relationshipError } = await supabase
    .from("james_memories")
    .select("memory_key, memory_value, confidence, source_excerpt")
    .eq("user_id", userId)
    .eq("memory_type", "relationship")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(20);

  if (relationshipError || !ownRelationships?.length) return "";

  const relationshipText = ownRelationships
    .map((item) => `${item.memory_key || ""} ${item.memory_value || ""} ${item.source_excerpt || ""}`)
    .join(" ");
  const names = extractNames(relationshipText);
  if (!names.length) return "";

  const { data: identities, error: identityError } = await supabase
    .from("james_memories")
    .select("user_id, memory_key, memory_value, confidence, source_excerpt")
    .eq("memory_type", "identity")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(500);

  if (identityError || !identities?.length) return "";

  const associations: SocialMemory[] = [];
  for (const identity of identities) {
    if (!identity.user_id || identity.user_id === userId) continue;
    const personName = clean(identity.memory_value, 120);
    if (!personName || !names.some((name) => normalize(name) === normalize(personName))) continue;

    for (const relationship of ownRelationships) {
      const combined = `${relationship.memory_key || ""} ${relationship.memory_value || ""} ${relationship.source_excerpt || ""}`;
      if (!names.some((name) => normalize(combined).includes(normalize(name)) && normalize(name) === normalize(personName))) continue;
      associations.push({
        personName,
        relationship: relationshipLabel(relationship.memory_key || "", relationship.memory_value || ""),
        confidence: Math.min(Number(relationship.confidence) || 0, Number(identity.confidence) || 0),
        evidence: clean(relationship.source_excerpt || relationship.memory_value, 240),
      });
    }
  }

  const unique = [...new Map(associations.map((item) => [`${normalize(item.personName)}:${item.relationship}`, item])).values()]
    .filter((item) => item.confidence >= 0.8)
    .slice(0, 5);

  if (!unique.length) return "";

  const relevant = unique.filter((item) =>
    normalize(userRequest).includes(normalize(item.personName)) ||
    /\b(halo|hai|saya|aku|nama|siapa|teman|kelas|keluarga)\b/i.test(userRequest)
  );
  const selected = relevant.length ? relevant : unique;

  return `MEMORI SOSIAL RUANGKITA:
James memiliki hubungan komunitas yang relevan dengan pengguna saat ini:
${selected.map((item) => `- ${item.personName}: ${item.relationship} (confidence ${item.confidence.toFixed(2)})`).join("\n")}

Gunakan hubungan ini hanya jika benar-benar relevan dengan percakapan. Jangan mengarang hubungan baru. Jika menyebut hubungan seseorang, gunakan bahasa natural dan jangan membahas database atau mekanisme internal.`;
}
