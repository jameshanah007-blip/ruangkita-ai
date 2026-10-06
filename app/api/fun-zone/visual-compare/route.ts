import { NextResponse } from "next/server";

type Comparison = {
  version: 1;
  analyzed: boolean;
  provider: "openai-vision" | "native-metrics";
  score: number;
  passed: boolean;
  summary: string;
  mismatches: string[];
  repairs: string[];
};

function fallback(): Comparison {
  return {
    version: 1,
    analyzed: false,
    provider: "native-metrics",
    score: 0,
    passed: false,
    summary: "Reference visual comparison belum dievaluasi karena Vision provider tidak tersedia. Gameplay QA tetap menjadi sumber keputusan.",
    mismatches: [],
    repairs: [],
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]);
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reference = body?.referenceImage?.dataUrl;
    const screenshot = body?.screenshot?.dataUrl;
    if (
      typeof reference !== "string" ||
      typeof screenshot !== "string" ||
      !/^data:image\/(png|jpeg|webp);base64,/i.test(reference) ||
      !/^data:image\/(png|jpeg|webp);base64,/i.test(screenshot)
    ) {
      return NextResponse.json({ success: true, comparison: fallback() });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ success: true, comparison: fallback() });

    const model = process.env.JAMES_REFERENCE_VISION_MODEL || "gpt-4.1-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "You are James Visual QA for a game-building laboratory.",
                "Compare IMAGE A (user reference) with IMAGE B (actual generated game screenshot).",
                "Judge visual similarity as a game reference, not pixel-perfect identity.",
                "Return ONLY JSON: {score:0-100,passed:boolean,summary:string,mismatches:string[],repairs:string[]}.",
                "Check camera/composition, art style, protagonist appearance/scale, world density, color/lighting, and visible animation/readability.",
                "Only mark passed when the generated game reasonably follows the reference. Be concrete and actionable.",
                `Game blueprint: ${JSON.stringify(body?.blueprint || {}).slice(0, 6000)}`,
              ].join("\n"),
            },
            { type: "input_image", image_url: reference },
            { type: "input_image", image_url: screenshot },
          ],
        }],
      }),
      cache: "no-store",
    });

    if (!response.ok) return NextResponse.json({ success: true, comparison: fallback() });

    const data = await response.json() as { output_text?: string };
    const parsed = extractJson(data.output_text || "");
    if (!parsed) return NextResponse.json({ success: true, comparison: fallback() });

    const score = Math.max(0, Math.min(100, typeof parsed.score === "number" ? Math.round(parsed.score) : 0));
    const mismatches = strings(parsed.mismatches);
    const repairs = strings(parsed.repairs);

    const comparison: Comparison = {
      version: 1,
      analyzed: true,
      provider: "openai-vision",
      score,
      passed: parsed.passed === true && score >= 70 && mismatches.length === 0,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 1200) : "Visual comparison selesai.",
      mismatches,
      repairs,
    };

    return NextResponse.json({ success: true, comparison });
  } catch (error) {
    console.warn("Reference visual comparison unavailable:", error);
    return NextResponse.json({ success: true, comparison: fallback() });
  }
}
