import type { GameCommand } from "./gameCommands";
import type { GameState } from "./gameState";

export function executeGameCommand(
  state: GameState,
  command: GameCommand
): GameState {
  const nextState: GameState = {
    ...state,

    player: {
      ...state.player,
    },

    world: {
      ...state.world,
    },

    entities: state.entities.map(
      (entity) => ({
        ...entity,
      })
    ),

    events: [
      ...state.events,
    ],

    updatedAt: Date.now(),
  };

  switch (command.type) {
    case "SPAWN_ENTITY": {
      const exists =
        nextState.entities.some(
          (entity) =>
            entity.id ===
            command.entity.id
        );

      if (!exists) {
        nextState.entities.push({
          id: command.entity.id,

          type: command.entity.type,

          name: command.entity.name,

          description:
            command.entity.description,

          x: command.entity.x,

          y: command.entity.y,

          health:
            command.entity.health,

          attack:
            command.entity.attack,

          defense:
            command.entity.defense,

          active: true,
        });

        nextState.events.unshift(
          `Entity baru muncul: ${command.entity.name}.`
        );
      }

      return nextState;
    }

    case "REMOVE_ENTITY": {
      nextState.entities =
        nextState.entities.map(
          (entity) =>
            entity.id ===
            command.entityId
              ? {
                  ...entity,
                  active: false,
                }
              : entity
        );

      return nextState;
    }

    case "MOVE_ENTITY": {
      nextState.entities =
        nextState.entities.map(
          (entity) =>
            entity.id ===
            command.entityId
              ? {
                  ...entity,

                  x: command.x,

                  y: command.y,
                }
              : entity
        );

      return nextState;
    }

    case "DAMAGE_ENTITY": {
      nextState.entities =
        nextState.entities.map(
          (entity) => {
            if (
              entity.id !==
              command.entityId
            ) {
              return entity;
            }

            const health =
              Math.max(
                0,
                entity.health -
                  command.amount
              );

            return {
              ...entity,

              health,

              active:
                health > 0,
            };
          }
        );

      return nextState;
    }

    case "HEAL_PLAYER": {
      nextState.player.health =
        Math.min(
          1000,
          nextState.player.health +
            command.amount
        );

      return nextState;
    }

    case "DAMAGE_PLAYER": {
      nextState.player.health =
        Math.max(
          0,
          nextState.player.health -
            command.amount
        );

      if (
        nextState.player.health === 0
      ) {
        nextState.gameOver = true;
      }

      return nextState;
    }

    case "CHANGE_WEATHER": {
      nextState.world.weather =
        command.weather;

      nextState.events.unshift(
        `Cuaca berubah menjadi ${command.weather}.`
      );

      return nextState;
    }

    case "ADD_SCORE": {
      nextState.player.score =
        Math.max(
          0,
          nextState.player.score +
            command.amount
        );

      return nextState;
    }

    case "TRIGGER_EVENT": {
      nextState.events.unshift(
        command.message
      );

      return nextState;
    }

    case "START_BATTLE": {
      const enemy =
        nextState.entities.find(
          (entity) =>
            entity.id ===
            command.enemyId
        );

      if (enemy) {
        nextState.events.unshift(
          `Pertarungan dimulai melawan ${enemy.name}.`
        );
      } else {
        nextState.events.unshift(
          `Pertarungan dimulai melawan ${command.enemyId}.`
        );
      }

      return nextState;
    }

    case "END_BATTLE": {
      nextState.events.unshift(
        `Pertarungan berakhir: ${command.result}.`
      );

      if (
        command.result ===
        "victory"
      ) {
        nextState.player.score +=
          100;
      }

      if (
        command.result ===
        "defeat"
      ) {
        nextState.player.lives =
          Math.max(
            0,
            nextState.player.lives -
              1
          );

        if (
          nextState.player.lives ===
          0
        ) {
          nextState.gameOver = true;
        }
      }

      return nextState;
    }

    case "OPEN_AREA": {
      nextState.events.unshift(
        `Area baru terbuka: ${command.areaName}.`
      );

      return nextState;
    }

    case "CHANGE_DIFFICULTY": {
      nextState.difficulty =
        command.difficulty;

      nextState.events.unshift(
        `Kesulitan berubah menjadi ${command.difficulty}.`
      );

      return nextState;
    }

    default:
      return nextState;
  }
}

export function executeGameCommands(
  state: GameState,
  commands: GameCommand[]
): GameState {
  const nextState =
    commands.reduce(
      (
        currentState,
        command
      ) =>
        executeGameCommand(
          currentState,
          command
        ),
      {
        ...state,

        tick:
          state.tick + 1,
      }
    );

  return {
    ...nextState,

    updatedAt: Date.now(),
  };
}