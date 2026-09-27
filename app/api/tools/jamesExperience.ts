import { createClient } from "@supabase/supabase-js";
import { generateWithJamesResourceManager } from "./jamesResourceManager";
import type { JamesTaskAction } from "./jamesTaskPlanner";

export type JamesExperience = {
  id?: string;
  userId?: string | null;
  pattern: string;
  strategy: string;
  capabilities: string[];
  successCount: number;
  failureCount: number;
  confidence: number;
  status: "active" | "candidate" | "retired";
  relevance?: number;
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function clean(value: unknown, max = 600) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeId(value: unknown) {
  return typeof value === "string" && /^[0-9a-fA-F-]{20,100}$/.test(value);
}

function clamp(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúàèìòùâêîôûäëïöüñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lexicalRelevance(request: string, experience: JamesExperience) {
  const requestTerms = new Set(normalize(request).split(" ").filter((term) => term.length > 2));
  const experienceTerms = new Set(
    normalize(experience.pattern + " " + experience.strategy).split(" ").filter((term) => term.length > 2)
  );
  if (!requestTerms.size || !experienceTerms.size) return 0;

  let overlap = 0;
  for (const term of requestTerms) {
    if (experienceTerms.has(term)) overlap += 1;
  }

  return Math.min(1, overlap / Math.max(3, Math.min(requestTerms.size, 12)));
}

function redact(value: string) {
  return value
    .replace(/(?:api[_ -]?key|token|password|secret|verification[_ -]?code)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[PHONE]");
}

export async function retrieveJamesConsolidations(userId: string, request: string, limit = 3) {
  const supabase = db();
  if (!supabase || !safeId(userId)) return [];

  const { data, error } = await supabase
    .from("james_experience_consolidations")
    .select("id, merged_pattern, merged_strategy, capabilities, confidence, evidence_count, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(12);

  if (error || !data?.length) return [];

  return data
    .map((item) => ({
      ...item,
      relevance: lexicalRelevance(request, {
        pattern: item.merged_pattern,
        strategy: item.merged_strategy,
        capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
        successCount: Number(item.evidence_count || 0),
        failureCount: 0,
        confidence: clamp(item.confidence),
        status: "active" as const,
      }),
    }))
    .filter((item) => item.relevance >= 0.20)
    .sort((a, b) => (b.relevance + Number(b.confidence)) - (a.relevance + Number(a.confidence)))
    .slice(0, Math.min(Math.max(limit, 1), 5));
}

export function formatJamesConsolidationContext(items: Array<{
  merged_pattern: string;
  merged_strategy: string;
  capabilities: string[];
  confidence: number;
  evidence_count: number;
  relevance: number;
}>) {
  if (!items.length) return "CONSOLIDATED JAMES EXPERIENCES: none.";

  return [
    "CONSOLIDATED JAMES EXPERIENCES:",
    ...items.map((item, index) => [
      "CONSOLIDATED EXPERIENCE " + (index + 1),
      "Pattern: " + item.merged_pattern,
      "Strategy: " + item.merged_strategy,
      "Capabilities: " + item.capabilities.join(", "),
      "Evidence count: " + item.evidence_count,
      "Confidence: " + Number(item.confidence).toFixed(2),
      "Relevance: " + item.relevance.toFixed(2),
    ].join("\n")),
    "",
    "Ini adalah strategi gabungan dari beberapa pengalaman. Gunakan sebagai pola kerja, bukan fakta eksternal.",
  ].join("\n");
}

export async function retrieveJamesExperiences(input: {
  userId: string;
  request: string;
  capabilities?: string[];
  limit?: number;
}) {
  const supabase = db();
  if (!supabase || !safeId(input.userId)) return [];

  const { data, error } = await supabase
    .from("james_experiences")
    .select("id, pattern, strategy, capabilities, success_count, failure_count, confidence, status")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error || !data?.length) return [];

  const requestedCapabilities = new Set(input.capabilities || []);

  return data
    .map((item) => {
      const experience: JamesExperience = {
        id: item.id,
        pattern: item.pattern,
        strategy: item.strategy,
        capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
        successCount: Number(item.success_count || 0),
        failureCount: Number(item.failure_count || 0),
        confidence: clamp(item.confidence),
        status: item.status,
      };

      const lexical = lexicalRelevance(input.request, experience);
      const capabilityMatch = requestedCapabilities.size
        ? experience.capabilities.some((capability) => requestedCapabilities.has(capability)) ? 1 : 0
        : 0;
      const successScore = Math.min(1, Math.log10(experience.successCount + 1) / 3);
      const failurePenalty = Math.min(
        0.35,
        experience.failureCount / Math.max(6, experience.successCount + experience.failureCount) * 0.5
      );
      const score = Math.max(
        0,
        lexical * 0.55 +
        capabilityMatch * 0.20 +
        experience.confidence * 0.15 +
        successScore * 0.10 -
        failurePenalty
      );

      return { ...experience, relevance: score };
    })
    .filter((item) => (item.relevance || 0) >= 0.18)
    .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
    .slice(0, Math.min(Math.max(input.limit || 4, 1), 6));
}

export function formatJamesExperienceContext(experiences: JamesExperience[]) {
  if (!experiences.length) return "RELEVANT JAMES EXPERIENCES: none.";

  return [
    "RELEVANT JAMES EXPERIENCES:",
    ...experiences.map((item, index) => [
      "EXPERIENCE " + (index + 1),
      "Pattern: " + item.pattern,
      "Strategy: " + item.strategy,
      "Capabilities: " + item.capabilities.join(", "),
      "Success count: " + item.successCount,
      "Failure count: " + item.failureCount,
      "Confidence: " + item.confidence.toFixed(2),
      "Relevance: " + (item.relevance || 0).toFixed(2),
    ].join("\n")),
    "",
    "Gunakan pengalaman sebagai pola kerja, bukan sebagai fakta eksternal atau aturan mutlak.",
  ].join("\n");
}

export async function recordJamesExperienceOutcome(input: {
  experienceIds: string[];
  verified: boolean;
}) {
  const supabase = db();
  const ids = input.experienceIds.filter(safeId).slice(0, 10);
  if (!supabase || !ids.length) return 0;

  const { data, error } = await supabase
    .from("james_experiences")
    .select("id, success_count, failure_count, confidence, status")
    .in("id", ids)
    .eq("status", "active");

  if (error || !data?.length) return 0;

  let updated = 0;

  for (const item of data) {
    const successCount = Number(item.success_count || 0);
    const failureCount = Number(item.failure_count || 0);
    const previousConfidence = clamp(item.confidence);

    const nextSuccess = input.verified ? successCount + 1 : successCount;
    const nextFailure = input.verified ? failureCount : failureCount + 1;
    const total = nextSuccess + nextFailure;

    // Confidence follows observed outcomes instead of accumulating blindly.
    const empirical = total > 0 ? nextSuccess / total : previousConfidence;
    const nextConfidence = Math.max(
      0.05,
      Math.min(0.99, previousConfidence * 0.35 + empirical * 0.65)
    );

    const shouldRetire = nextFailure >= 4 && empirical < 0.35;

    const { error: updateError } = await supabase
      .from("james_experiences")
      .update({
        success_count: nextSuccess,
        failure_count: nextFailure,
        confidence: nextConfidence,
        status: shouldRetire ? "retired" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (!updateError) updated += 1;
  }

  return updated;
}

export async function learnJamesExperience(input: {
  userId: string;
  conversationId: string;
  taskId?: string | null;
  request: string;
  actions: JamesTaskAction[];
  verified: boolean;
}) {
  if (!input.verified || !safeId(input.userId) || !safeId(input.conversationId)) return null;

  const completed = input.actions.filter((action) => action.status === "completed");
  if (!completed.length) return null;

  try {
    const result = await generateWithJamesResourceManager("learning", {
      prompt: [
        "Ekstrak SATU pengalaman reusable dari task James yang baru berhasil diverifikasi.",
        "Pengalaman harus berupa pola penyelesaian tugas, bukan fakta pribadi pengguna.",
        "",
        "REQUEST:",
        redact(clean(input.request, 1200)),
        "",
        "COMPLETED ACTIONS:",
        JSON.stringify(completed.map((action) => ({
          goal: action.goal,
          capability: action.capability,
        }))),
        "",
        "Output JSON saja:",
        '{"pattern":"jenis tugas umum","strategy":"strategi reusable","confidence":0.8}',
        "",
        "Jangan menyimpan nama orang, email, nomor telepon, credential, API key, token, password, kode verifikasi, atau data rahasia.",
        "Jangan menyimpan isi jawaban pengguna. Simpan hanya pola dan strategi."
      ].join("\n"),
      systemInstruction:
        "Kamu adalah James Experience Extractor. Belajar hanya dari task yang sudah verified. Hasil harus generik dan dapat digunakan kembali.",
      temperature: 0.1,
      maxOutputTokens: 700,
    });

    const text = result.text;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const pattern = redact(clean(parsed.pattern, 240));
    const strategy = redact(clean(parsed.strategy, 700));
    const confidence = clamp(parsed.confidence);

    if (!pattern || !strategy || confidence < 0.75) return null;

    const capabilities = [...new Set(
      completed.map((action) => action.capability)
    )].slice(0, 8);

    const supabase = db();
    if (!supabase) return null;

    const existing = await supabase
      .from("james_experiences")
      .select("id, success_count, confidence")
      .eq("user_id", input.userId)
      .eq("pattern", pattern)
      .eq("status", "active")
      .maybeSingle();

    if (existing.data?.id) {
      const { data } = await supabase
        .from("james_experiences")
        .update({
          strategy,
          capabilities,
          success_count: Math.min((existing.data.success_count || 0) + 1, 1000000),
          confidence: Math.max(Number(existing.data.confidence || 0), confidence),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id)
        .select("id, pattern, strategy, capabilities, success_count, confidence, status")
        .maybeSingle();

      return data || null;
    }

    const { data, error } = await supabase
      .from("james_experiences")
      .insert({
        user_id: input.userId,
        conversation_id: input.conversationId,
        task_id: safeId(input.taskId) ? input.taskId : null,
        pattern,
        strategy,
        capabilities,
        success_count: 1,
        confidence,
        status: "active",
      })
      .select("id, pattern, strategy, capabilities, success_count, confidence, status")
      .maybeSingle();

    if (error) {
      console.warn("James experience save unavailable:", error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn("James experience learning unavailable:", error);
    return null;
  }
}

export async function consolidateJamesExperiences(userId: string, limit = 5) {
  const supabase = db();
  if (!supabase || !safeId(userId)) return [];

  const { data, error } = await supabase
    .from("james_experiences")
    .select("id, pattern, strategy, capabilities, success_count, failure_count, confidence, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error || !data?.length) return [];

  const experiences = data.map((item) => ({
    id: item.id,
    pattern: clean(item.pattern, 240),
    strategy: clean(item.strategy, 700),
    capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
    successCount: Number(item.success_count || 0),
    failureCount: Number(item.failure_count || 0),
    confidence: clamp(item.confidence),
  }));

  const candidates = experiences.filter((item) => item.confidence >= 0.70 && item.successCount >= 2);
  if (candidates.length < 2) return [];

  const groups: typeof experiences[] = [];
  for (const experience of candidates) {
    const similar = groups.find((group) =>
      lexicalRelevance(experience.pattern, {
        pattern: group[0].pattern,
        strategy: group[0].strategy,
        capabilities: group[0].capabilities,
        successCount: group[0].successCount,
        failureCount: group[0].failureCount,
        confidence: group[0].confidence,
        status: "active",
      }) >= 0.45
    );

    if (similar) similar.push(experience);
    else groups.push([experience]);
  }

  const consolidated = [];

  for (const group of groups.filter((items) => items.length >= 2).slice(0, limit)) {
    const result = await generateWithJamesResourceManager("learning", {
      prompt: [
        "Konsolidasikan pengalaman James yang sangat mirip menjadi SATU strategi reusable.",
        "Jangan menggabungkan pengalaman yang bertentangan.",
        "Pertahankan hanya pola kerja yang didukung oleh beberapa pengalaman.",
        "",
        JSON.stringify(group.map((item) => ({
          id: item.id,
          pattern: item.pattern,
          strategy: item.strategy,
          capabilities: item.capabilities,
          successCount: item.successCount,
          failureCount: item.failureCount,
          confidence: item.confidence,
        }))),
        "",
        "Output JSON saja:",
        '{"pattern":"pola umum","strategy":"strategi matang","confidence":0.0}',
        "confidence harus mencerminkan bukti gabungan, bukan optimisme.",
      ].join("\n"),
      systemInstruction:
        "Kamu adalah James Experience Consolidator. Gabungkan hanya pengalaman yang kompatibel dan didukung bukti.",
      temperature: 0.1,
      maxOutputTokens: 900,
    });

    try {
      const start = result.text.indexOf("{");
      const end = result.text.lastIndexOf("}");
      if (start < 0 || end <= start) continue;
      const parsed = JSON.parse(result.text.slice(start, end + 1)) as Record<string, unknown>;
      const pattern = redact(clean(parsed.pattern, 240));
      const strategy = redact(clean(parsed.strategy, 700));
      const confidence = clamp(parsed.confidence);
      if (!pattern || !strategy || confidence < 0.75) continue;

      const capabilities = [...new Set(group.flatMap((item) => item.capabilities))].slice(0, 8);
      const sourceIds = group.map((item) => item.id).filter((id): id is string => Boolean(id));

      const { data: saved } = await supabase
        .from("james_experience_consolidations")
        .insert({
          user_id: userId,
          source_experience_ids: sourceIds,
          merged_pattern: pattern,
          merged_strategy: strategy,
          capabilities,
          confidence,
          evidence_count: group.length,
          status: "active",
        })
        .select("id, merged_pattern, merged_strategy, capabilities, confidence, evidence_count, status")
        .maybeSingle();

      if (saved) consolidated.push(saved);
    } catch {
      // A failed consolidation must never delete or mutate source experiences.
    }
  }

  return consolidated;
}

export async function getJamesExperiences(userId: string, limit = 6) {
  const supabase = db();
  if (!supabase || !safeId(userId)) return [];

  const { data, error } = await supabase
    .from("james_experiences")
    .select("id, pattern, strategy, capabilities, success_count, confidence, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .order("success_count", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 10));

  if (error) return [];
  return data || [];
}
