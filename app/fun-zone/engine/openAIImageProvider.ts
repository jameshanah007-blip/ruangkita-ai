import type { AssetProvider } from "./assetProvider";

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
};

function promptFor(asset: Parameters<AssetProvider["generate"]>[0]): string {
  const animation = asset.animationNeeds.length
    ? ` Animation needs: ${asset.animationNeeds.join(", ")}.`
    : "";

  const isVehicle = asset.entityKind === "vehicle";
  const isRacingTrack = asset.tags.includes("racing-track");
  const kindInstruction = isVehicle
    ? "Create an original 2D racing vehicle for a mobile game, isolated and centered, readable from a top-down view, with a distinctive silhouette derived from the prompt."
    : isRacingTrack
      ? "Create a complete 2D top-down racing circuit environment for a mobile game, with road surface, turns, start/finish area, barriers, scenery and landmarks derived from the prompt."
      : asset.kind === "character"
        ? "Create a full-body original anime-inspired game protagonist, centered, isolated, transparent background."
        : asset.kind === "enemy"
          ? "Create a full-body original anime-inspired game enemy, centered, isolated, transparent background."
          : asset.kind === "npc"
            ? "Create a full-body original anime-inspired game NPC, centered, isolated, transparent background."
            : "Create a full-body original anime-inspired game companion, centered, isolated, transparent background.";

  return [
    kindInstruction,
    "High-quality 2D Japanese anime game art.",
    "Preserve every identity trait in the description.",
    ...(isVehicle ? ["Clean vehicle silhouette suitable for a mobile game sprite.", "No scenery or UI."] : isRacingTrack ? ["Wide 16:9 environment composition.", "No characters or UI."] : ["Clean silhouette suitable for a mobile game character sprite."]),
    "No text, no logo, no watermark, no frame, no UI.",
    asset.prompt + ".",
    animation,
  ].join(" ");
}

export function createOpenAIImageProvider(): AssetProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("Fun Zone real image provider unavailable: OPENAI_API_KEY is not configured.");
    return null;
  }

  return {
    name: "openai-gpt-image-2",
    supports: ["character", "npc", "enemy", "companion", "environment"],
    async generate(asset) {
      const prompt = promptFor(asset);

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-2",
          prompt,
          size: "1024x1024",
          quality: "low",
          background: asset.tags.includes("racing-track") ? "opaque" : "transparent",
          output_format: "png",
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          `OpenAI image provider HTTP ${response.status}: ${message.slice(0, 500)}`,
        );
      }

      const data = (await response.json()) as OpenAIImageResponse;
      const b64 = data.data?.[0]?.b64_json;

      if (!b64) {
        throw new Error("OpenAI image provider returned no b64_json image.");
      }

      return {
        uri: `data:image/png;base64,${b64}`,
        metadata: {
          provider: "openai-gpt-image-2",
          model: "gpt-image-2",
          identityPreserved: true,
          imageBacked: true,
          fallback: false,
          prompt,
          revisedPrompt: data.data?.[0]?.revised_prompt || null,
        },
      };
    },
  };
}
