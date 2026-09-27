import { createClient } from "@supabase/supabase-js";
import { generateWithJamesResourceManager } from "./jamesResourceManager";

type MetaInput = {
  pattern: string;
  strategy: string;
  capabilities: string[];
  verified: boolean;
};

export type JamesMetaStrategy = {
  id?: string;
  taskClass: string;
  strategy: string;
  capabilities: string[];
  evidenceCount: number;
  successCount: number;
  failureCount: number;
  confidence: number;
  status: "candidate" | "active" | "retired";
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clamp(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9áéíóúàèìòùâêîôûäëïöüñ\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function overlap(a: string, b: string) {
  const left = new Set(normalize(a).split(" ").filter((x) => x.length > 2));
  const right = new Set(normalize(b).split(" ").filter((x) => x.length > 2));
  if (!left.size || !right.size) return 0;
  let hits = 0;
  for (const token of left) if (right.has(token)) hits++;
  return hits / Math.max(3, Math.min(left.size, right.size));
}

export async function learnJamesMetaStrategy(input: MetaInput) {
  if (!input.verified) return null;
  const supabase = db();
  if (!supabase || !input.pattern || !input.strategy) return null;

  try {
    const classification = await generateWithJamesResourceManager("learning", {
      prompt: [
        "Ubah pengalaman James berikut menjadi pengetahuan strategi tingkat meta.",
        "Task class harus generik, misalnya 'research_and_compare', 'structured_writing', 'planning', atau 'problem_solving'.",
        "Strategi harus generik dan tidak boleh berisi identitas, data pribadi, isi percakapan, credential, token, API key, password, email, nomor telepon, atau kode verifikasi.",
        "Jangan menyimpan fakta spesifik pengguna.",
        "",
        "PATTERN:",
        clean(input.pattern, 350),
        "STRATEGY:",
        clean(input.strategy, 700),
        "CAPABILITIES:",
        input.capabilities.slice(0, 8).join(", "),
        "",
        "Output JSON saja:",
        '{"taskClass":"...","strategy":"...","confidence":0.0}',
      ].join("\n"),
      systemInstruction: "Kamu adalah James Meta-Learning Engine. Ekstrak hanya strategi generik yang dapat dipakai lintas task dan lintas pengguna.",
      temperature: 0.1,
      maxOutputTokens: 650,
    });

    const start = classification.text.indexOf("{");
    const end = classification.text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    const parsed = JSON.parse(classification.text.slice(start, end + 1)) as Record<string, unknown>;
    const taskClass = normalize(clean(parsed.taskClass, 120)).slice(0, 120);
    const strategy = clean(parsed.strategy, 700);
    const confidence = clamp(parsed.confidence);
    if (!taskClass || !strategy || confidence < 0.75) return null;

    const capabilities = [...new Set(input.capabilities)].slice(0, 8);
    const { data } = await supabase
      .from("james_meta_strategies")
      .select("id, task_class, strategy, capabilities, evidence_count, success_count, failure_count, confidence, status")
      .eq("task_class", taskClass)
      .eq("status", "candidate")
      .limit(12);

    const similar = (data || []).find((item) => overlap(strategy, String(item.strategy || "")) >= 0.45);

    if (similar?.id) {
      const evidence = Number(similar.evidence_count || 0) + 1;
      const success = Number(similar.success_count || 0) + 1;
      const empirical = success / Math.max(1, evidence + Number(similar.failure_count || 0));
      const nextConfidence = Math.min(0.99, Number(similar.confidence || 0.5) * 0.4 + Math.max(empirical, confidence) * 0.6);
      const status = evidence >= 3 && nextConfidence >= 0.78 ? "active" : "candidate";

      const { data: updated } = await supabase
        .from("james_meta_strategies")
        .update({
          evidence_count: evidence,
          success_count: success,
          confidence: nextConfidence,
          status,
          capabilities,
          updated_at: new Date().toISOString(),
        })
        .eq("id", similar.id)
        .select("id, task_class, strategy, capabilities, evidence_count, success_count, failure_count, confidence, status")
        .maybeSingle();

      return updated || null;
    }

    const { data: inserted } = await supabase
      .from("james_meta_strategies")
      .insert({
        task_class: taskClass,
        strategy,
        capabilities,
        evidence_count: 1,
        success_count: 1,
        confidence,
        status: "candidate",
      })
      .select("id, task_class, strategy, capabilities, evidence_count, success_count, failure_count, confidence, status")
      .maybeSingle();

    return inserted || null;
  } catch (error) {
    console.warn("James meta-learning unavailable:", error);
    return null;
  }
}

export async function retrieveJamesMetaStrategies(taskClass: string, limit = 4) {
  const supabase = db();
  if (!supabase || !taskClass) return [];

  const { data, error } = await supabase
    .from("james_meta_strategies")
    .select("id, task_class, strategy, capabilities, evidence_count, success_count, failure_count, confidence, status")
    .eq("task_class", normalize(taskClass))
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 8));

  if (error) return [];
  return data || [];
}

export async function retrieveJamesMetaStrategiesByCapabilities(capabilities: string[], limit = 4) {
  const supabase = db();
  if (!supabase || !capabilities.length) return [];

  const { data, error } = await supabase
    .from("james_meta_strategies")
    .select("id, task_class, strategy, capabilities, evidence_count, success_count, failure_count, confidence, status")
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(20);

  if (error || !data?.length) return [];

  const requested = new Set(capabilities);
  return data
    .map((item) => {
      const itemCapabilities = Array.isArray(item.capabilities) ? item.capabilities : [];
      const matches = itemCapabilities.filter((capability) => requested.has(capability)).length;
      const capabilityScore = matches / Math.max(1, Math.min(requested.size, itemCapabilities.length || 1));
      return { ...item, relevance: capabilityScore * 0.7 + Number(item.confidence || 0) * 0.3 };
    })
    .filter((item) => item.relevance >= 0.35)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, Math.min(Math.max(limit, 1), 8));
}
