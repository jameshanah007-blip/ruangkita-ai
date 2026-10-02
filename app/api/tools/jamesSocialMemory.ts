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

  const explicitPersonName = clean(
    userRequest.match(
      /\b(?:saya|aku|nama saya|nama aku)\s*[:=]?\s*(?:adalah\s+)?([A-ZÀ-Ý][a-zà-ÿ]{1,30})\b/i
    )?.[1],
    120
  );
  // The current turn is the strongest identity signal. Historical identity
  // memories must not override an explicit current self-introduction.
  const storedPersonName = clean(ownIdentity?.memory_value, 120);
  const currentPersonName = explicitPersonName || storedPersonName;
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

  const mutualAssociations: SocialMemory[] = [];

  // A cross-user social link is usable only when both sides independently
  // stated the relationship. We never expose the other person's conversation.
  if (currentPersonName && associations.length) {
    for (const association of associations.slice(0, 10)) {
      const targetName = safeSearchName(association.personName);
      const currentName = safeSearchName(currentPersonName);
      if (!targetName || !currentName) continue;

      const { data: targetIdentities } = await supabase
        .from("james_memories")
        .select("user_id, memory_value, confidence")
        .eq("memory_type", "identity")
        .eq("status", "active")
        .ilike("memory_value", targetName)
        .neq("user_id", userId)
        .order("confidence", { ascending: false })
        .limit(20);

      const candidateIds = [...new Set(
        (targetIdentities || [])
          .map((item) => item.user_id)
          .filter((id): id is string => typeof id === "string" && id !== userId)
      )];

      for (const candidateId of candidateIds) {
        const { data: reciprocal } = await supabase
          .from("james_memories")
          .select("memory_key, memory_value, source_excerpt, confidence")
          .eq("user_id", candidateId)
          .eq("memory_type", "relationship")
          .eq("status", "active")
          .or(
            "memory_value.ilike.%" + currentName + "%,source_excerpt.ilike.%" + currentName + "%"
          )
          .order("confidence", { ascending: false })
          .limit(1);

        if (reciprocal?.length) {
          mutualAssociations.push({
            personName: association.personName,
            relationship: association.relationship,
            confidence: Math.min(
              Number(association.confidence) || 0,
              Number(reciprocal[0].confidence) || 0
            ),
            evidence: "mutual explicit relationship",
          });
          break;
        }
      }
    }
  }

  const scored = rankJamesSocialAssociations(
    [...associations, ...mutualAssociations],
    userRequest,
    usageLessons
  );

  if (!scored.length) return "";

  return `MEMORI SOSIAL RUANGKITA:
Hubungan sosial yang relevan dan telah dinyatakan secara eksplisit:
${scored.map((item) => `- ${item.personName}: ${item.relationship} [association_key=${item.associationKey}] (confidence ${item.confidence.toFixed(2)}${item.evidence === "mutual explicit relationship" ? ", mutual" : ""})`).join("\n")}

ATURAN MEMORI SOSIAL:
- Jika hubungan bertanda "mutual", James boleh menyimpulkan bahwa kedua pihak saling mengenal berdasarkan pernyataan eksplisit masing-masing.
- Jangan mengungkap isi percakapan, waktu percakapan, atau fakta pribadi lain dari pihak lain.
- Jika hubungan belum mutual, gunakan hanya sebagai fakta dari pengguna saat ini.
- Jangan menggabungkan dua orang hanya karena nama mereka sama.
- Rangkai hubungan menjadi kalimat natural; jangan membaca association_key atau mekanisme internal kepada pengguna.`;
}
