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
  confidence: number;
  status: "active" | "candidate" | "retired";
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

function redact(value: string) {
  return value
    .replace(/(?:api[_ -]?key|token|password|secret|verification[_ -]?code)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[PHONE]");
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
