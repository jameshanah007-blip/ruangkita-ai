import type { ReferenceImageEvidence } from "../laboratory/types";

export type ReferenceImageAnalysis = {
  version: 1;
  analyzed: boolean;
  provider: "openai-vision" | "native-metrics";
  model?: string;
  summary: string;
  style: string[];
  camera: string[];
  composition: string[];
  character: string[];
  world: string[];
  animation: string[];
  mobile: string[];
  image: {
    available: boolean;
    mimeType?: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
  };
};

function imageMeta(reference: ReferenceImageEvidence): ReferenceImageAnalysis["image"] {
  const width = typeof reference.width === "number" && reference.width > 0 ? reference.width : undefined;
  const height = typeof reference.height === "number" && reference.height > 0 ? reference.height : undefined;
  return {
    available: reference.available,
    mimeType: reference.mimeType,
    width,
    height,
    aspectRatio: width && height ? Number((width / height).toFixed(3)) : undefined,
  };
}

function nativeAnalysis(reference: ReferenceImageEvidence): ReferenceImageAnalysis {
  const image = imageMeta(reference);
  const mobile = image.aspectRatio !== undefined
    ? [image.aspectRatio < 0.9 ? "portrait-oriented" : image.aspectRatio > 1.15 ? "landscape-oriented" : "near-square"]
    : [];
  return {
    version: 1,
    analyzed: image.available,
    provider: "native-metrics",
    summary: image.available
      ? "Reference image received. Semantic vision was not available, so James preserved only deterministic image metadata."
      : "No reference image supplied.",
    style: [],
    camera: [],
    composition: [],
    character: [],
    world: [],
    animation: [],
    mobile,
    image,
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
}

export async function analyzeReferenceImage(
  reference: ReferenceImageEvidence,
  prompt: string,
): Promise<ReferenceImageAnalysis> {
  const fallback = nativeAnalysis(reference);
  if (!reference.available || !reference.dataUrl) return fallback;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const model = process.env.JAMES_REFERENCE_VISION_MODEL || "gpt-4.1-mini";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Analyze this game visual reference for a game-building system.",
                "Return ONLY valid JSON with keys: summary, style, camera, composition, character, world, animation, mobile.",
                "Use short factual phrases. Do not identify real people. Do not copy protected characters; describe visual traits instead.",
                `User request: ${prompt.slice(0, 4000)}`,
              ].join("\n"),
            },
            { type: "input_image", image_url: reference.dataUrl },
          ],
        }],
      }),
      cache: "no-store",
    });
    if (!response.ok) return fallback;
    const data = await response.json() as { output_text?: string };
    const parsed = extractJson(data.output_text || "");
    if (!parsed) return fallback;

    return {
      version: 1,
      analyzed: true,
      provider: "openai-vision",
      model,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 1200) : fallback.summary,
      style: strings(parsed.style),
      camera: strings(parsed.camera),
      composition: strings(parsed.composition),
      character: strings(parsed.character),
      world: strings(parsed.world),
      animation: strings(parsed.animation),
      mobile: strings(parsed.mobile),
      image: imageMeta(reference),
    };
  } catch {
    return fallback;
  }
}
