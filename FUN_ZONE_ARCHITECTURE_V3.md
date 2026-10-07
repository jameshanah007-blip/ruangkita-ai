# Fun Zone Architecture V3

## Evidence-based design

Fun Zone V3 follows existing working game-agent patterns instead of inventing another game runtime.

Primary references:
- Phaser: https://github.com/phaserjs/phaser
- Phaser examples: https://github.com/phaserjs/examples
- Phaser Game Agent: https://github.com/phaserjs/phaser-game-agent
- KRAFTON A2Z GameSpec-Bench: https://github.com/krafton-ai/a2z-gamespec-bench

Target workflow:
Prompt -> Game Director/GDD -> Fixed Game Contract -> Phaser project/runtime -> Source Inspection + Scenario Replay + Playtest -> Requirement Feedback -> Repair -> Retest

## Single source of truth

GameSpec is the contract. Repair must preserve the same requirements.

## Runtime authority

Phaser is the runtime authority for recognized 2D games.

Phaser owns: game loop, Scene lifecycle, rendering, Game Objects, input, camera, physics integration, scale/responsive behavior.

RuangKita owns: prompt understanding, GameSpec creation, genre definitions, gameplay rules, asset planning, test contracts, repair decisions and learning.

## Genre model

A genre is a definition, not an HTML template.

Each genre provides scenes, systems, gameplay actions, controls, visual direction and acceptance scenarios.

## Test model

Game success requires runtime health plus genre-specific behavior. Testing covers runtime health, architecture identity, scenario replay, playtest evidence and restart verification.

## Repair model

Repair modifies the failing Phaser implementation while keeping the same GameSpec and acceptance contract. It must never silently downgrade to a different engine or generic template.

## Migration rule

Legacy Fun Zone engines are frozen and retained temporarily for rollback only.

Frozen legacy files include:
- app/fun-zone/engine/jamesAutonomousGameEngine.ts
- app/fun-zone/engine/james2DGenreTemplates.ts
- app/fun-zone/engine/james2DTopDownTemplate.ts
- app/fun-zone/engine/jamesPokemon2DTemplate.ts
- app/fun-zone/engine/jamesRacing3DTemplate.ts
- app/fun-zone/engine/localFactory.ts
- app/fun-zone/engine/localGenerator.ts
- app/fun-zone/engine/gameComposer.ts
- app/fun-zone/engine/gameBuildPlan.ts
- app/fun-zone/engine/gameSystemFactory.ts

For recognized 2D games the new authority is app/fun-zone/phaser/.

The old app/fun-zone/engine2d/ folder is a temporary compatibility boundary. Its authoritative entry point delegates to Phaser; it must not contain a second runtime.

## Phases

Phase 1: real Phaser runtime and route migration.
Phase 2: move Director output from legacy GameBlueprint into canonical GameSpec.
Phase 3: repair specific Phaser scene/system code instead of regenerating HTML.
Phase 4: integrate Phaser Game Agent/MCP-style project operations for long-horizon coding and playtesting.

Do not reintroduce another in-house HTML game engine.