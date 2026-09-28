import { NextResponse } from "next/server";
import { runJamesLocalFirst } from "../../tools/jamesLocalBrain";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const provided = request.headers.get("authorization");
  const secrets = [process.env.JAMES_LEARNING_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .map(value => `Bearer ${value}`);
  return Boolean(provided && secrets.includes(provided));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const systemInstruction =
      typeof body.systemInstruction === "string"
        ? body.systemInstruction.trim()
        : undefined;

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required." }, { status: 400 });
    }

    const result = await runJamesLocalFirst(prompt, systemInstruction);

    return NextResponse.json({
      ok: result.available,
      provider: result.provider,
      model: result.model || null,
      result: result.text || null,
      error: result.error || null,
    }, { status: result.available ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Local brain failed.",
    }, { status: 500 });
  }
}
