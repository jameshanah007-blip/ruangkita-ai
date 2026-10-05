import type { GameBlueprint } from "../laboratory/types";
import type { AssetMaterializationResult } from "./assetMaterializer";
import { mechanicKnowledge, worldKnowledge } from "./jamesGameKnowledge";

/**
 * James Autonomous Game Engine
 *
 * This module is intentionally provider-free.
 * It turns a natural-language game request into a deterministic
 * "game genome", then compiles that genome into a standalone
 * playable HTML5 Canvas game.
 *
 * It is not a fixed game catalog: the genome is synthesized from
 * the complete request/blueprint, and the runtime combines world,
 * actor, mechanic, level, palette, objectives and rules from that genome.
 */

type GenomeMechanic =
  | "explore"
  | "collect"
  | "combat"
  | "survival"
  | "stealth"
  | "racing"
  | "puzzle"
  | "rescue"
  | "farming"
  | "shooting"
  | "escort"
  | "dialogue";

type WorldKind =
  | "hospital"
  | "forest"
  | "ocean"
  | "space"
  | "city"
  | "castle"
  | "laboratory"
  | "desert"
  | "village"
  | "island"
  | "unknown";

type GameGenome = {
  seed: number;
  title: string;
  concept: string;
  world: WorldKind;
  mechanics: GenomeMechanic[];
  primary: GenomeMechanic;
  difficulty: number;
  palette: [string, string, string, string, string];
  player: {
    kind: "hero" | "robot" | "vehicle" | "ship" | "diver" | "animal" | "unknown";
    label: string;
    speed: number;
    health: number;
    attack: number;
  };
  enemy: {
    label: string;
    speed: number;
    health: number;
    count: number;
  };
  item: {
    label: string;
    count: number;
  };
  level: {
    width: number;
    height: number;
    rooms: number;
    obstacles: number;
  };
  objective: string;
  winCondition: string;
  loseCondition: string;
  visualStyle: string;
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clean(text: string, max = 900): string {
  return text.trim().replace(/\s+/g, " ").slice(0, max);
}

function words(text: string): string {
  return text.toLowerCase();
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(words(text));
}

function detectWorld(text: string): WorldKind {
  const p = words(text);
  if (/(hospital|rumah sakit|clinic|ward|koridor)/.test(p)) return "hospital";
  if (/(forest|hutan|woods|jungle|rimba)/.test(p)) return "forest";
  if (/(ocean|laut|sea|kapal|island|pulau|pantai)/.test(p)) return p.includes("island") || p.includes("pulau") ? "island" : "ocean";
  if (/(space|luar angkasa|planet|asteroid|galaxy|orbital)/.test(p)) return "space";
  if (/(city|kota|urban|jalan|metro|sekolah)/.test(p)) return "city";
  if (/(castle|kastil|istana|kingdom|kerajaan|dungeon)/.test(p)) return "castle";
  if (/(laboratory|lab|laboratorium|research|facility)/.test(p)) return "laboratory";
  if (/(desert|gurun|sand|pasir)/.test(p)) return "desert";
  if (/(village|desa|kampung|farm|farming|kebun)/.test(p)) return "village";
  return "unknown";
}

function detectMechanics(text: string): GenomeMechanic[] {
  const p = words(text);
  const found: GenomeMechanic[] = [];
  const add = (name: GenomeMechanic, re: RegExp) => {
    if (re.test(p) && !found.includes(name)) found.push(name);
  };

  add("racing", /(racing|race|balap|mobil|kendaraan|kejar-kejaran)/);
  add("shooting", /(shooter|shooting|menembak|tembak|laser|pistol|senjata jarak jauh)/);
  add("combat", /(combat|fight|battle|bertarung|perang|musuh|monster|boss)/);
  add("survival", /(survival|bertahan|horror|horor|zombie|gelombang|malam)/);
  add("stealth", /(stealth|siluman|infiltrat|menyelinap|diam-diam|patroli)/);
  add("rescue", /(rescue|selamatkan|penyelamatan|korban|evakuasi|tolong)/);
  add("escort", /(escort|kawal|antar|mengawal)/);
  add("farming", /(farm|farming|bertani|tanam|panen|kebun|ternak)/);
  add("puzzle", /(puzzle|teka-teki|teka teki|logic|logika|kode|pattern|labirin)/);
  add("dialogue", /(dialog|dialogue|cerita|story|npc|percakapan|social)/);
  add("collect", /(collect|collection|kumpulkan|mengumpulkan|item|loot|harta|resource|sumber daya)/);
  add("explore", /(explore|exploration|jelajah|menjelajah|petualangan|dunia|map|peta)/);

  if (!found.length) found.push("explore");
  return found.slice(0, 6);
}

function detectPlayer(text: string): GameGenome["player"]["kind"] {
  const p = words(text);
  if (/(mobil|car|vehicle|kendaraan|balap)/.test(p)) return "vehicle";
  if (/(kapal|spaceship|pesawat luar angkasa|starship)/.test(p)) return "ship";
  if (/(penyelam|diver|laut dalam|underwater)/.test(p)) return "diver";
  if (/(robot|drone|android)/.test(p)) return "robot";
  if (/(anjing|kucing|serigala|hewan|animal)/.test(p)) return "animal";
  return "hero";
}

function detectEnemy(text: string, world: WorldKind): string {
  const p = words(text);
  if (p.includes("zombie")) return "zombie";
  if (p.includes("monster")) return "monster";
  if (p.includes("robot")) return "security drone";
  if (p.includes("alien")) return "alien";
  if (p.includes("pirate") || p.includes("bajak laut")) return "pirate";
  if (world === "hospital") return "shadow";
  if (world === "forest") return "wild creature";
  if (world === "space") return "space drone";
  if (world === "ocean") return "sea creature";
  if (world === "castle") return "guardian";
  return "hostile";
}

function detectItem(text: string, world: WorldKind): string {
  const p = words(text);
  if (p.includes("kunci") || p.includes("key")) return "key";
  if (p.includes("korban") || p.includes("survivor")) return "survivor";
  if (p.includes("obat") || p.includes("medicine")) return "medicine";
  if (p.includes("harta") || p.includes("treasure")) return "treasure";
  if (p.includes("resource") || p.includes("sumber daya")) return "resource";
  if (world === "space") return "energy core";
  if (world === "ocean") return "supply crate";
  if (world === "forest") return "ancient seed";
  return "artifact";
}

function paletteFor(world: WorldKind, seed: number): GameGenome["palette"] {
  const palettes: Record<WorldKind, GameGenome["palette"][]> = {
    hospital: [["#080b14","#182033","#6b7280","#ef4444","#e5e7eb"]],
    forest: [["#06140d","#123524","#22c55e","#a3e635","#fef3c7"]],
    ocean: [["#031522","#063b5c","#06b6d4","#38bdf8","#e0f2fe"]],
    space: [["#03020b","#15102e","#8b5cf6","#22d3ee","#f8fafc"]],
    city: [["#08090d","#20232c","#f59e0b","#38bdf8","#f1f5f9"]],
    castle: [["#0b0811","#2b1837","#a855f7","#f59e0b","#fef3c7"]],
    laboratory: [["#061014","#102a32","#14b8a6","#22d3ee","#ecfeff"]],
    desert: [["#1a0e05","#4a2811","#f59e0b","#fbbf24","#fff7ed"]],
    village: [["#08140a","#1d3a22","#84cc16","#f59e0b","#fefce8"]],
    island: [["#041316","#0b3b3d","#14b8a6","#facc15","#ecfeff"]],
    unknown: [["#07111f","#182b45","#22d3ee","#f472b6","#f8fafc"]],
  };
  const options = palettes[world];
  return options[Math.abs(seed) % options.length];
}

export function createAutonomousGameBlueprint(prompt: string): GameBlueprint {
  const request = clean(prompt, 1200);
  const world = detectWorld(request);
  const mechanics = detectMechanics(request);
  const primary = mechanics[0];
  const difficulty = has(request, /(sangat sulit|extreme|brutal|hardcore)/)
    ? 0.95
    : has(request, /(sulit|hard|menantang|tegang)/)
      ? 0.78
      : has(request, /(mudah|easy|santai)/)
        ? 0.35
        : 0.58;
  const seed = hash(request + "|" + mechanics.join(",") + "|" + world);
  const playerKind = detectPlayer(request);
  const playerLabel =
    playerKind === "vehicle" ? "vehicle" :
    playerKind === "ship" ? "ship" :
    playerKind === "diver" ? "diver" :
    playerKind === "robot" ? "robot" :
    playerKind === "animal" ? "animal" : "player";

  const objective =
    clean(request.match(/(?:tujuannya|objective|targetnya|harus)\s+(.+)/i)?.[1] || "", 240) ||
    clean(request, 240);

  const worldLabel: Record<WorldKind,string> = {
    hospital:"old hospital",
    forest:"living forest",
    ocean:"stormy ocean",
    space:"deep space",
    city:"night city",
    castle:"forgotten kingdom",
    laboratory:"experimental facility",
    desert:"dangerous desert",
    village:"frontier village",
    island:"isolated island",
    unknown:"an original world",
  };

  const genre =
    mechanics.length > 1
      ? mechanics.slice(0, 3).join(" ")
      : primary;

  const inferredActions = new Set<string>(["move", "restart"]);
  mechanics.forEach((m) => {
    if (m === "combat" || m === "shooting") inferredActions.add("attack");
    if (m === "collect" || m === "rescue") inferredActions.add("interact");
    if (m === "racing") inferredActions.add("accelerate");
    if (m === "stealth") inferredActions.add("hide");
    if (m === "puzzle") inferredActions.add("solve");
    if (m === "farming") inferredActions.add("work");
    if (m === "dialogue") inferredActions.add("talk");
    if (m === "explore") inferredActions.add("explore");
  });

  return {
    title: clean(request.split(/[.!?]/)[0] || "James Autonomous Game", 70),
    concept: request,
    genre,
    mood: has(request, /(horror|horor|tegang|gelap)/) ? "tense" : "dynamic",
    difficulty: difficulty >= 0.85 ? "extreme" : difficulty >= 0.68 ? "hard" : difficulty <= 0.42 ? "easy" : "medium",
    theme: worldLabel[world],
    world: worldLabel[world],
    coreLoop: mechanics.join(" → "),
    objective,
    mechanics,
    playerActions: [...inferredActions],
    controls: ["WASD", "Arrow keys", "Space", "Pointer", "Touch"],
    progression: "The world adapts through procedural encounters, resources and objective progress.",
    replayability: "A new deterministic seed is derived from the complete request, while actions create different outcomes.",
    winCondition: clean(
      primary === "racing" ? "Reach the finish." :
      primary === "survival" ? "Survive the generated threat cycle." :
      primary === "rescue" ? "Reach and secure the required survivors." :
      primary === "collect" ? "Collect the required objective items." :
      primary === "puzzle" ? "Solve the generated sequence." :
      primary === "combat" || primary === "shooting" ? "Defeat the active threats." :
      "Complete the generated objective.",
      220
    ),
    loseCondition: "Health reaches zero or the critical objective is lost.",
    visualStyle: "asset-backed 2D game world with animated character and creature visuals",
    mobileNotes: ["Touch-first controls", "Responsive Canvas", "Portrait-friendly UI", "Standalone offline HTML"],
    testRequirements: ["canvas renders", "game loop advances", "input changes state", "objective changes", "win/lose reachable", "restart resets state"],
  };
}

function buildGenome(b: GameBlueprint): GameGenome {
  const text = [
    b.title, b.concept, b.genre, b.mood, b.theme, b.world,
    b.coreLoop, b.objective, ...b.mechanics, ...b.playerActions,
  ].join(" ");
  const seed = hash(text);
  const random = rng(seed);
  const world = detectWorld(text);
  const detectedMechanics = detectMechanics(text);
  const masteryText = [
    b.progression,
    b.testRequirements.join(" "),
    b.playerActions.join(" "),
  ].join(" ").toLowerCase();

  // Capability mastery is allowed to influence implementation strategy,
  // while the original user-requested mechanics remain authoritative.
  const mechanics = [...detectedMechanics];
  if (/objective-progression|objective progression|progression/.test(masteryText) && !mechanics.includes("collect")) {
    mechanics.push("collect");
  }
  if (/gameplay-state|gameplay state/.test(masteryText) && !mechanics.includes("explore")) {
    mechanics.push("explore");
  }
  if (/input-reliability|input reliability/.test(masteryText) && !mechanics.includes("explore")) {
    mechanics.push("explore");
  }
  const primary = mechanics[0] || "explore";
  const difficulty =
    b.difficulty.toLowerCase().includes("extreme") ? 0.95 :
    b.difficulty.toLowerCase().includes("hard") ? 0.78 :
    b.difficulty.toLowerCase().includes("easy") ? 0.35 : 0.58;
  const playerKind = detectPlayer(text);
  const count = Math.max(3, Math.min(10, 3 + Math.floor(random() * (3 + difficulty * 5))));
  const obstacleCount = Math.max(7, Math.min(24, 8 + Math.floor(random() * 16)));

  return {
    seed,
    title: clean(b.title, 70),
    concept: clean(b.concept, 1000),
    world,
    mechanics,
    primary,
    difficulty,
    palette: paletteFor(world, seed),
    player: {
      kind: playerKind,
      label: playerKind === "vehicle" ? "Vehicle" : playerKind === "ship" ? "Ship" : playerKind === "diver" ? "Diver" : playerKind === "robot" ? "Robot" : "Hero",
      speed: 150 + Math.round(random() * 80),
      health: Math.round(80 + (1 - difficulty) * 70),
      attack: Math.round(12 + random() * 14),
    },
    enemy: {
      label: detectEnemy(text, world),
      speed: 24 + Math.round(random() * 35 + difficulty * 30),
      health: Math.round(30 + random() * 35 + difficulty * 45),
      count,
    },
    item: {
      label: detectItem(text, world),
      count: Math.max(3, Math.min(9, 3 + Math.floor(random() * 6))),
    },
    level: {
      width: 1200,
      height: 1800,
      rooms: 3 + Math.floor(random() * 5),
      obstacles: obstacleCount,
    },
    objective: clean(b.objective, 240),
    winCondition: clean(b.winCondition, 220),
    loseCondition: clean(b.loseCondition, 220),
    visualStyle: clean(b.visualStyle + " · " + worldKnowledge(world).landmark + " · " + mechanics.map((m) => mechanicKnowledge(m).action).join(" · "), 180),
  };
}

function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function runtimeAssets(materializedAssets?: AssetMaterializationResult) {
  return (materializedAssets?.assets || [])
    .filter((asset) => asset.status === "ready" && asset.uri.startsWith("data:image/"))
    .map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      uri: asset.uri,
      chromaKey:
        typeof asset.metadata.providerMetadata?.chromaKey === "string"
          ? asset.metadata.providerMetadata.chromaKey
          : null,
      characterDNA: asset.metadata.providerMetadata?.characterDNA ?? null,
    }));
}

export function buildAutonomousGameHtml(
  blueprint: GameBlueprint,
  materializedAssets?: AssetMaterializationResult,
): string {
  const g = buildGenome(blueprint);
  const [bg, panel, accent, danger, light] = g.palette;

  const config = js({ ...g, assets: runtimeAssets(materializedAssets) });
  const runtimeWorldKnowledge = js(worldKnowledge(g.world));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${g.title}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${bg};color:${light};font-family:system-ui,sans-serif}
body{display:flex;justify-content:center}#root{position:relative;width:min(100vw,820px);height:100dvh;min-height:520px;overflow:hidden;background:${bg}}
canvas{display:block;width:100%;height:100%;touch-action:none}
#hud{position:absolute;inset:10px 10px auto;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.panel{max-width:58%;background:${panel}e8;border:1px solid ${light}22;border-radius:14px;padding:8px 11px;font-size:11px;line-height:1.35;backdrop-filter:blur(5px)}
#objective{position:absolute;left:50%;top:66px;transform:translateX(-50%);max-width:82%;padding:6px 10px;border-radius:999px;background:${panel}cc;border:1px solid ${accent}55;font-size:10px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#controls{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:space-between;padding:0 13px;pointer-events:none}
.pad,.actions{display:flex;gap:8px;pointer-events:auto}
button{width:54px;height:54px;border-radius:16px;border:1px solid ${light}30;background:${panel}ee;color:${light};font-size:18px;font-weight:900;touch-action:none}
button:active{transform:scale(.96);background:${accent}66}
#message{display:none;position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:min(86%,360px);padding:22px;border-radius:22px;background:${bg}f2;border:1px solid ${accent}66;text-align:center;box-shadow:0 20px 80px #000b}
#message h2{margin:0 0 8px;font-size:22px}#message p{margin:0;color:${light}aa;font-size:12px;line-height:1.6}
#restart{margin-top:14px;width:auto;height:auto;padding:10px 18px;background:${accent};color:${bg};border:0}
</style>
</head>
<body>
<div id="root">
<canvas id="gameCanvas"></canvas>
<div id="hud"><div class="panel"><b id="title"></b><br><span id="stats"></span></div><div class="panel" id="mode"></div></div>
<div id="objective"></div>
<div id="controls"><div class="pad">
<button data-a="left">◀</button><button data-a="up">▲</button><button data-a="down">▼</button><button data-a="right">▶</button>
</div><div class="actions"><button data-a="action">●</button></div></div>
<div id="message"><h2 id="messageTitle"></h2><p id="messageBody"></p><button id="restart">PLAY AGAIN</button></div>
</div>
<script>
(function(){
"use strict";
var G=${config};
var RUNTIME_WORLD_KNOWLEDGE=${runtimeWorldKnowledge};
var canvas=document.getElementById("gameCanvas"),ctx=canvas.getContext("2d");
var root=document.getElementById("root");
var titleEl=document.getElementById("title"),statsEl=document.getElementById("stats"),modeEl=document.getElementById("mode"),objectiveEl=document.getElementById("objective");
var msg=document.getElementById("message"),msgTitle=document.getElementById("messageTitle"),msgBody=document.getElementById("messageBody");
var W=720,H=900,dpr=1,last=0,elapsed=0;
var assetImages={};
var input={left:false,right:false,up:false,down:false,action:false};
var state;
var characterRuntime={pose:"idle",poseUntil:0,identityKey:null};
window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;

function seeded(n){var x=Math.sin(G.seed+n*12.9898)*43758.5453;return x-Math.floor(x)}
function resize(){var r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=Math.max(320,r.width);H=Math.max(520,r.height);canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function makeWorld(){
  var obstacles=[],items=[],enemies=[];
  for(var i=0;i<G.level.obstacles;i++){obstacles.push({x:60+seeded(i)*G.level.width,y:110+seeded(i+40)*(G.level.height-220),w:35+seeded(i+80)*95,h:18+seeded(i+90)*65})}
  for(var j=0;j<G.item.count;j++){items.push({x:90+seeded(j+150)*(G.level.width-180),y:140+seeded(j+170)*(G.level.height-280),taken:false,pulse:seeded(j+190)*6.28})}
  for(var k=0;k<G.enemy.count;k++){enemies.push({x:120+seeded(k+240)*(G.level.width-240),y:180+seeded(k+260)*(G.level.height-360),health:G.enemy.health,alive:true,phase:seeded(k+280)*6.28})}
  return {obstacles:obstacles,items:items,enemies:enemies};
}
function loadAssets(){
  (G.assets||[]).forEach(function(asset){
    if(!asset.uri||assetImages[asset.id])return;
    var img=new Image();
    img.onload=function(){
      if(!asset.chromaKey){
        assetImages[asset.id]=img;
        return;
      }
      var off=document.createElement("canvas");
      off.width=img.naturalWidth||img.width;
      off.height=img.naturalHeight||img.height;
      var ox=off.getContext("2d");
      if(!ox){
        assetImages[asset.id]=img;
        return;
      }
      ox.drawImage(img,0,0);
      var imageData=ox.getImageData(0,0,off.width,off.height);
      var data=imageData.data;
      for(var i=0;i<data.length;i+=4){
        var r=data[i],g=data[i+1],b=data[i+2];
        if(r>220&&b>220&&g<70)data[i+3]=0;
      }
      ox.putImageData(imageData,0,0);
      assetImages[asset.id]=off;
    };
    img.src=asset.uri;
  });
}
function assetImage(kind,index){
  var list=(G.assets||[]).filter(function(asset){return asset.kind===kind;});
  return list[index||0]&&assetImages[list[index||0].id];
}
function drawAsset(img,x,y,size){
  if(!img||!img.width||!img.height)return false;
  ctx.drawImage(img,x-size/2,y-size/2,size,size);
  return true;
}
function drawCharacterAsset(asset,x,y,size){
  var img=assetImages[asset.id];
  if(!img||!img.width||!img.height)return false;
  var pose=characterRuntime.pose;
  var dna=asset.characterDNA||{};
  var frameCount=pose==="idle"||pose==="talk"?2:4;
  var frame=Math.floor(elapsed/120)%frameCount;
  var phase=frameCount<=1?0:frame/(frameCount-1);
  var wave=Math.sin(phase*Math.PI*2);
  var dx=pose==="move"?wave*3:0;
  var dy=pose==="idle"?Math.abs(wave)*-2:pose==="hit"?2:0;
  var rotation=pose==="action"?wave*.08:pose==="hit"?-.05:0;
  var scaleX=pose==="move"?1+wave*.025:1;
  var scaleY=pose==="idle"?1+Math.abs(wave)*.018:1;
  if(dna.identityKey)characterRuntime.identityKey=dna.identityKey;
  ctx.save();
  ctx.translate(x+dx,y+dy);
  ctx.rotate(rotation);
  ctx.scale(scaleX,scaleY);
  ctx.drawImage(img,-size/2,-size/2,size,size);
  ctx.restore();
  return true;
}
function reset(){
  state={status:"playing",x:G.level.width/2,y:G.level.height-180,health:G.player.health,score:0,progress:0,time:0,energy:100,world:makeWorld(),level:1};
  elapsed=0;characterRuntime.pose="idle";characterRuntime.poseUntil=0;characterRuntime.identityKey=null;msg.style.display="none";updateHud();
}
function characterAsset(){
  var list=(G.assets||[]).filter(function(asset){return asset.kind==="character"||asset.kind==="companion"||asset.kind==="npc"||asset.kind==="enemy";});
  return list[0]||null;
}
function setCharacterPose(pose,duration){
  var asset=characterAsset();
  if(!asset||!asset.characterDNA)return;
  characterRuntime.pose=pose;
  characterRuntime.poseUntil=elapsed+(duration||180);
  characterRuntime.identityKey=asset.characterDNA.identityKey||null;
}
function updateCharacterPose(){
  var moving=input.left||input.right||input.up||input.down;
  if(elapsed<characterRuntime.poseUntil)return;
  if(input.action&&(G.mechanics.indexOf("combat")>=0||G.mechanics.indexOf("shooting")>=0)){setCharacterPose("action",220);return;}
  if(moving){setCharacterPose("move",160);return;}
  if(G.mechanics.indexOf("dialogue")>=0&&input.action){setCharacterPose("talk",300);return;}
  setCharacterPose("idle",180);
}
function setInput(a,v){if(a in input)input[a]=v}
document.querySelectorAll("[data-a]").forEach(function(b){var a=b.dataset.a;["pointerdown","pointerup","pointercancel","pointerleave"].forEach(function(t){b.addEventListener(t,function(e){e.preventDefault();setInput(a,t==="pointerdown")})})});
var keyMap={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",w:"up",a:"left",s:"down",d:"right"," ":"action",Enter:"action"};
addEventListener("keydown",function(e){var a=keyMap[e.key];if(a){e.preventDefault();setInput(a,true)}});
addEventListener("keyup",function(e){var a=keyMap[e.key];if(a)setInput(a,false)});
document.getElementById("restart").onclick=reset;

function movement(dt){
  var dx=(input.right?1:0)-(input.left?1:0),dy=(input.down?1:0)-(input.up?1:0);
  var len=Math.hypot(dx,dy)||1;
  state.x=clamp(state.x+dx/len*G.player.speed*dt,24,G.level.width-24);
  state.y=clamp(state.y+dy/len*G.player.speed*dt,90,G.level.height-24);
}
function primaryAction(){
  return input.action;
}
function objectiveProgress(){
  var collected=state.world.items.filter(function(i){return i.taken}).length;
  var defeated=state.world.enemies.filter(function(e){return !e.alive}).length;
  if(G.mechanics.indexOf("racing")>=0)return Math.min(1,state.time/45);
  if(G.mechanics.indexOf("survival")>=0)return Math.min(1,state.time/50);
  if(G.mechanics.indexOf("escort")>=0)return Math.min(1,state.time/40);
  if(G.mechanics.indexOf("dialogue")>=0)return Math.min(1,state.time/35);
  if(G.mechanics.indexOf("farming")>=0)return Math.min(1,state.progress/Math.max(1,G.item.count));
  if(G.mechanics.indexOf("puzzle")>=0)return Math.min(1,state.progress);
  if(G.mechanics.indexOf("rescue")>=0)return Math.min(1,collected/Math.max(1,G.item.count));
  if(G.mechanics.indexOf("combat")>=0||G.mechanics.indexOf("shooting")>=0)return Math.min(1,defeated/Math.max(1,G.enemy.count));
  return Math.min(1,collected/Math.max(1,G.item.count));
}
function attack(){
  setCharacterPose("action",220);
  var nearest=null,best=9999;
  state.world.enemies.forEach(function(e){if(!e.alive)return;var d=dist({x:state.x,y:state.y},e);if(d<best){best=d;nearest=e}});
  if(nearest&&best<120){nearest.health-=G.player.attack;if(nearest.health<=0){nearest.alive=false;state.score+=25;state.progress+=1}}
}
function update(dt){
  if(state.status!=="playing")return;
  state.time+=dt;
  elapsed+=dt*1000;
  updateCharacterPose();
  movement(dt);

  state.world.items.forEach(function(item){
    if(!item.taken&&dist({x:state.x,y:state.y},item)<34){
      if(G.mechanics.indexOf("collect")>=0||G.mechanics.indexOf("rescue")>=0||G.mechanics.indexOf("explore")>=0){
        item.taken=true;state.score+=10;state.progress+=1;
      }
    }
  });

  if(primaryAction()&&(G.mechanics.indexOf("combat")>=0||G.mechanics.indexOf("shooting")>=0))attack();

  state.world.enemies.forEach(function(e){
    if(!e.alive)return;
    var dx=state.x-e.x,dy=state.y-e.y,d=Math.hypot(dx,dy)||1;
    var aggressive=G.mechanics.indexOf("stealth")<0;
    if(aggressive){e.x+=dx/d*G.enemy.speed*dt;e.y+=dy/d*G.enemy.speed*dt}
    else{e.x+=Math.sin(state.time+e.phase)*G.enemy.speed*.25*dt}
    if(d<32&&aggressive){
      var before=state.health;
      state.health-=((8+G.difficulty*16)*dt);
      if(state.health<before)setCharacterPose("hit",220);
    }
  });

  if(G.mechanics.indexOf("survival")>=0&&state.time>50)state.progress=G.item.count;
  if(G.mechanics.indexOf("racing")>=0)state.progress=Math.floor(state.time/45*100);
  if(G.mechanics.indexOf("farming")>=0&&primaryAction()){state.energy=Math.max(0,state.energy-4*dt);state.progress=Math.min(G.item.count,state.progress+dt*.35)}
  if(G.mechanics.indexOf("puzzle")>=0&&primaryAction()){state.score+=dt*4;state.progress=Math.min(1,state.progress+dt*.06)}
  if(G.mechanics.indexOf("escort")>=0){state.progress=Math.min(1,state.time/40)}
  if(G.mechanics.indexOf("dialogue")>=0&&primaryAction()){state.score+=dt*2}

  var p=objectiveProgress();
  if(p>=.999 || (G.mechanics.indexOf("survival")>=0&&state.time>=50))finish(true);
  if(state.health<=0)finish(false);
  updateHud();
}
function finish(win){
  if(state.status!=="playing")return;
  state.status=win?"won":"lost";
  msgTitle.textContent=win?"OBJECTIVE COMPLETE":"RUN ENDED";
  msgBody.textContent=win?G.winCondition:G.loseCondition;
  msg.style.display="block";
}
function worldColors(){return {bg:G.palette[0],panel:G.palette[1],accent:G.palette[2],danger:G.palette[3],light:G.palette[4]}}
function drawBackground(){
  var c=worldColors();
  ctx.fillStyle=c.bg;ctx.fillRect(0,0,W,H);
  var grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,c.panel);grad.addColorStop(1,c.bg);ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  var camX=clamp(state.x-W/2,0,G.level.width-W),camY=clamp(state.y-H/2,0,G.level.height-H);
  ctx.save();ctx.translate(-camX,-camY);
  drawWorldDecor(c);
  state.world.obstacles.forEach(function(o){ctx.fillStyle=c.panel;ctx.globalAlpha=.9;ctx.fillRect(o.x,o.y,o.w,o.h);ctx.globalAlpha=1;ctx.strokeStyle=c.accent+"55";ctx.strokeRect(o.x,o.y,o.w,o.h)});
  state.world.items.forEach(function(item,i){if(item.taken)return;var pulse=Math.sin(state.time*3+item.pulse)*2;drawItem(item.x,item.y+pulse,c.accent,i)});
  state.world.enemies.forEach(function(e){if(e.alive)drawEnemy(e.x,e.y,c.danger)});
  drawPlayer(state.x,state.y,c.light,c.accent);
  ctx.restore();
}
function drawWorldDecor(c){
  var knowledge=RUNTIME_WORLD_KNOWLEDGE, step=90;
  ctx.strokeStyle=c.light+"10";ctx.lineWidth=1;
  for(var x=0;x<G.level.width;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,G.level.height);ctx.stroke()}
  for(var y=0;y<G.level.height;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(G.level.width,y);ctx.stroke()}
  ctx.fillStyle=c.light+"88";ctx.font="bold 14px system-ui";ctx.fillText(knowledge.world.toUpperCase()+" // JAMES AUTONOMOUS WORLD",30,35);
  for(var i=0;i<G.level.rooms;i++){
    var rx=120+seeded(i+500)*(G.level.width-240),ry=160+seeded(i+530)*(G.level.height-320);
    ctx.save();ctx.translate(rx,ry);ctx.globalAlpha=.45;ctx.strokeStyle=knowledge.accent;
    if(G.world==="hospital"){ctx.strokeRect(-42,-28,84,56);ctx.fillStyle=knowledge.accent;ctx.fillRect(-5,-22,10,44)}
    else if(G.world==="forest"){ctx.beginPath();ctx.moveTo(0,-45);ctx.lineTo(25,20);ctx.lineTo(-25,20);ctx.closePath();ctx.stroke();ctx.fillStyle=knowledge.accent;ctx.beginPath();ctx.arc(0,-28,28,0,Math.PI*2);ctx.fill()}
    else if(G.world==="ocean"||G.world==="island"){ctx.beginPath();for(var wv=-45;wv<=45;wv+=10){ctx.lineTo(wv,Math.sin(wv*.16)*10)}ctx.stroke()}
    else if(G.world==="space"){ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(0,0,50,13,.3,0,Math.PI*2);ctx.stroke()}
    else if(G.world==="castle"){ctx.fillRect(-25,-30,50,60);ctx.strokeRect(-25,-30,50,60)}
    else if(G.world==="laboratory"){ctx.strokeRect(-34,-34,68,68);ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke()}
    else if(G.world==="desert"){ctx.beginPath();ctx.arc(0,20,48,Math.PI,Math.PI*2);ctx.stroke()}
    else if(G.world==="village"){ctx.beginPath();ctx.moveTo(-35,15);ctx.lineTo(0,-25);ctx.lineTo(35,15);ctx.stroke();ctx.strokeRect(-25,15,50,35)}
    else{ctx.strokeRect(-30,-30,60,60)}
    ctx.restore();
  }
}
function drawItem(x,y,c,i){
  var k=RUNTIME_WORLD_KNOWLEDGE;
  ctx.save();ctx.translate(x,y);ctx.rotate((i%4)*.2+state.time*.2);ctx.fillStyle=c;
  if(G.world==="hospital"){ctx.fillRect(-12,-8,24,16);ctx.fillStyle="#fff";ctx.fillRect(-3,-8,6,16);ctx.fillRect(-12,-3,24,6)}
  else if(G.world==="forest"){ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#14532d";ctx.fillRect(-2,-15,4,8)}
  else if(G.world==="ocean"||G.world==="island"){ctx.fillRect(-15,-8,30,16);ctx.strokeStyle="#fff";ctx.strokeRect(-15,-8,30,16)}
  else if(G.world==="space"){ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke()}
  else if(G.world==="desert"){ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(12,10);ctx.lineTo(-12,10);ctx.closePath();ctx.fill()}
  else{ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(11,0);ctx.lineTo(0,13);ctx.lineTo(-11,0);ctx.closePath();ctx.fill()}
  ctx.globalAlpha=.45;ctx.strokeStyle=k.accent;ctx.stroke();ctx.restore();
}
function drawEnemy(x,y,c){
  var generated=assetImage("enemy",0);
  if(generated){
    drawAsset(generated,x,y,58);
  }
}
function drawPlayer(x,y,c,a){
  var generatedAsset=(G.assets||[]).filter(function(asset){return asset.kind==="character";})[0];
  if(G.player.kind==="hero" && generatedAsset && drawCharacterAsset(generatedAsset,x,y,72))return;
  ctx.save();ctx.translate(x,y);ctx.fillStyle=c;
  if(G.player.kind==="vehicle"){ctx.fillRect(-22,-11,44,22);ctx.fillStyle=a;ctx.fillRect(-9,-8,18,8);ctx.fillStyle="#111";ctx.beginPath();ctx.arc(-14,11,5,0,Math.PI*2);ctx.arc(14,11,5,0,Math.PI*2);ctx.fill()}
  else if(G.player.kind==="ship"){ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(20,18);ctx.lineTo(0,10);ctx.lineTo(-20,18);ctx.closePath();ctx.fill();ctx.fillStyle=a;ctx.fillRect(-4,-3,8,10)}
  else if(G.player.kind==="diver"){ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();ctx.fillStyle=a;ctx.fillRect(8,-5,18,5);ctx.strokeStyle=a;ctx.strokeRect(-17,-8,12,16)}
  else if(G.player.kind==="robot"){ctx.fillRect(-15,-15,30,30);ctx.fillStyle=a;ctx.fillRect(-8,-5,5,5);ctx.fillRect(3,-5,5,5)}
  else if(G.player.kind==="animal"){ctx.beginPath();ctx.ellipse(0,2,17,11,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=a;ctx.beginPath();ctx.moveTo(-12,-7);ctx.lineTo(-17,-18);ctx.lineTo(-5,-10);ctx.fill()}
  else{ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();ctx.fillStyle=a;ctx.fillRect(-7,-3,14,6)}
  ctx.restore();
}
function drawPlayer(x,y,c,a){
  var generatedAsset=(G.assets||[]).filter(function(asset){
    return asset.kind==="character"||asset.kind==="companion";
  })[0];
  if(generatedAsset){
    drawCharacterAsset(generatedAsset,x,y,72);
  }
}
function draw(){
  drawBackground();window.__RK_GAME_RENDERED__=true;
}
function updateHud(){
  titleEl.textContent=G.title;
  modeEl.textContent=G.mechanics.join(" + ").toUpperCase();
  var p=Math.round(objectiveProgress()*100);
  statsEl.textContent="HP "+Math.max(0,Math.ceil(state.health))+" · SCORE "+Math.floor(state.score)+" · "+p+"%";
  objectiveEl.textContent=G.objective;
}
function loop(t){
  window.__RK_GAME_LOOP_STARTED__=true;
  var dt=Math.min(.05,(t-last)/1000||.016);last=t;
  update(dt);draw();requestAnimationFrame(loop);
}
window.__RK_GAME_TEST__={
  getState:function(){return JSON.parse(JSON.stringify(state))},
  getPlayerState:function(){return {x:state.x,y:state.y,health:state.health,score:state.score}},
  getObjectiveState:function(){return {progress:objectiveProgress(),status:state.status,score:state.score}},
  getWinState:function(){return state.status==="won"},
  getLoseState:function(){return state.status==="lost"},
  performTestAction:function(action){
    if(action==="collect"){var i=state.world.items.find(function(x){return !x.taken});if(i){state.x=i.x;state.y=i.y;return true}}
    if(action==="attack"){attack();return true}
    if(["left","right","up","down","action"].indexOf(action)>=0){setInput(action,true);setTimeout(function(){setInput(action,false)},100);return true}
    return false;
  },
  restart:function(){reset();return true}
};
resize();addEventListener("resize",resize);loadAssets();reset();window.__RK_GAME_READY__=true;draw();requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;
}
