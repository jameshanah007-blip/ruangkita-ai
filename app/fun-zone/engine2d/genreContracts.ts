import type { Engine2DGenre } from "./types";

export type GenreContract={
  genre:Engine2DGenre;
  requiredActions:string[];
  requiredSignals:string[];
};

export const GENRE_CONTRACTS:Record<Engine2DGenre,GenreContract>={
  monster_tamer:{genre:"monster_tamer",requiredActions:["talk","accept_quest","encounter","attack","capture","add_party"],requiredSignals:["dialogueStarted","questAccepted","encounterStarted","battleStarted","captureCount","partyCount"]},
  farming:{genre:"farming",requiredActions:["till","plant","water","harvest","sell"],requiredSignals:["tilled","planted","watered","harvested","sold"]},
  adventure:{genre:"adventure",requiredActions:["talk","collect","open_exit"],requiredSignals:["dialogueStarted","itemsCollected","exitOpened"]},
  rpg:{genre:"rpg",requiredActions:["talk","battle","loot","level_up"],requiredSignals:["dialogueStarted","battleWins","lootCount","level"]},
  platformer:{genre:"platformer",requiredActions:["jump","collect","reach_goal"],requiredSignals:["jumps","collectCount","goalReached"]},
  racing:{genre:"racing",requiredActions:["accelerate","steer","checkpoint","finish"],requiredSignals:["maxSpeed","checkpoints","finished"]},
  puzzle:{genre:"puzzle",requiredActions:["select","solve"],requiredSignals:["selections","solved"]},
  shooter:{genre:"shooter",requiredActions:["aim","shoot","reload","defeat"],requiredSignals:["shots","reloads","enemiesDefeated"]},
  strategy:{genre:"strategy",requiredActions:["place","command","capture_point"],requiredSignals:["unitsPlaced","commands","pointsCaptured"]},
  simulation:{genre:"simulation",requiredActions:["build","allocate","upgrade"],requiredSignals:["buildings","allocated","upgrades"]},
  survival:{genre:"survival",requiredActions:["scavenge","craft","defend","survive_wave"],requiredSignals:["resources","crafted","waves","defended"]}
};
