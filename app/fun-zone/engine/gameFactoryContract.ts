import type { GameBlueprint } from "../laboratory/types";

export type GameFactorySource = "ai" | "local";

export type GameFactoryResult = {
  source: GameFactorySource;
  provider: string;
  model: string;
  gameHtml: string;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
};

export type GameFactory = (
  blueprint: GameBlueprint
) => Promise<GameFactoryResult> | GameFactoryResult;

export const MOBILE_GAME_RUNTIME_CONTRACT = {
  canvas: true,
  responsive: true,
  pointerInput: true,
  touchInput: true,
  keyboardOptional: true,
  standalone: true,
  gameTestProtocol: true,
  restartable: true,
} as const;
