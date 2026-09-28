import { generateWithAllAIProviders } from "../fun-zone/aiRouter";
import { createClient } from "@supabase/supabase-js";

type CapabilityStatus = "candidate" | "validated" | "deprecated";

export interface JamesCapability {
  name: string;
  description: string;
  domain: string;
  skills: string[];
  strategy: string;
  limitations: string[];
  evidence: string[];
  testCases: string[];
  successRate: number;
  confidence: number;
  version: number;
  status: CapabilityStatus;
  sourceType: "experience" | "provider_comparison" | "public_knowledge";
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      })
    : null;
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Autonomous Brain:
 * learns transferable strategies from legitimate provider outputs and James'
 * own verified experiences. It never attempts to copy weights, hidden prompts,
 * private data, or proprietary internals.
 */
export async function runJamesAutonomousBrainCycle(options?: {
  maxCapabilities?: number;
  maxTestsPerCapability?: number;
}) {
  const supabase = db();
  if (!supabase) return { ran: false, reason: "database_unavailable" };

  const maxCapabilities = Math.max(1, Math.min(options?.maxCapabilities ?? 3, 5));
  const maxTests = Math.max(2, Math.min(options?.maxTestsPerCapability ?? 3, 5));

  const [{ data: experiences }, { data: existing }] = await Promise.all([
    supabase
      .from("james_experiences")
      .select("pattern, strategy, capabilities, success_count, failure_count, confidence, status")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("james_capabilities")
      .select("*")
      .neq("status", "deprecated")
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const prompt = `You are the capability acquisition engine for James Autonomous Brain.

Your job is NOT to clone a provider, its weights, hidden prompts, private data, or proprietary implementation.
Instead, identify transferable, general-purpose capabilities demonstrated by the evidence.

EXPERIENCES:
${JSON.stringify(experiences || [])}

EXISTING CAPABILITIES:
${JSON.stringify(existing || [])}

Find up to ${maxCapabilities} capability improvements.

For each candidate:
- decompose the skill into generalizable abilities;
- describe a reusable strategy;
- state limitations;
- create at least ${maxTests} independent test cases;
- estimate confidence conservatively;
- do not claim learning from a single example;
- prefer capabilities that reduce unnecessary cloud-provider dependency.

Return JSON only:
{
  "capabilities": [
    {
      "name": "short capability name",
      "description": "what James can learn",
      "domain": "domain",
      "skills": ["skill"],
      "strategy": "general strategy",
      "limitations": ["limitation"],
      "evidence": ["evidence reference"],
      "testCases": ["independent test"],
      "confidence": 0.0,
      "sourceType": "experience"
    }
  ]
}

Do not include user identity, sensitive user information, credentials, secrets, or provider proprietary information.`;

  const results = await generateWithAllAIProviders({
    prompt,
    systemInstruction:
      "You are a conservative capability-learning researcher. Extract general skills, not proprietary internals. Return valid JSON only.",
    temperature: 0.15,
    maxOutputTokens: 3000,
  });

  const candidates = new Map<string, JamesCapability>();

  for (const result of results) {
    const parsed = extractJson(result.text);
    const items = Array.isArray(parsed?.capabilities) ? parsed.capabilities : [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const name = typeof item.name === "string" ? item.name.trim().slice(0, 120) : "";
      const description = typeof item.description === "string" ? item.description.trim().slice(0, 500) : "";
      if (!name || !description) continue;

      const key = name.toLowerCase();
      const previous = candidates.get(key);
      const skills = Array.isArray(item.skills)
        ? item.skills.filter((v): v is string => typeof v === "string").map(v => v.trim().slice(0, 120)).filter(Boolean).slice(0, 10)
        : [];
      const limitations = Array.isArray(item.limitations)
        ? item.limitations.filter((v): v is string => typeof v === "string").map(v => v.trim().slice(0, 200)).filter(Boolean).slice(0, 10)
        : [];
      const evidence = Array.isArray(item.evidence)
        ? item.evidence.filter((v): v is string => typeof v === "string").map(v => v.trim().slice(0, 300)).filter(Boolean).slice(0, 10)
        : [];
      const testCases = Array.isArray(item.testCases)
        ? item.testCases.filter((v): v is string => typeof v === "string").map(v => v.trim().slice(0, 300)).filter(Boolean).slice(0, maxTests)
        : [];
      const confidence = typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0;

      if (!previous) {
        candidates.set(key, {
          name,
          description,
          domain: typeof item.domain === "string" ? item.domain.trim().slice(0, 80) : "general",
          skills,
          strategy: typeof item.strategy === "string" ? item.strategy.trim().slice(0, 1000) : "",
          limitations,
          evidence,
          testCases,
          successRate: 0,
          confidence,
          version: 1,
          status: "candidate",
          sourceType: item.sourceType === "provider_comparison" || item.sourceType === "public_knowledge"
            ? item.sourceType
            : "experience",
        });
      } else {
        previous.skills = [...new Set([...previous.skills, ...skills])].slice(0, 10);
        previous.evidence = [...new Set([...previous.evidence, ...evidence])].slice(0, 10);
        previous.testCases = [...new Set([...previous.testCases, ...testCases])].slice(0, maxTests);
        previous.confidence = Math.min(1, Math.max(previous.confidence, confidence) + 0.05);
      }
    }
  }

  const saved: JamesCapability[] = [];

  for (const candidate of [...candidates.values()].slice(0, maxCapabilities)) {
    const old = (existing || []).find(
      (row: any) => typeof row.name === "string" && row.name.toLowerCase() === candidate.name.toLowerCase()
    );

    if (old) {
      const { data } = await supabase
        .from("james_capabilities")
        .update({
          description: candidate.description,
          skills: candidate.skills,
          strategy: candidate.strategy,
          limitations: candidate.limitations,
          evidence: candidate.evidence,
          test_cases: candidate.testCases,
          confidence: Math.max(Number(old.confidence || 0), candidate.confidence),
          version: Number(old.version || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", old.id)
        .select("*")
        .single();
      if (data) saved.push(data as JamesCapability);
      continue;
    }

    const { data } = await supabase
      .from("james_capabilities")
      .insert({
        name: candidate.name,
        description: candidate.description,
        domain: candidate.domain,
        skills: candidate.skills,
        strategy: candidate.strategy,
        limitations: candidate.limitations,
        evidence: candidate.evidence,
        test_cases: candidate.testCases,
        success_rate: 0,
        confidence: candidate.confidence,
        version: 1,
        status: "candidate",
        source_type: candidate.sourceType,
      })
      .select("*")
      .single();

    if (data) saved.push(data as JamesCapability);
  }

  return {
    ran: true,
    providersConsulted: [...new Set(results.map(result => result.provider))],
    candidatesCreatedOrUpdated: saved.length,
    capabilities: saved,
  };
}

/**
 * Promote a capability only after repeated independent evidence.
 * The engine never promotes from confidence alone.
 */
export async function validateJamesCapability(capabilityId: string, passed: number, total: number) {
  const supabase = db();
  if (!supabase || total <= 0) return null;

  const successRate = Math.max(0, Math.min(1, passed / total));
  const status: CapabilityStatus = total >= 3 && successRate >= 0.8 ? "validated" : "candidate";

  const { data } = await supabase
    .from("james_capabilities")
    .update({
      success_rate: successRate,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", capabilityId)
    .select("*")
    .single();

  return data;
}

export async function getJamesCapabilities(limit = 30) {
  const supabase = db();
  if (!supabase) return [];

  const { data } = await supabase
    .from("james_capabilities")
    .select("*")
    .neq("status", "deprecated")
    .order("confidence", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  return data || [];
}
