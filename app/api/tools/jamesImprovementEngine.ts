import { createClient } from "@supabase/supabase-js";
import { generateWithAIRouter } from "../../fun-zone/aiRouter";
import type { JamesAgentResult } from "./jamesAgentLoop";
import { evaluateJamesTask } from "./jamesSelfEvaluation";
import { proposeJamesCodeEvolution } from "./jamesCodeEvolution";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function clean(v: unknown, max = 1000) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function clamp(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

function parse(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>; } catch { return null; }
}

export async function detectJamesImprovementGoal(input: {
  userId: string;
  conversationId: string;
  request: string;
  result: JamesAgentResult;
  evaluationId?: string | null;
}) {
  const client = db();
  if (!client) return null;

  const evaluation = await evaluateJamesTask({
    userId: input.userId,
    conversationId: input.conversationId,
    taskId: input.result.taskId,
    request: input.request,
    result: input.result,
  });

  const prompt = [
    "Kamu adalah James Capability Gap Detector.",
    "Cari satu gap teknis atau kemampuan yang paling konkret dari evidence.",
    "Jangan membuat gap hanya karena ingin mengubah kode.",
    "Jika tidak ada gap yang cukup kuat, hasGap=false.",
    "Jangan menyentuh credentials, secrets, auth policy, database security policy, atau deployment config.",
    "",
    "REQUEST:",
    input.request.slice(0, 2500),
    "",
    "RESULT:",
    input.result.answer.slice(0, 4500),
    "",
    "EVALUATION:",
    JSON.stringify(evaluation || {}),
    "",
    "Output JSON saja:",
    '{"hasGap":false,"title":"","problem":"","targetCapability":"","priority":0,"confidence":0.0,"evidence":[]}',
  ].join("\n");

  const generated = await generateWithAIRouter({
    prompt,
    systemInstruction:
      "Kamu adalah capability-gap detector James. Hanya identifikasi gap yang didukung evidence. Satu gap paling penting.",
    temperature: 0.1,
    maxOutputTokens: 1200,
  });

  const parsed = parse(generated.text);
  if (!parsed || parsed.hasGap !== true) return null;

  const title = clean(parsed.title, 180);
  const problem = clean(parsed.problem, 1600);
  const targetCapability = clean(parsed.targetCapability, 180);
  if (!title || !problem || !targetCapability) return null;

  const { data, error } = await client
    .from("james_improvement_goals")
    .insert({
      user_id: input.userId,
      source_evaluation_id: evaluation?.id || input.evaluationId || null,
      title,
      problem,
      target_capability: targetCapability,
      evidence: {
        request: input.request.slice(0, 2500),
        result: input.result.answer.slice(0, 4500),
        evaluation,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 8) : [],
      },
      priority: Math.min(Math.max(Math.round(Number(parsed.priority) || 50), 0), 100),
      confidence: clamp(parsed.confidence),
      status: "proposed",
    })
    .select("id, title, problem, target_capability, priority, confidence, status, created_at")
    .maybeSingle();

  if (error) {
    console.warn("James improvement goal unavailable:", error.message);
    return null;
  }

  return data;
}


export async function queueJamesCapabilityGap(input: {
  userId: string;
  conversationId: string;
  capability?: string;
}) {
  const client = db();
  if (!client) return null;

  let query = client
    .from("james_self_model")
    .select("capability_name, competence, confidence, evidence_count, status, next_learning_action")
    .eq("user_id", input.userId)
    .in("status", ["unknown", "developing"])
    .order("competence", { ascending: true })
    .order("confidence", { ascending: true })
    .limit(1);

  if (input.capability?.trim()) {
    query = client
      .from("james_self_model")
      .select("capability_name, competence, confidence, evidence_count, status, next_learning_action")
      .eq("user_id", input.userId)
      .eq("capability_key", input.capability.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 120))
      .limit(1);
  }

  const { data: rows } = await query;
  const gap = rows?.[0];
  if (!gap) return null;

  const { data: existing } = await client
    .from("james_improvement_goals")
    .select("id, status, target_capability, priority, confidence")
    .eq("user_id", input.userId)
    .eq("target_capability", gap.capability_name)
    .in("status", ["proposed", "queued", "running"])
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const priority = Math.min(100, Math.max(40, Math.round(
    (1 - Number(gap.competence || 0.5)) * 70 + Number(gap.confidence || 0.2) * 30
  )));

  const { data, error } = await client
    .from("james_improvement_goals")
    .insert({
      user_id: input.userId,
      title: "Strengthen capability: " + gap.capability_name,
      problem: "Self-model menunjukkan capability ini masih " + gap.status +
        " dengan competence " + Number(gap.competence || 0).toFixed(2) +
        " berdasarkan " + Number(gap.evidence_count || 0) + " evidence.",
      target_capability: gap.capability_name,
      evidence: {
        source: "james_self_model",
        competence: Number(gap.competence || 0),
        confidence: Number(gap.confidence || 0),
        evidence_count: Number(gap.evidence_count || 0),
        next_learning_action: gap.next_learning_action || "distill-more-evidence",
      },
      priority,
      confidence: Number(gap.confidence || 0.2),
      status: "proposed",
    })
    .select("id, title, problem, target_capability, priority, confidence, status, created_at")
    .maybeSingle();

  if (error) {
    console.warn("James capability learning queue unavailable:", error.message);
    return null;
  }

  return data;
}

export async function evolveJamesImprovementGoal(input: {
  userId: string;
  conversationId: string;
  improvementGoalId: string;
}) {
  const client = db();
  if (!client) return null;

  const { data: goal, error } = await client
    .from("james_improvement_goals")
    .select("*")
    .eq("id", input.improvementGoalId)
    .maybeSingle();

  if (error || !goal) return null;

  if (goal.status !== "proposed" && goal.status !== "queued") return goal;

  const proposal = await proposeJamesCodeEvolution({
    userId: input.userId,
    conversationId: input.conversationId,
    request: [
      "JAMES IMPROVEMENT GOAL:",
      goal.title,
      "",
      "PROBLEM:",
      goal.problem,
      "",
      "TARGET CAPABILITY:",
      goal.target_capability,
      "",
      "EVIDENCE:",
      JSON.stringify(goal.evidence),
      "",
      "Buat perubahan kecil dan terukur. Jangan mengubah security boundary.",
    ].join("\n"),
    currentFiles: [],
  });

  await client
    .from("james_improvement_goals")
    .update({
      status: proposal.status === "approved" ? "queued" : "blocked",
      evolution_proposal_id: proposal.proposalId,
    })
    .eq("id", input.improvementGoalId);

  return {
    ...goal,
    status: proposal.status === "approved" ? "queued" : "blocked",
    evolution_proposal_id: proposal.proposalId,
  };
}
