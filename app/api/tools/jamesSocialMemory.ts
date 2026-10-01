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

export function rankJamesSocialAssociations(
  associations: SocialMemory[],
  userRequest: string,
): SocialMemory[] {
  const scored = rankJamesSocialAssociations(associations, userRequest);

  if (!scored.length) return "";

  return `MEMORI SOSIAL RUANGKITA:
James memiliki hubungan komunitas yang relevan dengan pengguna saat ini:
${scored.map((item) => `- ${item.personName}: ${item.relationship} (confidence ${item.confidence.toFixed(2)})`).join("\n")}

Gunakan hubungan ini hanya jika benar-benar relevan dengan percakapan. Jangan mengarang hubungan baru. Jangan mengungkap informasi pribadi pengguna lain yang tidak diperlukan. Jika menyebut hubungan seseorang, gunakan bahasa natural dan jangan membahas database atau mekanisme internal.`;
}
