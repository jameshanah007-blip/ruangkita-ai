import type { AssetProvider } from "./assetProvider";

type OpenAIImageResponse = {
  output?: Array<{
    type?: string;
    result?: string;
  }>;
};

function promptFor(asset: Parameters<AssetProvider["generate"]>[0]): string {
  const animation = asset.animationNeeds.length
    ? ` Animation needs: ${asset.animationNeeds.join(", ")}.`
    : "";

  const kindInstruction =
    asset.kind === "character"
      ? "Create a full-body game character sprite/illustration, centered, isolated, transparent background."
      : asset.kind === "enemy"
        ? "Create a full-body game enemy creature, centered, isolated, transparent background."
        : asset.kind === "npc"
          ? "Create a full-body game NPC, centered, isolated, transparent background."
          : "Create a game companion character, centered, isolated, transparent background.";

  return [
    kindInstruction,
    "Anime-inspired original game art.",
    "Preserve every identity trait in the description.",
    "No text, no logo, no watermark, no frame, no UI.",
    asset.prompt + ".",
    animation,
  ].join(" ");
}

export function createOpenAIImageProvider(): AssetProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  return {
    name: "openai-gpt-image-2",
    supports: ["character", "npc", "enemy", "companion"],
    async generate(asset) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-6-luna",
          input: promptFor(asset),
          tools: [
            {
              type: "image_generation",
              model: "gpt-image-2",
              size: "1024x1024",
              quality: "low",
              background: "transparent",
              output_format: "png",
            },
          ],
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`OpenAI image provider HTTP ${response.status}: ${message.slice(0, 500)}`);
      }

      const data = (await response.json()) as OpenAIImageResponse;
      const image = data.output?.find(
        (item) => item.type === "image_generation_call" && typeof item.result === "string",
      );

      if (!image?.result) {
        throw new Error("OpenAI image provider returned no generated image.");
      }

      return {
        uri: `data:image/png;base64,${image.result}`,
        metadata: {
          provider: "openai-gpt-image-2",
          model: "gpt-image-2",
          identityPreserved: true,
          prompt: promptFor(asset),
        },
      };
    },
  };
}
