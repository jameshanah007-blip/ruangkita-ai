import type { GameSpecification } from "./gameSchema";

export type FunZoneSession = {
  id: string;
  game: GameSpecification;
  startedAt: string;
  currentChallenge: number;
  score: number;
  lives: number;
  completed: boolean;
};

function createSessionId(): string {
  return `fz-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createSession(
  game: GameSpecification
): FunZoneSession {
  return {
    id: createSessionId(),
    game,
    startedAt: new Date().toISOString(),
    currentChallenge: 0,
    score: 0,
    lives: game.rules.lives,
    completed: false,
  };
}

export function updateSession(
  session: FunZoneSession,
  update: Partial<
    Pick<
      FunZoneSession,
      | "currentChallenge"
      | "score"
      | "lives"
      | "completed"
    >
  >
): FunZoneSession {
  return {
    ...session,
    ...update,
  };
}