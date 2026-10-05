import type { GameSystemId } from "./gameSystemFactory";

export type GameplayModule = {
  id: GameSystemId;
  runtime: "stateful";
  reusable: true;
  actions: string[];
  state: string[];
};

const definitions: Record<GameSystemId, Omit<GameplayModule, "id">> = {
  exploration:{runtime:"stateful",reusable:true,actions:["move","interact"],state:["worldPosition","currentArea","discoveredAreas"]},
  combat:{runtime:"stateful",reusable:true,actions:["attack","defend"],state:["health","enemyState","combatState"]},
  turnBasedCombat:{runtime:"stateful",reusable:true,actions:["chooseAction","endTurn"],state:["battleTurn","actionResult"]},
  collection:{runtime:"stateful",reusable:true,actions:["collect","capture"],state:["collection","collectionCount"]},
  party:{runtime:"stateful",reusable:true,actions:["switchMember"],state:["party","activeMember"]},
  progression:{runtime:"stateful",reusable:true,actions:["gainXp"],state:["xp","level"]},
  evolution:{runtime:"stateful",reusable:true,actions:["evolve"],state:["form","evolutionState"]},
  inventory:{runtime:"stateful",reusable:true,actions:["openInventory","useItem"],state:["inventory"]},
  items:{runtime:"stateful",reusable:true,actions:["pickup","useItem"],state:["items"]},
  npc:{runtime:"stateful",reusable:true,actions:["talk","interact"],state:["npcState"]},
  dialogue:{runtime:"stateful",reusable:true,actions:["nextDialogue","chooseDialogue"],state:["dialogueNode","dialogueChoice"]},
  quest:{runtime:"stateful",reusable:true,actions:["acceptQuest","completeQuest"],state:["questState","objectiveProgress"]},
  relationship:{runtime:"stateful",reusable:true,actions:["gift","talk"],state:["relationshipScore"]},
  farming:{runtime:"stateful",reusable:true,actions:["plant","harvest"],state:["plots","crops"]},
  crafting:{runtime:"stateful",reusable:true,actions:["craft"],state:["recipes","craftedItems"]},
  economy:{runtime:"stateful",reusable:true,actions:["buy","sell"],state:["currency","shopInventory"]},
  racing:{runtime:"stateful",reusable:true,actions:["accelerate","brake","steer"],state:["vehiclePosition","lap","checkpoint"]},
  puzzle:{runtime:"stateful",reusable:true,actions:["select","solve"],state:["puzzleState","solutionProgress"]},
  stealth:{runtime:"stateful",reusable:true,actions:["hide","sneak"],state:["detection","guardState"]},
  survival:{runtime:"stateful",reusable:true,actions:["move","useItem"],state:["health","threatLevel","survivalTime"]},
  strategy:{runtime:"stateful",reusable:true,actions:["place","command"],state:["units","resources","objectiveState"]},
  platforming:{runtime:"stateful",reusable:true,actions:["move","jump"],state:["position","velocity","grounded"]},
};

export function getGameplayModules(ids: GameSystemId[]): GameplayModule[] {
  return ids.map((id) => ({ id, ...definitions[id] }));
}
