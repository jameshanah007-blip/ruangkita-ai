export type Creature = {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  form?: string;
  evolutionTargetId?: string;
};

export type CollectionState = {
  creatures: Creature[];
  capturedIds: string[];
};

export type PartyState = {
  activeIndex: number;
  memberIds: string[];
};

export type ProgressionState = {
  xp: number;
  level: number;
};

export type BattleState = {
  active: boolean;
  turn: "player" | "enemy";
  playerCreatureId?: string;
  enemyCreatureId?: string;
  log: string[];
};

export type EvolutionState = {
  evolvedCreatureIds: string[];
};

export type ModularGameState = {
  collection: CollectionState;
  party: PartyState;
  progression: ProgressionState;
  battle: BattleState;
  evolution: EvolutionState;
};

export function createModularGameState(): ModularGameState {
  return {
    collection: { creatures: [], capturedIds: [] },
    party: { activeIndex: 0, memberIds: [] },
    progression: { xp: 0, level: 1 },
    battle: { active: false, turn: "player", log: [] },
    evolution: { evolvedCreatureIds: [] },
  };
}

export function captureCreature(state: ModularGameState, creature: Creature): ModularGameState {
  if (state.collection.capturedIds.includes(creature.id)) return state;
  return {
    ...state,
    collection: {
      creatures: [...state.collection.creatures, creature],
      capturedIds: [...state.collection.capturedIds, creature.id],
    },
  };
}

export function addToParty(state: ModularGameState, creatureId: string): ModularGameState {
  if (!state.collection.capturedIds.includes(creatureId) || state.party.memberIds.includes(creatureId)) return state;
  return {
    ...state,
    party: {
      ...state.party,
      memberIds: [...state.party.memberIds, creatureId],
    },
  };
}

export function switchPartyMember(state: ModularGameState, index: number): ModularGameState {
  if (index < 0 || index >= state.party.memberIds.length) return state;
  return { ...state, party: { ...state.party, activeIndex: index } };
}

export function gainExperience(state: ModularGameState, amount: number): ModularGameState {
  const xp = Math.max(0, state.progression.xp + amount);
  const level = 1 + Math.floor(xp / 100);
  return { ...state, progression: { xp, level } };
}

export function gainCreatureExperience(
  state: ModularGameState,
  creatureId: string,
  amount: number
): ModularGameState {
  const creature = state.collection.creatures.find((c) => c.id === creatureId);
  if (!creature) return gainExperience(state, amount);

  const nextXp = Math.max(0, state.progression.xp + amount);
  const nextLevel = 1 + Math.floor(nextXp / 100);
  const creatureLevel = Math.max(creature.level, nextLevel);
  const creatures = state.collection.creatures.map((c) =>
    c.id === creatureId
      ? {
          ...c,
          level: creatureLevel,
          attack: c.attack + Math.max(0, creatureLevel - c.level),
          maxHp: c.maxHp + Math.max(0, creatureLevel - c.level) * 2,
          hp: Math.min(
            c.maxHp + Math.max(0, creatureLevel - c.level) * 2,
            c.hp + Math.max(0, creatureLevel - c.level) * 2
          ),
        }
      : c
  );

  return {
    ...state,
    collection: { ...state.collection, creatures },
    progression: { xp: nextXp, level: nextLevel },
  };
}

export function startTurnBattle(
  state: ModularGameState,
  playerCreatureId: string,
  enemyCreatureId: string
): ModularGameState {
  const playerExists = state.collection.creatures.some((c) => c.id === playerCreatureId);
  const enemyExists = state.collection.creatures.some((c) => c.id === enemyCreatureId);
  if (!playerExists || !enemyExists) return state;

  return {
    ...state,
    battle: {
      active: true,
      turn: "player",
      playerCreatureId,
      enemyCreatureId,
      log: ["Battle started"],
    },
  };
}

export function performBattleAttack(state: ModularGameState): ModularGameState {
  if (!state.battle.active || state.battle.turn !== "player") return state;

  const enemyId = state.battle.enemyCreatureId;
  const playerId = state.battle.playerCreatureId;
  const enemy = state.collection.creatures.find((c) => c.id === enemyId);
  const player = state.collection.creatures.find((c) => c.id === playerId);
  if (!enemy || !player) return state;

  const damage = Math.max(1, player.attack - enemy.defense);
  const updatedEnemy = { ...enemy, hp: Math.max(0, enemy.hp - damage) };
  const creatures = state.collection.creatures.map((c) =>
    c.id === enemy.id ? updatedEnemy : c
  );
  const defeated = updatedEnemy.hp === 0;

  if (defeated) {
    const afterXp = gainCreatureExperience(
      {
        ...state,
        collection: { ...state.collection, creatures },
      },
      player.id,
      50
    );

    return {
      ...afterXp,
      battle: {
        ...afterXp.battle,
        active: false,
        turn: "player",
        log: [...afterXp.battle.log, "Enemy defeated", "Player gained 50 XP"],
      },
    };
  }

  return {
    ...state,
    collection: { ...state.collection, creatures },
    battle: {
      ...state.battle,
      turn: "enemy",
      log: [...state.battle.log, "Player attacked"],
    },
  };
}

export function performEnemyTurn(state: ModularGameState): ModularGameState {
  if (!state.battle.active || state.battle.turn !== "enemy") return state;

  const enemyId = state.battle.enemyCreatureId;
  const playerId = state.battle.playerCreatureId;
  const enemy = state.collection.creatures.find((c) => c.id === enemyId);
  const player = state.collection.creatures.find((c) => c.id === playerId);
  if (!enemy || !player) return state;

  const damage = Math.max(1, enemy.attack - player.defense);
  const updatedPlayer = { ...player, hp: Math.max(0, player.hp - damage) };
  const creatures = state.collection.creatures.map((c) =>
    c.id === player.id ? updatedPlayer : c
  );

  return {
    ...state,
    collection: { ...state.collection, creatures },
    battle: {
      ...state.battle,
      active: updatedPlayer.hp > 0,
      turn: "player",
      log: [
        ...state.battle.log,
        updatedPlayer.hp > 0 ? "Enemy attacked" : "Player creature fainted",
      ],
    },
  };
}

export function evolveCreature(
  state: ModularGameState,
  creatureId: string,
  nextForm: string
): ModularGameState {
  const creature = state.collection.creatures.find((c) => c.id === creatureId);
  if (!creature || creature.level < 5) return state;

  const creatures = state.collection.creatures.map((c) =>
    c.id === creatureId ? { ...c, form: nextForm } : c
  );

  return {
    ...state,
    collection: { ...state.collection, creatures },
    evolution: {
      evolvedCreatureIds: state.evolution.evolvedCreatureIds.includes(creatureId)
        ? state.evolution.evolvedCreatureIds
        : [...state.evolution.evolvedCreatureIds, creatureId],
    },
  };
}
