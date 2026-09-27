import { createClient } from "@supabase/supabase-js";
import { generateWithAllAIProviders, generateWithAIRouter } from "../../fun-zone/aiRouter";

type EvolutionFile = {
  path: string;
  content: string;
  reason: string;
};

type EvolutionProposal = {
  goal: string;
  rationale: string;
  riskLevel: "low" | "medium" | "high";
  files: EvolutionFile[];
  tests: string[];
};

const ALLOWED_PREFIXES = [
  "app/api/tools/",
  "app/api/ai/",
  "app/ai/",
  "app/fun-zone/",
  "tests/",
  "scripts/",
];

const BLOCKED_PATHS = [
  ".env",
  ".env.local",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "next.config",
];

const MAX_FILES = 5;
const MAX_FILE_SIZE = 120_000;

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function safePath(path: string) {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return (
    normalized.length > 0 &&
    normalized.length < 180 &&
    !normalized.includes("..") &&
    !BLOCKED_PATHS.some((item) => normalized === item || normalized.startsWith(item)) &&
    ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  const source = fenced?.[1] || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(source.slice(start, end + 1)); } catch { return null; }
}

function parseProposal(text: string): EvolutionProposal | null {
  const data = parseJson(text);
  if (!data) return null;

  const rawFiles = Array.isArray(data.files) ? data.files : [];
  const files = rawFiles
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      path: clean(item.path, 180),
      content: typeof item.content === "string" ? item.content : "",
      reason: clean(item.reason, 500),
    }))
    .filter((item) => safePath(item.path) && item.content.length > 0 && item.content.length <= MAX_FILE_SIZE)
    .slice(0, MAX_FILES);

  const tests = Array.isArray(data.tests)
    ? data.tests.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 12)
    : [];

  const riskLevel = data.riskLevel === "high" ? "high" : data.riskLevel === "medium" ? "medium" : "low";
  const goal = clean(data.goal, 500);
  const rationale = clean(data.rationale, 1500);

  if (!goal || !rationale || !files.length) return null;

  return { goal, rationale, riskLevel, files, tests };
}

function proposalPrompt(request: string, currentFiles: Array<{ path: string; content: string }>) {
  return [
    "Kamu adalah James Code Evolution Engineer.",
    "Tugasmu adalah merancang perubahan kode yang meningkatkan kemampuan James.",
    "Jangan mengubah core identity James, credential, secret, auth policy, database security policy, atau deployment configuration.",
    "Hanya usulkan file di allowlist: app/api/tools/, app/api/ai/, app/ai/, app/fun-zone/, tests/, scripts/.",
    "Berikan FILE CONTENT LENGKAP untuk setiap file yang diubah, bukan diff.",
    "Perubahan harus kecil, terisolasi, dapat direview, dan memiliki test yang dapat dijalankan.",
    "",
    "PERMINTAAN EVOLUSI:",
    request,
    "",
    "FILE YANG TERSEDIA:",
    ...currentFiles.map((file) => ["PATH: " + file.path, "CONTENT:", file.content].join("\n")).join("\n\n---\n\n"),
    "",
    "Output JSON saja:",
    JSON.stringify({
      goal: "tujuan",
      rationale: "alasan teknis",
      riskLevel: "low",
      files: [{ path: "app/api/tools/example.ts", content: "FULL FILE CONTENT", reason: "alasan" }],
      tests: ["npm run build"]
    })
  ].join("\n");
}

async function reviewProposal(request: string, proposal: EvolutionProposal) {
  const reviews = await generateWithAllAIProviders({
    prompt: [
      "Review proposal code evolution James berikut.",
      "Nilai correctness, security, regression risk, scope, dan testability.",
      "Jangan menulis ulang kode. Berikan JSON.",
      "REQUEST:", request,
      "PROPOSAL:", JSON.stringify(proposal),
      "Output:",
      '{"approved":true,"riskLevel":"low","score":0.0,"findings":["..."],"requiredTests":["..."]}'
    ].join("\n"),
    systemInstruction: "Kamu adalah reviewer independen untuk perubahan kode AI. Cari regresi dan perubahan berbahaya.",
    temperature: 0.1,
    maxOutputTokens: 1800,
  });

  return reviews.map((item) => {
    const parsed = parseJson(item.text) || {};
    return {
      provider: item.provider,
      model: item.model,
      approved: parsed.approved === true,
      riskLevel: parsed.riskLevel === "high" ? "high" : parsed.riskLevel === "medium" ? "medium" : "low",
      score: Number.isFinite(Number(parsed.score)) ? Math.max(0, Math.min(1, Number(parsed.score))) : 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings.filter((x): x is string => typeof x === "string").slice(0, 8) : [],
      requiredTests: Array.isArray(parsed.requiredTests) ? parsed.requiredTests.filter((x): x is string => typeof x === "string").slice(0, 8) : [],
    };
  });
}

export async function proposeJamesCodeEvolution(input: {
  userId: string;
  conversationId: string;
  request: string;
  currentFiles: Array<{ path: string; content: string }>;
}) {
  const allowedContext = input.currentFiles
    .filter((file) => safePath(file.path))
    .slice(0, MAX_FILES)
    .map((file) => ({ path: file.path, content: file.content.slice(0, MAX_FILE_SIZE) }));

  const generated = await generateWithAIRouter({
    prompt: proposalPrompt(input.request, allowedContext),
    systemInstruction: "Kamu adalah James yang membuat perubahan kode secara konservatif. Jangan mengarang file yang tidak diberikan.",
    temperature: 0.15,
    maxOutputTokens: 9000,
  });

  const proposal = parseProposal(generated.text);
  if (!proposal) throw new Error("James gagal menghasilkan proposal kode yang valid.");

  const reviews = await reviewProposal(input.request, proposal);
  const approvals = reviews.filter((review) => review.approved && review.score >= 0.70).length;
  const highRisk = proposal.riskLevel === "high" || reviews.some((review) => review.riskLevel === "high");
  const status = approvals >= Math.max(1, Math.ceil(reviews.length / 2)) && !highRisk ? "approved" : "proposed";

  const supabase = db();
  let proposalId: string | null = null;

  if (supabase) {
    const { data, error } = await supabase
      .from("james_code_evolution_proposals")
      .insert({
        user_id: input.userId,
        conversation_id: input.conversationId,
        request: input.request,
        goal: proposal.goal,
        rationale: proposal.rationale,
        status,
        risk_level: highRisk ? "high" : proposal.riskLevel,
        files: proposal.files,
        tests: [...new Set([...proposal.tests, ...reviews.flatMap((review) => review.requiredTests)])].slice(0, 16),
        provider_reviews: reviews,
      })
      .select("id, status, goal, rationale, risk_level, files, tests, provider_reviews")
      .maybeSingle();

    if (error) throw new Error("Proposal code evolution gagal disimpan: " + error.message);
    proposalId = data?.id || null;
  }

  return {
    proposalId,
    generatedBy: generated.provider,
    model: generated.model,
    proposal,
    reviews,
    status,
  };
}

export function validateEvolutionFile(path: string, content: string) {
  return safePath(path) && content.length > 0 && content.length <= MAX_FILE_SIZE;
}
