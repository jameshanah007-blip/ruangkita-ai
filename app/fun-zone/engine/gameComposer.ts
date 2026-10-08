import type { GameBlueprint } from "../laboratory/types";
import { buildGameSystemPlan, type GameSystemId, type GameSystemPlan } from "./gameSystemFactory";

export type GameSystemModule = {
  id: GameSystemId;
  role: "core" | "support";
  responsibilities: string[];
  state: string[];
  actions: string[];
  testGoals: string[];
};

export type ComposedGamePlan = {
  primaryMode: GameSystemPlan["primaryMode"];
  systems: GameSystemModule[];
  architecture: string;
  requiredState: string[];
  requiredActions: string[];
  testGoals: string[];
};

const catalog: Record<GameSystemId, Omit<GameSystemModule, "id">> = {
  exploration:{role:"core",responsibilities:["Move through the world","Discover locations and interactable objects"],state:["worldPosition","currentArea","discoveredAreas"],actions:["move","interact"],testGoals:["player position changes","area discovery can progress"]},
  combat:{role:"core",responsibilities:["Resolve battles","Apply damage and defeat enemies"],state:["health","enemyState","combatState"],actions:["attack","defend"],testGoals:["attack changes enemy state","health can change"]},
  turnBasedCombat:{role:"core",responsibilities:["Alternate player and enemy turns","Resolve one action at a time"],state:["battleTurn","actionResult"],actions:["chooseAction","endTurn"],testGoals:["turn changes","battle action changes state"]},
  collection:{role:"core",responsibilities:["Acquire and track creatures or collectibles"],state:["collection","collectionCount"],actions:["collect","capture"],testGoals:["collection count changes"]},
  party:{role:"support",responsibilities:["Manage an active team"],state:["party","activeMember"],actions:["switchMember"],testGoals:["active member changes"]},
  progression:{role:"support",responsibilities:["Track experience and growth"],state:["xp","level"],actions:["gainXp"],testGoals:["xp or level changes"]},
  evolution:{role:"support",responsibilities:["Change entity form or capabilities"],state:["form","evolutionState"],actions:["evolve"],testGoals:["form changes after requirement"]},
  inventory:{role:"support",responsibilities:["Store owned items"],state:["inventory"],actions:["openInventory","useItem"],testGoals:["inventory changes"]},
  items:{role:"support",responsibilities:["Spawn and consume useful items"],state:["items"],actions:["pickup","useItem"],testGoals:["item state changes"]},
  npc:{role:"support",responsibilities:["Provide interactive non-player characters"],state:["npcState"],actions:["talk","interact"],testGoals:["NPC interaction produces state/content change"]},
  dialogue:{role:"support",responsibilities:["Present branching or sequential dialogue"],state:["dialogueNode","dialogueChoice"],actions:["nextDialogue","chooseDialogue"],testGoals:["dialogue node changes"]},
  quest:{role:"support",responsibilities:["Track objectives and completion"],state:["questState","objectiveProgress"],actions:["acceptQuest","completeQuest"],testGoals:["objective progress changes"]},
  relationship:{role:"support",responsibilities:["Track bonds with characters"],state:["relationshipScore"],actions:["gift","talk"],testGoals:["relationship score changes"]},
  farming:{role:"core",responsibilities:["Prepare soil","Plant seeds","Water crops","Harvest resources"],state:["plots","crops"],actions:["till","plant","water","harvest"],testGoals:["farming cycle changes crop state from empty to harvested"]},
  crafting:{role:"support",responsibilities:["Combine resources into items"],state:["recipes","craftedItems"],actions:["craft"],testGoals:["crafted item appears"]},
  economy:{role:"support",responsibilities:["Buy and sell through currency"],state:["currency","shopInventory"],actions:["buy","sell"],testGoals:["currency changes after transaction"]},
  racing:{role:"core",responsibilities:["Drive toward checkpoints and finish"],state:["vehiclePosition","lap","checkpoint"],actions:["accelerate","brake","steer"],testGoals:["vehicle position changes","checkpoint or lap progresses"]},
  puzzle:{role:"core",responsibilities:["Solve a logical challenge"],state:["puzzleState","solutionProgress"],actions:["select","solve"],testGoals:["solution progress changes"]},
  stealth:{role:"core",responsibilities:["Avoid detection and patrols"],state:["detection","guardState"],actions:["hide","sneak"],testGoals:["detection changes with movement"]},
  survival:{role:"core",responsibilities:["Manage threats and survive over time"],state:["health","threatLevel","survivalTime"],actions:["move","useItem"],testGoals:["survival state advances"]},
  strategy:{role:"core",responsibilities:["Make tactical decisions over controlled resources"],state:["units","resources","objectiveState"],actions:["place","command"],testGoals:["unit or resource state changes"]},
  platforming:{role:"core",responsibilities:["Jump between platforms and avoid hazards"],state:["position","velocity","grounded"],actions:["move","jump"],testGoals:["vertical position changes"]},
  housing:{role:"support",responsibilities:["Upgrade the player home and persist its level"],state:["houseLevel"],actions:["upgradeHome"],testGoals:["house level increases after upgrade"]},
  vehicleUpgrade:{role:"support",responsibilities:["Improve vehicle performance between races"],state:["vehicleUpgradeLevel"],actions:["upgradeVehicle"],testGoals:["vehicle upgrade level increases"]},
};

export function composeGamePlan(blueprint: GameBlueprint): ComposedGamePlan {
  const plan = buildGameSystemPlan(blueprint);
  const systems = plan.systems.map((id) => ({id, ...catalog[id]}));
  const requiredState = [...new Set(systems.flatMap((s) => s.state))];
  const requiredActions = [...new Set(systems.flatMap((s) => s.actions))];
  const testGoals = [...new Set(systems.flatMap((s) => s.testGoals))];

  return {
    primaryMode: plan.primaryMode,
    systems,
    architecture: systems.map((s) => s.id).join(" + "),
    requiredState,
    requiredActions,
    testGoals,
  };
}
