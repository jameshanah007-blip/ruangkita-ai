export type JamesWorldKnowledge = {
  world: string;
  ground: string;
  accent: string;
  landmark: string;
  obstacle: string;
  enemy: string;
  item: string;
};

export type JamesMechanicKnowledge = {
  mechanic: string;
  action: string;
  reward: string;
  failure: string;
};

export const JAMES_WORLD_KNOWLEDGE: Record<string, JamesWorldKnowledge> = {
  hospital: { world:"hospital", ground:"#0b1220", accent:"#ef4444", landmark:"ward", obstacle:"bed", enemy:"shadow", item:"medicine" },
  forest: { world:"forest", ground:"#07140c", accent:"#22c55e", landmark:"tree", obstacle:"rock", enemy:"wild creature", item:"seed" },
  ocean: { world:"ocean", ground:"#031522", accent:"#06b6d4", landmark:"wave", obstacle:"reef", enemy:"sea creature", item:"supply crate" },
  space: { world:"space", ground:"#05020f", accent:"#8b5cf6", landmark:"planet", obstacle:"asteroid", enemy:"drone", item:"energy core" },
  city: { world:"city", ground:"#08090d", accent:"#38bdf8", landmark:"building", obstacle:"barrier", enemy:"hostile", item:"artifact" },
  castle: { world:"castle", ground:"#0b0811", accent:"#a855f7", landmark:"tower", obstacle:"wall", enemy:"guardian", item:"relic" },
  laboratory: { world:"laboratory", ground:"#061014", accent:"#14b8a6", landmark:"machine", obstacle:"console", enemy:"security drone", item:"sample" },
  desert: { world:"desert", ground:"#1a0e05", accent:"#f59e0b", landmark:"dune", obstacle:"ruin", enemy:"scavenger", item:"artifact" },
  village: { world:"village", ground:"#08140a", accent:"#84cc16", landmark:"house", obstacle:"fence", enemy:"raider", item:"crop" },
  island: { world:"island", ground:"#041316", accent:"#14b8a6", landmark:"palm", obstacle:"rock", enemy:"creature", item:"crate" },
  unknown: { world:"unknown", ground:"#07111f", accent:"#22d3ee", landmark:"structure", obstacle:"debris", enemy:"hostile", item:"artifact" },
};

export const JAMES_MECHANIC_KNOWLEDGE: Record<string, JamesMechanicKnowledge> = {
  explore:{mechanic:"explore",action:"move through discovered areas",reward:"new area",failure:"lose time"},
  collect:{mechanic:"collect",action:"reach and acquire objectives",reward:"resources",failure:"objective remains incomplete"},
  combat:{mechanic:"combat",action:"attack nearby threats",reward:"defeated threat",failure:"health loss"},
  shooting:{mechanic:"shooting",action:"attack threats from range",reward:"safe distance",failure:"ammunition/health pressure"},
  survival:{mechanic:"survival",action:"avoid threats until the survival timer ends",reward:"survival",failure:"health reaches zero"},
  stealth:{mechanic:"stealth",action:"avoid detection zones",reward:"safe traversal",failure:"detection damage"},
  racing:{mechanic:"racing",action:"reach the finish before the clock",reward:"finish",failure:"collision/time pressure"},
  puzzle:{mechanic:"puzzle",action:"solve a generated interaction",reward:"progress",failure:"delayed progress"},
  rescue:{mechanic:"rescue",action:"reach and secure targets",reward:"rescued target",failure:"target remains unsafe"},
  farming:{mechanic:"farming",action:"perform repeated resource actions",reward:"resources and progression",failure:"slow progression"},
  escort:{mechanic:"escort",action:"protect the objective over time",reward:"safe arrival",failure:"objective lost"},
  dialogue:{mechanic:"dialogue",action:"advance interaction choices",reward:"story progress",failure:"delayed story progress"},
};

export function worldKnowledge(world: string): JamesWorldKnowledge {
  return JAMES_WORLD_KNOWLEDGE[world] || JAMES_WORLD_KNOWLEDGE.unknown;
}

export function mechanicKnowledge(mechanic: string): JamesMechanicKnowledge {
  return JAMES_MECHANIC_KNOWLEDGE[mechanic] || JAMES_MECHANIC_KNOWLEDGE.explore;
}
