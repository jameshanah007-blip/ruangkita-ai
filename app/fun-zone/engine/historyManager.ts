export type FunZoneHistoryItem = {
  session_id: string;
  game_title: string;
  game_theme: string | null;
  game_genre: string | null;
  difficulty: string | null;
  mood: string | null;
  source: string;
  score: number;
  lives_remaining: number;
  total_challenges: number;
  completed: boolean;
  started_at: string;
  finished_at: string | null;
};

export async function getFunZoneHistory(): Promise<
  FunZoneHistoryItem[]
> {
  try {
    const response = await fetch(
      "/api/fun-zone/history",
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (
      !data ||
      !Array.isArray(data.sessions)
    ) {
      return [];
    }

    return data.sessions;
  } catch (error) {
    console.error(
      "Gagal membaca history Fun Zone:",
      error
    );

    return [];
  }
}

export function getRecentThemes(
  history: FunZoneHistoryItem[]
): string[] {
  return history
    .slice(0, 5)
    .map((item) => item.game_theme)
    .filter(
      (theme): theme is string =>
        Boolean(theme)
    );
}

export function getRecentTitles(
  history: FunZoneHistoryItem[]
): string[] {
  return history
    .slice(0, 5)
    .map((item) => item.game_title)
    .filter(
      (title): title is string =>
        Boolean(title)
    );
}

export function getRecentDifficulties(
  history: FunZoneHistoryItem[]
): string[] {
  return history
    .slice(0, 5)
    .map((item) => item.difficulty)
    .filter(
      (difficulty): difficulty is string =>
        Boolean(difficulty)
    );
}