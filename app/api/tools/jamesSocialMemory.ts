import { createClient } from "@supabase/supabase-js";
import { rankJamesSocialAssociations } from "./socialMemoryRanking.js";

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
  return value.replace(/[^\p{L}\p{N} -]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
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

export async function getJamesSocialMemory(userId: string, userRequest: string, usageLessons: string[] = []) {
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

  const ownPerson = await supabase
    .from("james_people")
    .select("id, display_name")
    .eq("legacy_user_id", userId)
    .maybeSingle();

  const graphAssociations: SocialMemory[] = [];
  if (ownPerson.data?.id) {
    const { data: graphRows } = await supabase
      .from("james_relationships")
      .select("person_a_id, person_b_id, relationship_type, confidence, source_excerpt")
      .eq("status", "active")
      .eq("visibility", "relationship")
      .or(`person_a_id.eq.${ownPerson.data.id},person_b_id.eq.${ownPerson.data.id}`)
      .order("confidence", { ascending: false })
      .limit(30);

    const otherPersonIds = [...new Set(
      (graphRows || [])
        .map((row) => row.person_a_id === ownPerson.data.id ? row.person_b_id : row.person_a_id)
        .filter(Boolean)
    )];

    if (otherPersonIds.length) {
      const { data: people } = await supabase
        .from("james_people")
        .select("id, display_name")
        .in("id", otherPersonIds);

      const peopleById = new Map(
        (people || []).map((person) => [person.id, clean(person.display_name, 120)])
      );

      for (const row of graphRows || []) {
        const otherId = row.person_a_id === ownPerson.data.id ? row.person_b_id : row.person_a_id;
        const personName = peopleById.get(otherId);
        if (!personName) continue;
        graphAssociations.push({
          personName,
          relationship: clean(row.relationship_type, 80) || "kenalan",
          confidence: Number(row.confidence) || 0,
          evidence: clean(row.source_excerpt, 300),
        });
      }
    }
  }

  const relationshipText = ownRelationships
    .map((item) => `${item.memory_key || ""} ${item.memory_value || ""} ${item.source_excerpt || ""}`)
    .join(" ");
  const names = extractNames(relationshipText);

  // Privacy boundary: social memory may use only the current user's own
  // relationship memories. Do not query identity/relationship rows belonging
  // to other users merely because a shared name appears in memory.
  // Cross-user relationship discovery would turn private memories into an
  // implicit directory and could leak whether another user knows someone.
  const associations: SocialMemory[] = ownRelationships
    .flatMap((relationship) => {
      const combined = `${relationship.memory_key || ""} ${relationship.memory_value || ""} ${relationship.source_excerpt || ""}`;
      const matchedName = names.find((name) =>
        normalize(combined).includes(normalize(name))
      );

      if (!matchedName) return [];

      return [{
        personName: matchedName,
        relationship: relationshipLabel(
          relationship.memory_key || "",
          relationship.memory_value || ""
        ),
        confidence: Number(relationship.confidence) || 0,
        evidence: "",
      }];
    })
    .slice(0, 20);

  const mergedAssociations = [...associations, ...graphAssociations]
    .filter((item, index, all) =>
      all.findIndex(
        (candidate) =>
          normalize(candidate.personName) === normalize(item.personName) &&
          normalize(candidate.relationship) === normalize(item.relationship)
      ) === index
    )
    .slice(0, 30);

  const scored = rankJamesSocialAssociations(mergedAssociations, userRequest, usageLessons);

  if (!scored.length) return "";

  return `MEMORI SOSIAL RUANGKITA:
James memiliki hubungan komunitas yang relevan dengan pengguna saat ini:
${scored.map((item) => `- ${item.personName}: ${item.relationship} [association_key=${item.associationKey}] (confidence ${item.confidence.toFixed(2)})`).join("\n")}

Gunakan hubungan ini hanya jika benar-benar relevan dengan percakapan. Jangan mengarang hubungan baru. Jangan mengungkap informasi pribadi pengguna lain yang tidak diperlukan. Jika menyebut hubungan seseorang, gunakan bahasa natural dan jangan membahas database atau mekanisme internal.`;
}
