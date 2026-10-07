import type { GameBlueprint } from "../laboratory/types";
import type { EntitySpec2D,GameSpecification2D } from "./types";
import { resolve2DGenre, getGenreProfile } from "./genreResolver";

const h=(s:string)=>{let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619)}return n>>>0};
const mk=(id:string,kind:EntitySpec2D["kind"],label:string,x:number,y:number,metadata?:EntitySpec2D["metadata"]):EntitySpec2D=>({id,kind,label,x,y,width:32,height:32,interactive:kind==="npc"||kind==="creature"||kind==="enemy"||kind==="item",metadata});

function requiredEntities(genre:EntitySpec2D["kind"][], profileGenre:string){
  const out:EntitySpec2D[]=[];
  for(const kind of genre){
    if(kind==="player")out.push(mk("player","player","Hero",150,430,{animated:true}));
    else if(kind==="npc")out.push(mk("npc-main","npc",profileGenre==="farming"?"Farmer":"Guide",430,220,{dialogue:true}));
    else if(kind==="creature")out.push(mk("creature-main","creature","Wild Creature",610,310,{battle:true,capture:true}));
    else if(kind==="enemy")out.push(mk("enemy-main","enemy",profileGenre==="survival"?"Night Threat":"Enemy",650,310,{combat:true}));
    else if(kind==="item")out.push(mk("item-main","item",profileGenre==="farming"?"Crop":"Relic",560,430,{collect:true}));
    else if(kind==="obstacle")out.push(mk("obstacle-main","obstacle","Obstacle",460,430,{collision:true}));
    else if(kind==="goal")out.push(mk("goal-main","goal",profileGenre==="racing"?"Finish":"Goal",900,180,{win:true}));
  }
  return out;
}

function sceneIds(genre:string,count:number){
  const special:Record<string,string[]>={
    monster_tamer:["village","route","forest","battle"],
    farming:["homestead","market"],
    adventure:["ruins"],
    rpg:["town","battle"],
    platformer:["level-1"],
    racing:["circuit"],
    puzzle:["grid-room"],
    shooter:["arena"],
    strategy:["command-map"],
    simulation:["settlement"],
    survival:["night-camp"],
  };
  return special[genre]?.slice(0,Math.max(1,count))||Array.from({length:Math.max(1,count)},(_,i)=>"scene-"+(i+1));
}

export function compile2DSpec(b:GameBlueprint,prompt:string):GameSpecification2D|null{
  const profile=resolve2DGenre(prompt)||resolve2DGenre(b);
  if(!profile)return null;
  const seed=h(prompt||b.concept);
  const entities=requiredEntities(profile.requiredEntityKinds,profile.genre);
  const ids=sceneIds(profile.genre,Math.max(profile.minimumScenes,profile.genre==="monster_tamer"?4:profile.minimumScenes));
  const scenes=ids.map((id,i)=>{
    const sceneEntities=entities.map(e=>({...e,x:e.x+(i*37)%180,y:e.y+(i*53)%120}));
    if(profile.genre==="monster_tamer"){
      if(id==="village")return{id,name:"village",width:1200,height:800,background:"village",entities:sceneEntities.filter(e=>["player","npc"].includes(e.kind))};
      if(id==="route")return{id,name:"route",width:1200,height:800,background:"route",entities:sceneEntities.filter(e=>["player","creature","item"].includes(e.kind))};
      if(id==="forest")return{id,name:"forest",width:1200,height:800,background:"forest",entities:sceneEntities.filter(e=>["player","npc","item"].includes(e.kind))};
      return{id,name:"battle",width:960,height:640,background:"battle",entities:sceneEntities.filter(e=>["player","creature"].includes(e.kind))};
    }
    return{id,name:id,width:1200,height:800,background:profile.visualDefaults.paletteMood,entities:sceneEntities};
  });
  return{version:"2d-engine-v2",title:b.title,genre:profile.genre,camera:profile.camera,objective:b.objective,winCondition:b.winCondition,loseCondition:b.loseCondition,systems:profile.requiredSystems,controls:{keyboard:["W","A","S","D","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","Enter"],touch:["up","down","left","right","action"]},visual:profile.visualDefaults,scenes,assets:[{id:"player-sprite",kind:"sprite",source:"embedded",frames:4},{id:"world-tiles",kind:"tileset",source:"embedded"},{id:"entity-sprites",kind:"sprite",source:"generated"}],metadata:{sourcePrompt:prompt,deterministicSeed:seed,engine:"james-2d",runtimeId:profile.genre+"-v1"}};
}

export function validate2DSpec(spec:GameSpecification2D){
  const errors:string[]=[];
  const p=getGenreProfile(spec.genre);
  if(!spec.scenes.length)errors.push("2D specification has no scenes.");
  if(p){
    for(const s of p.requiredSystems)if(!spec.systems.includes(s))errors.push("Missing required system: "+s);
    for(const k of p.requiredEntityKinds)if(!spec.scenes.some(x=>x.entities.some(e=>e.kind===k)))errors.push("Missing required entity kind: "+k);
    if(spec.scenes.length<p.minimumScenes)errors.push("Genre requires at least "+p.minimumScenes+" scenes.");
  }
  return errors;
}
