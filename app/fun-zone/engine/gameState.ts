import type { GameBlueprint } from "./gameBlueprint";

export type GameEntityState = {
  id: string;

  type:
    | "player"
    | "npc"
    | "enemy"
    | "item"
    | "obstacle"
    | "portal"
    | "decoration";

  name: string;

  description: string;

  x: number;

  y: number;

  health: number;

  attack: number;

  defense: number;

  active: boolean;
};

export type GameState = {
  sessionId: string;

  gameTitle: string;

  genre: GameBlueprint["genre"];

  difficulty: GameBlueprint["difficulty"];

  player: {
    x: number;
    y: number;
    health: number;
    score: number;
    lives: number;
  };

  world: {
    weather: GameBlueprint["world"]["weather"];

    environment: GameBlueprint["world"]["environment"];
  };

  entities: GameEntityState[];

  events: string[];

  tick: number;

  gameOver: boolean;

  victory: boolean;

  updatedAt: number;
};

export function createInitialGameState(
  game: GameBlueprint,
  sessionId: string
): GameState {
  return {
    sessionId,

    gameTitle: game.title,

    genre: game.genre,

    difficulty: game.difficulty,

    player: {
      x: 50,

      y: 70,

      health: game.player.health,

      score: 0,

      lives: game.rules.maxLives,
    },

    world: {
      weather: game.world.weather,

      environment: game.world.environment,
    },

    entities: game.entities.map(
      (entity) => ({
        id: entity.id,

        type: entity.type,

        name: entity.name,

        description:
          entity.description,

        x: entity.x,

        y: entity.y,

        health: entity.health,

        attack: entity.attack,

        defense: entity.defense,

        active: true,
      })
    ),

    events: [],

    tick: 0,

    gameOver: false,

    victory: false,

    updatedAt: Date.now(),
  };
}