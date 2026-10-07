import type { GameSpecification2D } from "./types";
import { buildMonsterTamerRuntime } from "./genres/monsterTamer";
import { buildFarmingRuntime } from "./genres/farming";
import { buildAdventureRuntime } from "./genres/adventure";
import { buildRpgRuntime } from "./genres/rpg";
import { buildPlatformerRuntime } from "./genres/platformer";
import { buildRacingRuntime } from "./genres/racing";
import { buildPuzzleRuntime } from "./genres/puzzle";
import { buildShooterRuntime } from "./genres/shooter";
import { buildStrategyRuntime } from "./genres/strategy";
import { buildSimulationRuntime } from "./genres/simulation";
import { buildSurvivalRuntime } from "./genres/survival";

const BUILDERS={
  monster_tamer:buildMonsterTamerRuntime,
  farming:buildFarmingRuntime,
  adventure:buildAdventureRuntime,
  rpg:buildRpgRuntime,
  platformer:buildPlatformerRuntime,
  racing:buildRacingRuntime,
  puzzle:buildPuzzleRuntime,
  shooter:buildShooterRuntime,
  strategy:buildStrategyRuntime,
  simulation:buildSimulationRuntime,
  survival:buildSurvivalRuntime,
} as const;

export function buildGenreRuntime(spec:GameSpecification2D):string{
  return BUILDERS[spec.genre](spec);
}
