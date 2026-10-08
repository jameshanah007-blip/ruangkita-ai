import type { AssetProvider } from "./assetProvider";

type GeminiImageResponse = {
  output_image?: {
    data?: string;
    mime_type?: string;
  };
};

function promptFor(asset: Parameters<AssetProvider["generate"]>[0]): string {
  const animation = asset.animationNeeds.length
    ? ` Animation needs: ${asset.animationNeeds.join(", ")}.`
    : "";

  const isVehicle = asset.entityKind === "vehicle";
  const isRacingTrack = asset.tags.includes("racing-track");
  const kindInstruction = isVehicle
    ? "Create an original 2D racing vehicle for a mobile game, isolated, centered, readable from a top-down view, with a distinctive silhouette derived from the prompt."
    : isRacingTrack
      ? "Create a complete 2D top-down racing circuit environment for a mobile game, including road surface, turns, start/finish area, barriers, scenery and visual landmarks derived from the prompt."
      : asset.kind === "character"
        ? "Create a full-body original anime-inspired game protagonist."
        : asset.kind === "enemy"
          ? "Create a full-body original anime-inspired game enemy."
          : asset.kind === "npc"
            ? "Create a full-body original anime-inspired game NPC."
            : "Create a full-body original anime-inspired game companion.";

  return [
    kindInstruction,
    "High-quality 2D Japanese anime game art.",
    "Centered single subject, front-facing or three-quarter view, clean readable silhouette.",
    ...(isVehicle ? ["Transparent background.", "No scenery, no UI, no text, no logo."] : isRacingTrack ? ["Wide 16:9 game environment composition.", "No characters, no UI, no text, no logo."] : ["Isolated on a completely solid pure magenta background (#ff00ff) for chroma-key removal.", "Do not use magenta or purple in the character itself."]),
    ...(isRacingTrack ? ["No text, no logo, no watermark, no frame, no UI, no characters, no road-sign text."] : ["No text, no logo, no watermark, no frame, no UI, no scenery."]),
    "Preserve every identity trait in the description.",
    asset.prompt + ".",
    animation,
  ].join(" ");
}

export function createGeminiImageProvider(): AssetProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Fun Zone Gemini image provider unavailable: GEMINI_API_KEY is not configured.");
    return null;
  }

  return {
    name: "gemini-3.1-flash-image",
    supports: ["character", "npc", "enemy", "companion", "environment"],
    async generate(asset) {
      const prompt = promptFor(asset);

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-3.1-flash-image",
            input: prompt,
            response_format: {
              type: "image",
              mime_type: "image/jpeg",
              aspect_ratio: asset.tags.includes("racing-track") ? "16:9" : "1:1",
              image_size: "1K",
            },
          }),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          `Gemini image provider HTTP ${response.status}: ${message.slice(0, 500)}`,
        );
      }

      const data = (await response.json()) as GeminiImageResponse;
      const b64 = data.output_image?.data;

      if (!b64) {
        throw new Error("Gemini image provider returned no output_image data.");
      }

      return {
        uri: `data:${data.output_image?.mime_type || "image/jpeg"};base64,${b64}`,
        metadata: {
          provider: "gemini-3.1-flash-image",
          model: "gemini-3.1-flash-image",
          identityPreserved: true,
          prompt,
          chromaKey: "#ff00ff",
        },
      };
    },
  };
}
