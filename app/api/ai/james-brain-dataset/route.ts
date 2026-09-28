import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getJamesCapabilities } from "../../tools/jamesAutonomousBrain";
import { generateWithAllAIProviders } from "../../../fun-zone/aiRouter";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request) {
  const provided = request.headers.get("authorization");
  const secrets = [process.env.JAMES_LEARNING_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .map(value => `Bearer ${value}`);
  return Boolean(provided && secrets.includes(provided));
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  }) : null;
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const capabilities = (await getJamesCapabilities(20))
    .filter((item: any) => item.status === "validated" && Number(item.success_rate || 0) >= 0.8)
    .slice(0, 5);

  if (!capabilities.length) {
    return NextResponse.json({ ok: true, created: 0, reason: "no_validated_capabilities" });
  }

  let created = 0;

  for (const capability of capabilities) {
    const prompt = `Create 3 independent synthetic training/evaluation examples for this validated James capability.

CAPABILITY:
${JSON.stringify({
  name: capability.name,
  description: capability.description,
  skills: capability.skills,
  strategy: capability.strategy,
  limitations: capability.limitations,
})}

Rules:
- Do not copy provider wording.
- Do not include personal or sensitive data.
- Examples must test transfer/generalization, not memorization.
- Expected behavior must be observable and testable.

Return JSON only:
{"examples":[
 {"task":"...","expected_behavior":"...","test_case":"...","quality_score":0.0}
]}`;

    const results = await generateWithAllAIProviders({
      prompt,
      systemInstruction: "You create conservative synthetic evaluation data for James. JSON only.",
      temperature: 0.2,
      maxOutputTokens: 1800,
    });

    const seen = new Set<string>();

    for (const result of results) {
      const parsed = extractJson(result.text);
      const examples = Array.isArray(parsed?.examples) ? parsed.examples : [];

      for (const raw of examples) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        const task = typeof item.task === "string" ? item.task.trim().slice(0, 1000) : "";
        const expected = typeof item.expected_behavior === "string" ? item.expected_behavior.trim().slice(0, 1200) : "";
        const testCase = typeof item.test_case === "string" ? item.test_case.trim().slice(0, 1200) : "";
        const quality = typeof item.quality_score === "number" ? Math.max(0, Math.min(1, item.quality_score)) : 0;

        if (!task || !expected || !testCase || quality < 0.8) continue;

        const key = (task + "|" + testCase).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const { error } = await supabase.from("james_brain_training_examples").insert({
          capability_id: capability.id,
          task,
          expected_behavior: expected,
          test_case: testCase,
          source_type: "synthetic",
          quality_score: quality,
          approved: false,
        });

        if (!error) created += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    capabilitiesProcessed: capabilities.length,
    created,
    message: "Dataset examples created as unapproved candidates. They must be evaluated before training.",
  });
}

export async function GET(request: Request) {
  return POST(request);
}
