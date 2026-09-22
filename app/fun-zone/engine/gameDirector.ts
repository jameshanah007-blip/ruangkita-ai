import type { GameSpecification } from "./gameSchema";
import { generateLocalGame } from "./localGenerator";

type GameSource = "ai" | "local";

type GameDirectorResult = {
  game: GameSpecification;
  source: GameSource;
};

type GenerateGameResponse = {
  game?: GameSpecification;
  error?: string;
};

export async function createGame(
  mood: string
): Promise<GameDirectorResult> {
  try {
    const response = await fetch(
      "http://localhost:3000/api/fun-zone/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mood,
        }),
      }
    );

    if (response.ok) {
      const data =
        (await response.json()) as GenerateGameResponse;

      if (data.game) {
        return {
          game: data.game,
          source: "ai",
        };
      }
    }
  } catch (error) {
    console.error(
      "AI Game Generator tidak tersedia:",
      error
    );
  }

  console.log(
    "Menggunakan Local Game Generator."
  );

  return {
    game: generateLocalGame(mood),
    source: "local",
  };
}