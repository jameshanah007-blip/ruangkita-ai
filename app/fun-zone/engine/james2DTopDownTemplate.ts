import type { GameBlueprint } from "../laboratory/types";
import type { AssetMaterializationResult } from "./assetMaterializer";
import { createKimiStyleGameProfile } from "./kimiStyleGameProfile";

function textOf(blueprint: GameBlueprint): string {
  return [
    blueprint.title,
    blueprint.concept,
    blueprint.genre,
    blueprint.theme,
    blueprint.world,
    blueprint.visualStyle,
    ...blueprint.mechanics,
  ].join(" ").toLowerCase();
}

export function isTopDown2DTemplateRequest(blueprint: GameBlueprint): boolean {
  const text = textOf(blueprint);
  return /(pokemon|pokémon|top.?down|top down|2d rpg|rpg|adventure|petualangan|fantasy|fantasi|monster tamer|creature collection|pixel art|pixel-art)/i.test(text);
}

function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function assetUri(
  assets: AssetMaterializationResult | undefined,
  kind: string,
): string | null {
  const asset = assets?.assets.find(
    (item) => item.status === "ready" && item.kind === kind && item.uri.startsWith("data:image/"),
  );
  return asset?.uri ?? null;
}

/**
 * Dedicated 2D top-down template.
 *
 * This is intentionally separate from the generic autonomous canvas renderer.
 * It is the first visual foundation for the Fun Zone: tile-based world,
 * directional sprite animation, camera scrolling, sound, keyboard and touch.
 */
export function buildTopDown2DGameHtml(
  blueprint: GameBlueprint,
  materializedAssets?: AssetMaterializationResult,
): string {
  const playerAsset = assetUri(materializedAssets, "character");
  const npcAsset = assetUri(materializedAssets, "npc");
  const enemyAsset = assetUri(materializedAssets, "enemy");

  const profile = createKimiStyleGameProfile(blueprint);
  const config = js({
    title: blueprint.title || "James 2D Adventure",
    concept: blueprint.concept,
    genre: blueprint.genre,
    theme: blueprint.theme,
    world: blueprint.world,
    objective: blueprint.objective,
    mechanics: blueprint.mechanics,
    profile,
    playerAsset,
    npcAsset,
    enemyAsset,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>${String(blueprint.title || "James 2D Adventure").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char))}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#171c18;color:#fff;font-family:Georgia,"Times New Roman",serif}
body{display:flex;justify-content:center;align-items:stretch}
#root{position:relative;width:min(100vw,1100px);height:100dvh;min-height:500px;overflow:hidden;background:#202820}
canvas{display:block;width:100%;height:100%;image-rendering:pixelated;touch-action:none}
#hud{position:absolute;left:10px;right:10px;top:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.card{background:rgba(28,31,25,.88);border:2px solid rgba(229,205,132,.34);border-radius:4px;padding:7px 10px;box-shadow:0 5px 16px rgba(0,0,0,.2);font-size:11px;line-height:1.35;text-shadow:0 1px 1px #000}
#message{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88%,360px);display:none;padding:20px;border-radius:16px;background:rgba(27,29,24,.97);border:2px solid #d8bd72;text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.45)}
#message h2{margin:0 0 8px;font-size:22px}
#message p{margin:0 0 14px;color:#d7e0e7;font-size:12px;line-height:1.5}
#restart{border:0;border-radius:11px;padding:11px 18px;background:#d8bd72;color:#24271f;font-weight:900}
#controls{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 14px;pointer-events:none}
#pad,#actions{display:flex;gap:7px;pointer-events:auto}
#pad{width:172px;height:156px;position:relative}
.control{position:absolute;width:54px;height:54px;border:2px solid rgba(255,255,255,.28);border-radius:15px;background:rgba(25,35,43,.82);color:#fff;font-size:20px;font-weight:900;touch-action:none;user-select:none;-webkit-user-select:none}
#left{left:0;top:51px}#right{right:0;top:51px}#up{left:59px;top:0}#down{left:59px;bottom:0}
#actions .control{position:relative;width:64px;height:64px;border-radius:50%;font-size:14px}
#action{background:rgba(155,73,76,.88)}
#hint{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);max-width:54%;padding:5px 9px;border-radius:999px;background:rgba(20,30,38,.72);font-size:10px;color:#f4f7f9;pointer-events:none;text-align:center}
@media (min-width:760px){#controls{display:none}#hint{bottom:12px}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
</head>
<body>
<div id="root">
<canvas id="gameCanvas" aria-label="James 2D top-down game"></canvas>
<div id="hud">
  <div class="card"><b id="title"></b><br><span id="stats"></span></div>
  <div class="card" id="zone">2D TOP-DOWN</div>
</div>
<div id="hint"></div>
<div id="controls" aria-label="Touch controls">
  <div id="pad">
    <button class="control" id="up" data-key="up" aria-label="Move up">▲</button>
    <button class="control" id="left" data-key="left" aria-label="Move left">◀</button>
    <button class="control" id="right" data-key="right" aria-label="Move right">▶</button>
    <button class="control" id="down" data-key="down" aria-label="Move down">▼</button>
  </div>
  <div id="actions"><button class="control" id="action" data-key="action" aria-label="Interact">A</button></div>
</div>
<div id="message" role="status" aria-live="polite">
  <h2 id="messageTitle"></h2>
  <p id="messageBody"></p>
  <button id="restart" type="button">MAIN LAGI</button>
</div>
</div>
<script>
(function(){
"use strict";

var G=${config};
var canvas=document.getElementById("gameCanvas");
var ctx=canvas.getContext("2d");
var root=document.getElementById("root");
var titleEl=document.getElementById("title");
var statsEl=document.getElementById("stats");
var zoneEl=document.getElementById("zone");
var hintEl=document.getElementById("hint");
var message=document.getElementById("message");
var messageTitle=document.getElementById("messageTitle");
var messageBody=document.getElementById("messageBody");
var restart=document.getElementById("restart");

var TILE=32;
var MAP_W=52;
var MAP_H=38;
var W=720,H=560,dpr=1;
var last=0,raf=0;
var elapsed=0;
var audioCtx=null;
var keys={up:false,down:false,left:false,right:false,action:false};
var keyCodes={};
var spriteCache={};
var state;
var lastMoveSound=0;
var animationState={player:"idle-down",npc:"idle-down",npc2:"idle-down",enemy:"idle-down",companion:"idle-down"};
var animationStateUntil={player:0,npc:0,enemy:0,companion:0};

window.__RK_GAME_READY__=false;
window.__RK_GAME_RENDERED__=false;
window.__RK_GAME_LOOP_STARTED__=false;

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c;
  });
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function resize(){
  var r=canvas.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(320,r.width);
  H=Math.max(500,r.height);
  canvas.width=Math.floor(W*dpr);
  canvas.height=Math.floor(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize",resize);

function seeded(n){
  var x=Math.sin(n*91.731+123.17)*43758.5453123;
  return x-Math.floor(x);
}

function makeMap(){
  var map=[];
  for(var y=0;y<MAP_H;y++){
    var row=[];
    for(var x=0;x<MAP_W;x++) row.push("grass");
    map.push(row);
  }

  for(var x0=0;x0<MAP_W;x0++){map[0][x0]="tree";map[MAP_H-1][x0]="tree"}
  for(var y0=0;y0<MAP_H;y0++){map[y0][0]="tree";map[y0][MAP_W-1]="tree"}

  var cx=Math.floor(MAP_W/2);
  for(var y1=1;y1<MAP_H-1;y1++){map[y1][cx]="path";map[y1][cx+1]="path"}
  for(var x1=1;x1<MAP_W-1;x1++){map[14][x1]="path";map[15][x1]="path"}

  for(var i=0;i<20;i++){
    var tx=2+Math.floor(seeded(i+20)*(MAP_W-4));
    var ty=2+Math.floor(seeded(i+60)*(MAP_H-4));
    if(Math.abs(tx-cx)<3||Math.abs(ty-14)<3) continue;
    map[ty][tx]="tree";
    if(tx+1<MAP_W-1) map[ty][tx+1]="tree";
  }

  for(var w=0;w<7;w++){
    var wx=3+Math.floor(seeded(w+100)*(MAP_W-8));
    var wy=4+Math.floor(seeded(w+140)*(MAP_H-8));
    if(Math.abs(wx-cx)<5||Math.abs(wy-14)<4) continue;
    map[wy][wx]="water";
    if(wx+1<MAP_W-1) map[wy][wx+1]="water";
  }

  for(var r=0;r<8;r++){
    var rx=3+Math.floor(seeded(r+200)*(MAP_W-6));
    var ry=3+Math.floor(seeded(r+230)*(MAP_H-6));
    if(map[ry][rx]==="grass") map[ry][rx]="rock";
  }

  // Village buildings: three compact footprints around the central square.
  for(var hy=0;hy<3;hy++)for(var hx=0;hx<5;hx++){
    map[8+hy][cx-10+hx]="house";
    map[8+hy][cx+6+hx]="house";
  }
  for(var hy2=0;hy2<3;hy2++)for(var hx2=0;hx2<4;hx2++){
    map[24+hy2][cx-8+hx2]="house";
  }

  return map;
}

function reset(){
  state={
    map:makeMap(),
    player:{x:(Math.floor(MAP_W/2)+.5)*TILE,y:17.5*TILE,dir:"down",moving:false,frame:0,hp:3},
    npc:{x:(Math.floor(MAP_W/2)+5.5)*TILE,y:12.5*TILE,frame:0},
    npc2:{x:(Math.floor(MAP_W/2)-7.5)*TILE,y:15.5*TILE,frame:0},
    companion:{x:(Math.floor(MAP_W/2)-4.5)*TILE,y:18.5*TILE,frame:0},
    torches:[
      {x:(Math.floor(MAP_W/2)-8)*TILE,y:13*TILE},
      {x:(Math.floor(MAP_W/2)+1)*TILE,y:10*TILE},
      {x:(Math.floor(MAP_W/2)+9)*TILE,y:13*TILE},
      {x:(Math.floor(MAP_W/2)-1)*TILE,y:20*TILE},
      {x:(Math.floor(MAP_W/2)+8)*TILE,y:20*TILE}
    ],
    creature:{x:(Math.floor(MAP_W/2)+7.5)*TILE,y:20.5*TILE,dx:0,dy:0,frame:0,dir:"down",hitUntil:0,defeated:false},
    crystals:[
      {x:10.5*TILE,y:8.5*TILE,taken:false},
      {x:29.5*TILE,y:7.5*TILE,taken:false},
      {x:8.5*TILE,y:23.5*TILE,taken:false},
      {x:33.5*TILE,y:22.5*TILE,taken:false}
    ],
    crystalsTaken:0,
    // Semantic systems composed from the user's prompt.
    coins:0,
    resources:0,
    inventory:[],
    crops:0,
    crafted:0,
    relationship:0,
    xp:0,
    level:1,
    questStep:0,
    dialog:"",
    dialogUntil:0,
    won:false,
    lost:false,
    startedAt:performance.now(),
    stateChanges:0,
    objectiveChanges:0,
    restartCount:0,
    actionUntil:0
  };
  message.style.display="none";
  titleEl.textContent=G.title;
  zoneEl.textContent=(G.profile.worldType||"fantasy").toUpperCase()+" · "+G.profile.systems.slice(0,3).join(" · ");
  updateHud();
}
reset();

// Expose the composed systems to the runtime QA layer. The tester can now
// verify not only rendering but also that the systems selected from the
// user's prompt are actually represented in gameplay state.
window.__RK_GAME_SYSTEMS__=G.profile&&Array.isArray(G.profile.systems)?G.profile.systems.slice():[];


function tileAt(px,py){
  var tx=Math.floor(px/TILE),ty=Math.floor(py/TILE);
  if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H)return "tree";
  return state.map[ty][tx];
}

function blocked(px,py){
  var r=9;
  var points=[
    [px-r,py-r],[px+r,py-r],[px-r,py+r],[px+r,py+r]
  ];
  for(var i=0;i<points.length;i++){
    var t=tileAt(points[i][0],points[i][1]);
    if(t==="tree"||t==="water"||t==="rock"||t==="house")return true;
  }
  return false;
}

function movePlayer(dx,dy,dt){
  var speed=105;
  var moving=Math.abs(dx)+Math.abs(dy)>0;
  state.player.moving=moving;
  if(!moving){ setAnimationState("player",state.actionUntil>performance.now()?"action":"idle-down",120); return; }
  if(Math.abs(dx)>Math.abs(dy)) state.player.dir=dx<0?"left":"right";
  else state.player.dir=dy<0?"up":"down";

  var nx=state.player.x+dx*speed*dt;
  var ny=state.player.y+dy*speed*dt;
  if(!blocked(nx,state.player.y))state.player.x=nx;
  if(!blocked(state.player.x,ny))state.player.y=ny;
  state.player.frame=(state.player.frame+dt*8)%4;
  setAnimationState("player",resolveAnimationState("player",state.player.dir,true),180);
  state.stateChanges++;
  if(elapsed-lastMoveSound>.22){tone(180,.035,"square",.035);lastMoveSound=elapsed}
}

function drawTile(t,x,y){
  var px=x*TILE,py=y*TILE;
  if(t==="grass"){
    ctx.fillStyle=(x+y)%2===0?"#82bd61":"#78b257";
    ctx.fillRect(px,py,TILE,TILE);
    if((x*7+y*13)%9===0){
      ctx.fillStyle="#5b9d50";ctx.fillRect(px+6,py+8,3,7);ctx.fillRect(px+10,py+5,2,5);
    }
  }else if(t==="path"){
    ctx.fillStyle="#d8c27d";ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle="#c6ad6d";
    ctx.fillRect(px+5,py+6,3,2);ctx.fillRect(px+18,py+19,4,2);ctx.fillRect(px+25,py+11,2,3);
  }else if(t==="water"){
    ctx.fillStyle="#55a8d8";ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle="#8bd0ea";
    var wave=(Math.floor(elapsed*3)+(x+y))%3;
    ctx.fillRect(px+4+wave*3,py+10,12,2);ctx.fillRect(px+15,py+22,10,2);
  }else if(t==="tree"){
    ctx.fillStyle="#5a9d52";ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle="#3d7f49";ctx.fillRect(px+2,py+20,28,12);
    ctx.fillStyle="#2d6f3b";ctx.fillRect(px+5,py+5,22,18);
    ctx.fillStyle="#4e964b";ctx.fillRect(px+8,py+2,15,12);
    ctx.fillStyle="#75b95b";ctx.fillRect(px+11,py+5,8,5);
  }else if(t==="rock"){
    ctx.fillStyle="#82b65e";ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle="#6d7370";ctx.fillRect(px+7,py+10,18,15);
    ctx.fillStyle="#909895";ctx.fillRect(px+10,py+7,9,5);
  }else if(t==="house"){
    ctx.fillStyle="#bda77b";ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle="#8b7658";ctx.fillRect(px+1,py+2,30,30);
    ctx.fillStyle="#d2c18d";ctx.fillRect(px+4,py+5,24,27);
    ctx.fillStyle="#6c5b48";ctx.fillRect(px+7,py,4,32);ctx.fillRect(px+21,py,4,32);
    ctx.fillStyle="#8f302f";ctx.fillRect(px,py,32,7);
    ctx.fillStyle="#642c2d";ctx.fillRect(px+3,py+2,26,5);
    if((x+y)%5===0){ctx.fillStyle="#e7cc69";ctx.fillRect(px+13,py+13,6,7);}
  }
}

function drawCrystal(x,y){
  var bob=Math.sin(elapsed*4+x)*2;
  ctx.save();ctx.translate(x,y+bob);
  ctx.fillStyle="#ffffff";ctx.globalAlpha=.85;
  ctx.fillRect(-2,-9,4,18);
  ctx.fillStyle="#72e4f0";
  ctx.fillRect(-6,-4,12,8);ctx.fillRect(-3,-8,6,16);
  ctx.fillStyle="#d9ffff";ctx.fillRect(-1,-6,3,5);
  ctx.restore();
}

function setAnimationState(kind,next,duration){ animationState[kind]=next; animationStateUntil[kind]=performance.now()+duration; }
function resolveAnimationState(kind,dir,moving){
  if(kind==="player" && state.actionUntil>performance.now()) return "action";
  if(kind==="enemy" && state.creature && state.creature.hitUntil>performance.now()) return "hit";
  if(!moving) return kind==="enemy" && state.creature && state.creature.defeated ? "defeat" : "idle-down";
  if(dir==="up") return "walk-up";
  if(dir==="left") return "walk-left";
  if(dir==="right") return "walk-right";
  return "walk-down";
}
function drawSprite(kind,x,y,dir,frame){
  var source=kind==="player"?G.playerAsset:kind==="npc"||kind==="npc2"?G.npcAsset:G.enemyAsset;
  if(source){
    var img=spriteCache[source];
    if(!img){
      img=new Image();img.src=source;spriteCache[source]=img;
    }
    if(img.complete&&img.naturalWidth){
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      var sheet=img.naturalWidth>=img.naturalHeight*0.38 && img.naturalHeight>=img.naturalWidth*2.25;
      if(sheet){
        var frameCount=4;
        var frameIndex=Math.floor(elapsed*8)%frameCount;
        var rowNames=["idle-down","walk-down","walk-up","walk-left","walk-right","action","attack","hit","talk","defeat"];
        var stateName=animationState[kind]||resolveAnimationState(kind,dir,kind==="player"&&state.player.moving);
        if(animationStateUntil[kind] && animationStateUntil[kind]<performance.now()) stateName=resolveAnimationState(kind,dir,kind==="player"&&state.player.moving);
        var row=rowNames.indexOf(stateName); if(row<0)row=0;
        var fw=img.naturalWidth/frameCount;
        var fh=img.naturalHeight/10;
        ctx.translate(x,y-28);
        ctx.drawImage(img,frameIndex*fw,row*fh,fw,fh,-20,0,40,56);
      }else{
        ctx.drawImage(img,x-20,y-28,40,56);
      }
      ctx.restore();
      return;
    }
  }

  // Native pixel-art emergency sprite. This is an authored sprite,
  // not the old geometric circle/rectangle game fallback.
  var body=kind==="player"?"#6d54c7":kind==="npc"?"#e8a64f":"#b94361";
  var hair=kind==="player"?"#2c356e":kind==="npc"?"#6a3e24":"#36253f";
  var skin=kind==="player"?"#ffd5c1":kind==="npc"?"#f2c6a9":"#f0a7a7";
  var bob=(Math.floor(frame)%2)*2;
  ctx.save();ctx.translate(Math.round(x),Math.round(y+bob));
  ctx.fillStyle="rgba(0,0,0,.32)";ctx.fillRect(-13,18,26,5);
  ctx.fillStyle=body;ctx.fillRect(-10,-1,20,20);
  ctx.fillStyle=skin;ctx.fillRect(-8,-14,16,14);
  ctx.fillStyle=hair;ctx.fillRect(-10,-19,20,7);ctx.fillRect(-7,-22,14,6);
  ctx.fillStyle="#ffffff";ctx.fillRect(-7,-12,3,2);ctx.fillRect(4,-12,3,2);
  ctx.fillStyle="#18222e";
  if(dir==="down"){ctx.fillRect(-5,-10,2,3);ctx.fillRect(3,-10,2,3)}
  if(dir==="left"){ctx.fillRect(-10,-9,4,3)}
  if(dir==="right"){ctx.fillRect(6,-9,4,3)}
  ctx.fillStyle="#f7d65e";ctx.fillRect(-12,2,4,6);ctx.fillRect(8,2,4,6);
  ctx.fillStyle="#233044";
  var legShift=Math.floor(frame)%2?2:0;
  ctx.fillRect(-8,19,6,5+legShift);ctx.fillRect(2,19,6,5+(2-legShift));
  ctx.restore();
}

function drawSemanticHud(){
  var systems=G.profile&&Array.isArray(G.profile.systems)?G.profile.systems:[];
  var parts=[
    "LV "+state.level,
    "XP "+state.xp+"/50",
    "G "+state.coins,
    "RES "+state.resources,
    "ITEM "+state.inventory.length
  ];
  if(systems.indexOf("relationship")>=0)parts.push("BOND "+state.relationship);
  if(systems.indexOf("farming")>=0)parts.push("CROP "+state.crops);
  if(systems.indexOf("crafting")>=0)parts.push("CRAFT "+state.crafted);
  if(systems.indexOf("quest")>=0)parts.push("QUEST "+state.questStep+"/3");
  var old=document.getElementById("semanticStats");
  if(!old){
    old=document.createElement("div");
    old.id="semanticStats";
    old.style.cssText="position:absolute;left:12px;bottom:74px;max-width:calc(100% - 24px);padding:6px 9px;border:1px solid rgba(255,255,255,.18);background:rgba(20,25,20,.78);border-radius:5px;color:#f7e9b0;font:10px system-ui;pointer-events:none;text-shadow:0 1px 2px #000";
    root.appendChild(old);
  }
  old.textContent=parts.join("  ·  ");
}

function drawSystemStations(){
  var systems=G.profile&&Array.isArray(G.profile.systems)?G.profile.systems:[];
  function station(x,y,label,type){
    // Small authored pixel props instead of generic UI rectangles.
    ctx.save();
    ctx.translate(x,y);
    if(type==="farm"){
      ctx.fillStyle="#8a633e";ctx.fillRect(-22,-8,44,28);
      ctx.fillStyle="#b78a55";ctx.fillRect(-18,-4,36,4);
      ctx.fillStyle="#5d8f3d";for(var i=0;i<4;i++){ctx.fillRect(-16+i*10,5,4,12);ctx.fillRect(-13+i*10,2,3,5)}
      ctx.fillStyle="#e7c77a";ctx.fillRect(-30,-20,60,8);
    }else if(type==="shop"){
      ctx.fillStyle="#75462e";ctx.fillRect(-22,-10,44,30);
      ctx.fillStyle="#c68a4e";ctx.fillRect(-26,-18,52,10);
      ctx.fillStyle="#f1d27a";ctx.fillRect(-15,-2,30,8);
      ctx.fillStyle="#4b3427";ctx.fillRect(-5,8,10,12);
    }else if(type==="craft"){
      ctx.fillStyle="#5d4633";ctx.fillRect(-24,-5,48,20);
      ctx.fillStyle="#9a7047";ctx.fillRect(-28,-13,56,9);
      ctx.fillStyle="#d6b16b";ctx.fillRect(-9,-2,18,4);
      ctx.fillStyle="#6d8790";ctx.fillRect(8,-12,6,7);
    }else{
      ctx.fillStyle="#614b8d";ctx.fillRect(-19,-8,38,25);
      ctx.fillStyle="#8d6fc0";ctx.fillRect(-23,-14,46,7);
      ctx.fillStyle="#f4df86";ctx.fillRect(-4,-2,8,19);
      ctx.fillStyle="#241b31";ctx.fillRect(-1,4,2,7);
    }
    ctx.fillStyle="#f8e7a1";ctx.font="bold 9px system-ui";ctx.textAlign="center";
    ctx.fillText(label,0,-24);ctx.textAlign="left";
    ctx.restore();
  }
  if(systems.indexOf("farming")>=0)station((Math.floor(MAP_W/2)-5)*TILE,18*TILE,"FARM","farm");
  if(systems.indexOf("economy")>=0)station((Math.floor(MAP_W/2)+9)*TILE,11*TILE,"SHOP","shop");
  if(systems.indexOf("crafting")>=0)station((Math.floor(MAP_W/2)-9)*TILE,11*TILE,"CRAFT","craft");
  if(systems.indexOf("quest")>=0)station((Math.floor(MAP_W/2)+4)*TILE,16*TILE,"QUEST","quest");
}


function drawInteractionPrompt(){
  var target=nearestSystem();
  var label=target
    ? (target.kind==="farm"?"E · FARM":target.kind==="shop"?"E · SHOP":target.kind==="craft"?"E · CRAFT":"E · QUEST")
    : null;
  var npcNear=Math.min(dist(state.player,state.npc),dist(state.player,state.npc2))<58;
  var enemyNear=hasSystem("combat")&&dist(state.player,state.creature)<58&&!state.creature.defeated;
  if(!label&&npcNear)label="E · TALK";
  if(!label&&enemyNear)label="SPACE / E · ATTACK";
  var old=document.getElementById("interactionPrompt");
  if(!old){
    old=document.createElement("div");
    old.id="interactionPrompt";
    old.style.cssText="position:absolute;left:50%;bottom:88px;transform:translateX(-50%);padding:6px 11px;border:1px solid rgba(255,255,255,.28);background:rgba(20,25,20,.88);border-radius:6px;color:#fff;font:700 11px system-ui;pointer-events:none;text-shadow:0 1px 2px #000;display:none";
    root.appendChild(old);
  }
  old.textContent=label||"";
  old.style.display=label?"block":"none";
}

function drawWorld(){
  // Follow the player with a dead-zone camera instead of pinning the
  // character permanently to screen center. This makes four-direction
  // movement visibly readable while still scrolling through the world.
  var screenMarginX=Math.min(180,W*.28);
  var screenMarginY=Math.min(150,H*.25);
  var targetCamX=state.player.x-W/2;
  var targetCamY=state.player.y-H/2;
  var currentPlayerScreenX=state.player.x-targetCamX;
  var currentPlayerScreenY=state.player.y-targetCamY;
  if(currentPlayerScreenX<screenMarginX)targetCamX=state.player.x-screenMarginX;
  if(currentPlayerScreenX>W-screenMarginX)targetCamX=state.player.x-(W-screenMarginX);
  if(currentPlayerScreenY<screenMarginY)targetCamY=state.player.y-screenMarginY;
  if(currentPlayerScreenY>H-screenMarginY)targetCamY=state.player.y-(H-screenMarginY);
  var camX=clamp(targetCamX,0,MAP_W*TILE-W);
  var camY=clamp(targetCamY,0,MAP_H*TILE-H);
  ctx.fillStyle="#79b85b";ctx.fillRect(0,0,W,H);

  var startX=Math.max(0,Math.floor(camX/TILE)-1);
  var endX=Math.min(MAP_W,Math.ceil((camX+W)/TILE)+1);
  var startY=Math.max(0,Math.floor(camY/TILE)-1);
  var endY=Math.min(MAP_H,Math.ceil((camY+H)/TILE)+1);

  ctx.save();ctx.translate(-camX,-camY);
  for(var y=startY;y<endY;y++)for(var x=startX;x<endX;x++)drawTile(state.map[y][x],x,y);

  for(var c=0;c<state.crystals.length;c++){
    if(!state.crystals[c].taken)drawCrystal(state.crystals[c].x,state.crystals[c].y);
  }

  // Semantic stations are authored from the composed game systems.
  drawSystemStations();
  // Render ambient light BEFORE actors so characters stay crisp and readable.
  drawAmbientLighting(camX,camY);
  drawSprite("npc",state.npc.x,state.npc.y,"down",state.npc.frame);
  drawSprite("npc2",state.npc2.x,state.npc2.y,"down",state.npc2.frame);
  drawSprite("enemy",state.creature.x,state.creature.y,state.creature.dir||"down",state.creature.frame);
  drawSprite("player",state.player.x,state.player.y,state.player.dir,state.player.frame);
  for(var t=0;t<state.torches.length;t++) drawTorch(state.torches[t].x,state.torches[t].y);
  ctx.restore();

  if(state.dialog&&performance.now()<state.dialogUntil){
    ctx.fillStyle="rgba(24,34,42,.94)";
    ctx.fillRect(18,H-116,W-36,74);
    ctx.strokeStyle="rgba(255,255,255,.25)";
    ctx.strokeRect(18,H-116,W-36,74);
    ctx.fillStyle="#fff";ctx.font="14px system-ui";
    ctx.fillText(state.dialog,32,H-82);
  }
}

function drawTorch(x,y){
  var flicker=Math.sin(elapsed*8+x*.03)*1.5;
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle="#4a3326";ctx.fillRect(-2,3,4,18);
  ctx.fillStyle="#d58b35";ctx.fillRect(-5,-2+flicker,10,9);
  ctx.fillStyle="#ffe38b";ctx.fillRect(-2,-5+flicker,5,7);
  ctx.restore();
}

function drawAmbientLighting(camX,camY){
  // Kimi-style clean 2D adventure presentation: no full-screen black
  // post-processing layer and no vignette over actors.
  ctx.save();
  ctx.globalCompositeOperation="screen";
  for(var k=0;k<state.torches.length;k++){
    var tx=state.torches[k].x-camX,ty=state.torches[k].y-camY;
    var rg=ctx.createRadialGradient(tx,ty,2,tx,ty,78);
    rg.addColorStop(0,"rgba(255,210,112,.20)");
    rg.addColorStop(.45,"rgba(255,190,76,.08)");
    rg.addColorStop(1,"rgba(255,190,76,0)");
    ctx.fillStyle=rg;
    ctx.beginPath();
    ctx.arc(tx,ty,78,0,Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

function hasSystem(name){
  return Boolean(G.profile&&Array.isArray(G.profile.systems)&&G.profile.systems.indexOf(name)>=0);
}

function nearestSystem(){
  var px=state.player.x,py=state.player.y,candidates=[];
  // Small authored village stations. They are part of the semantic composition,
  // not a generic placeholder.
  if(hasSystem("farming"))candidates.push({kind:"farm",x:(Math.floor(MAP_W/2)-5)*TILE,y:18*TILE});
  if(hasSystem("economy"))candidates.push({kind:"shop",x:(Math.floor(MAP_W/2)+9)*TILE,y:11*TILE});
  if(hasSystem("crafting"))candidates.push({kind:"craft",x:(Math.floor(MAP_W/2)-9)*TILE,y:11*TILE});
  if(hasSystem("quest"))candidates.push({kind:"quest",x:(Math.floor(MAP_W/2)+4)*TILE,y:16*TILE});
  candidates.sort(function(a,b){return Math.hypot(px-a.x,py-a.y)-Math.hypot(px-b.x,py-b.y)});
  return candidates.length&&Math.hypot(px-candidates[0].x,py-candidates[0].y)<62?candidates[0]:null;
}

function interact(){
  if(state.won||state.lost)return;
  var dNpc=Math.min(dist(state.player,state.npc),dist(state.player,state.npc2));
  var dEnemy=dist(state.player,state.creature);
  state.actionUntil=performance.now()+420;

  if(hasSystem("combat")&&dEnemy<58){
    setAnimationState("player","attack",420);
    state.creature.hitUntil=performance.now()+420;
    if(!state.creature.defeated){
      state.creature.defeated=true;
      state.xp+=20;
      state.coins+=5;
      state.objectiveChanges++;
      state.stateChanges++;
      state.dialog="Monster dikalahkan! +20 XP · +5 Gold";
      state.dialogUntil=performance.now()+1900;
      if(state.xp>=50){state.level++;state.xp-=50}
    }
    tone(120,.08,"sawtooth",.04);tone(420,.1,"square",.035);
    return;
  }

  var station=nearestSystem();
  if(station){
    if(station.kind==="farm"){
      state.crops++;
      state.resources+=2;
      state.xp+=8;
      state.dialog="Kebun: tanam dan panen berhasil. +2 Resource · +8 XP";
    }else if(station.kind==="shop"){
      if(state.coins>=5){
        state.coins-=5;state.inventory.push("Potion");state.xp+=4;
        state.dialog="Toko: membeli Potion seharga 5 Gold.";
      }else{
        state.coins+=2;state.dialog="Toko: belum cukup Gold. Ambil resource atau kalahkan monster.";
      }
    }else if(station.kind==="craft"){
      if(state.resources>=2){
        state.resources-=2;state.crafted++;state.inventory.push("Crafted Item");state.xp+=12;
        state.dialog="Workbench: item berhasil dibuat. -2 Resource · +12 XP";
      }else{
        state.dialog="Workbench: butuh 2 Resource untuk crafting.";
      }
    }else if(station.kind==="quest"){
      state.questStep=Math.min(3,state.questStep+1);
      state.xp+=10;state.dialog="Quest: objective diperbarui. Langkah "+state.questStep+"/3.";
    }
    state.objectiveChanges++;state.stateChanges++;
    if(state.xp>=50){state.level++;state.xp-=50}
    state.dialogUntil=performance.now()+2400;
    tone(660,.12,"sine",.05);tone(880,.16,"sine",.04);
    return;
  }

  if(dNpc<58){
    setAnimationState("player","talk",620);
    if(dist(state.player,state.npc)<58) setAnimationState("npc","talk",620);
    if(dist(state.player,state.npc2)<58) setAnimationState("npc2","talk",620);
    if(hasSystem("relationship"))state.relationship=Math.min(100,state.relationship+5);
    var systems=G.profile&&Array.isArray(G.profile.systems)?G.profile.systems:[];
    var topic=hasSystem("relationship")
      ? "Aira: Hubungan +5. Pilihanmu akan membentuk hubungan dengan penduduk."
      : systems.indexOf("economy")>=0
        ? "Pedagang: Toko desa siap melayani jual-beli."
        : systems.indexOf("farming")>=0
          ? "Petani: Rawat kebun, panen hasilnya, lalu lanjutkan petualangan."
          : systems.indexOf("crafting")>=0
            ? "Pengrajin: Bawa resource ke meja kerja untuk membuat item."
            : "Aira: Jelajahi dunia, bicara dengan penduduk, dan selesaikan tujuanmu.";
    state.dialog=topic;
    state.dialogUntil=performance.now()+2600;
    state.stateChanges++;tone(660,.12,"sine",.05);tone(880,.16,"sine",.04);
    return;
  }
  setAnimationState("player","action",420);
}


function checkCrystals(){
  for(var i=0;i<state.crystals.length;i++){
    var c=state.crystals[i];
    if(!c.taken&&dist(state.player,c)<24){
      c.taken=true;
      state.crystalsTaken++;
      state.objectiveChanges++;
      state.stateChanges++;
      tone(740,.08,"sine",.05);tone(980,.12,"sine",.04);
      if(state.crystalsTaken===state.crystals.length){
        state.won=true;
        showMessage("AREA SELESAI","Semua Crystal ditemukan. Petualangan 2D selesai.");
        tone(523,.12,"sine",.05);tone(659,.12,"sine",.05);tone(784,.2,"sine",.05);
      }
    }
  }
}

function updateCreature(dt){
  state.creature.frame=(state.creature.frame+dt*5)%4;
  if(state.creature.dx) state.creature.dir=state.creature.dx<0?"left":"right";
  else if(state.creature.dy) state.creature.dir=state.creature.dy<0?"up":"down";
  setAnimationState("enemy",resolveAnimationState("enemy",state.creature.dir,Boolean(state.creature.dx||state.creature.dy)),180);
  state.npc.frame=(state.npc.frame+dt*2)%4;
  state.npc2.frame=(state.npc2.frame+dt*1.7)%4;
  if(!animationStateUntil.npc || animationStateUntil.npc<performance.now()) setAnimationState("npc","idle-down",240);
  if(!animationStateUntil.npc2 || animationStateUntil.npc2<performance.now()) setAnimationState("npc2","idle-down",240);
  setAnimationState("companion","idle-down",240);
  if(Math.random()<.01){
    var a=Math.floor(Math.random()*4);
    state.creature.dx=a===0?1:a===1?-1:0;
    state.creature.dy=a===2?1:a===3?-1:0;
  }
  var speed=25;
  var nx=state.creature.x+state.creature.dx*speed*dt;
  var ny=state.creature.y+state.creature.dy*speed*dt;
  if(!blocked(nx,ny)){state.creature.x=nx;state.creature.y=ny}
}

function showMessage(title,body){
  messageTitle.textContent=title;
  messageBody.textContent=body;
  message.style.display="block";
}

function updateHud(){
  statsEl.textContent="HP "+state.player.hp+" · Lv "+state.level+" · Gold "+state.coins+" · Crystal "+state.crystalsTaken+"/"+state.crystals.length;
  hintEl.textContent=(G.profile&&G.profile.objectiveLabel?G.profile.objectiveLabel:"Explore and complete the objective.")
    +" · "+(G.profile&&G.profile.systems?G.profile.systems.slice(0,4).join(" · "):"exploration")
    +" · Arrow/WASD move · Space/E interact";
  drawSemanticHud();
}

function tone(freq,duration,type,volume){
  try{
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==="suspended")audioCtx.resume();
    var o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type=type||"sine";o.frequency.value=freq;
    g.gain.setValueAtTime(volume||.04,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+(duration||.08));
    o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+(duration||.08));
  }catch(_){}
}

function ensureAudio(){tone(330,.025,"triangle",.018)}

function frame(now){
  var dt=Math.min(.033,(now-last)/1000||.016);last=now;elapsed+=dt;
  var dx=(keys.right?1:0)-(keys.left?1:0);
  var dy=(keys.down?1:0)-(keys.up?1:0);
  if(dx&&dy){dx*=.7071;dy*=.7071}
  movePlayer(dx,dy,dt);
  updateCreature(dt);
  checkCrystals();
  drawWorld();
  updateHud();
  drawInteractionPrompt();
  window.__RK_GAME_RENDERED__=true;
  window.__RK_GAME_LOOP_STARTED__=true;
  raf=requestAnimationFrame(frame);
}

function setKey(key,value){
  keys[key]=value;
  if(value)ensureAudio();
}

function onKey(e,down){
  var target=e.target;
  if(target&&(/INPUT|TEXTAREA|SELECT/.test(target.tagName)||target.isContentEditable))return;
  var code=e.code;
  var key=null;
  if(code==="ArrowUp"||code==="KeyW")key="up";
  else if(code==="ArrowDown"||code==="KeyS")key="down";
  else if(code==="ArrowLeft"||code==="KeyA")key="left";
  else if(code==="ArrowRight"||code==="KeyD")key="right";
  else if(code==="Space"||code==="Enter"||code==="KeyE")key="action";
  if(!key)return;
  e.preventDefault();
  setKey(key,down);
  if(down&&key==="action"&&!e.repeat)interact();
}

window.addEventListener("keydown",function(e){onKey(e,true)});
window.addEventListener("keyup",function(e){onKey(e,false)});

/*
 * Keyboard bridge for the sandbox host.
 * The game remains playable even when the iframe itself does not own focus.
 * This is additive to the normal keydown/keyup listeners above.
 */
window.addEventListener("message",function(e){
  try{
    var data=e&&e.data;
    if(!data||data.type!=="AI_GAME_KEY_EVENT")return;
    var code=String(data.code||"");
    var key=String(data.key||"");
    var mapped=null;
    if(code==="ArrowUp"||code==="KeyW"||key==="ArrowUp"||key==="w"||key==="W")mapped="up";
    else if(code==="ArrowDown"||code==="KeyS"||key==="ArrowDown"||key==="s"||key==="S")mapped="down";
    else if(code==="ArrowLeft"||code==="KeyA"||key==="ArrowLeft"||key==="a"||key==="A")mapped="left";
    else if(code==="ArrowRight"||code==="KeyD"||key==="ArrowRight"||key==="d"||key==="D")mapped="right";
    else if(code==="Space"||code==="Enter"||code==="KeyE"||key===" "||key==="Enter"||key==="e"||key==="E")mapped="action";
    if(!mapped)return;
    var down=data.eventType!=="keyup";
    setKey(mapped,down);
    if(down&&mapped==="action"&&!data.repeat)interact();
  }catch(_){}
});

document.querySelectorAll("[data-key]").forEach(function(button){
  var key=button.getAttribute("data-key");
  var start=function(e){e.preventDefault();setKey(key,true);if(key==="action")interact()};
  var end=function(e){e.preventDefault();setKey(key,false)};
  button.addEventListener("pointerdown",start);
  button.addEventListener("pointerup",end);
  button.addEventListener("pointercancel",end);
  button.addEventListener("pointerleave",end);
});

window.__RK_GAME_TEST__={
  getState:function(){
    return {
      crystalsTaken:state.crystalsTaken,
      dialog:state.dialog,
      won:state.won,
      lost:state.lost,
      stateChanges:state.stateChanges,
      objectiveChanges:state.objectiveChanges,
      coins:state.coins,
      resources:state.resources,
      crops:state.crops,
      crafted:state.crafted,
      relationship:state.relationship,
      xp:state.xp,
      level:state.level,
      questStep:state.questStep,
      inventoryCount:state.inventory.length,
      restartCount:state.restartCount||0
    };
  },
  getPlayerState:function(){
    return {
      x:state.player.x,
      y:state.player.y,
      dir:state.player.dir,
      hp:state.player.hp,
      moving:state.player.moving
    };
  },
  getObjectiveState:function(){
    return {
      progress:state.crystalsTaken/state.crystals.length,
      crystalsTaken:state.crystalsTaken,
      status:state.won?"won":state.lost?"lost":"playing"
    };
  },
  getWinState:function(){return state.won===true;},
  getLoseState:function(){return state.lost===true;},
  performTestAction:function(action){
    if(action==="move"||action==="explore"){
      var beforeX=state.player.x,beforeY=state.player.y;
      var nx=state.player.x+TILE*2;
      if(!blocked(nx,state.player.y)) state.player.x=nx;
      else state.player.y=Math.min(MAP_H*TILE-40,state.player.y+TILE*2);
      state.player.dir="right";
      state.player.moving=true;
      state.player.frame=(state.player.frame+1)%4;
      state.stateChanges++;
      return beforeX!==state.player.x||beforeY!==state.player.y;
    }
    if(action==="collect"){
      for(var i=0;i<state.crystals.length;i++){
        if(!state.crystals[i].taken){
          state.player.x=state.crystals[i].x;
          state.player.y=state.crystals[i].y;
          checkCrystals();
          return true;
        }
      }
      return false;
    }
    if(action==="interact"||action==="talk"){
      var nearestNpc=dist(state.player,state.npc)<=dist(state.player,state.npc2)?state.npc:state.npc2;
      state.player.x=nearestNpc.x;
      state.player.y=nearestNpc.y;
      interact();
      return true;
    }
    if(action==="farm"||action==="plant"||action==="harvest"||action==="work"||action==="craft"||action==="buy"||action==="sell"||action==="quest"){
      var station=nearestSystem();
      if(station){
        state.player.x=station.x;
        state.player.y=station.y;
        interact();
        return true;
      }
      return false;
    }
    if(action==="attack"){
      state.player.x=state.creature.x;
      state.player.y=state.creature.y;
      interact();
      return true;
    }
    if(action==="restart"){
      var previousRestarts=state.restartCount||0;
      reset();
      state.restartCount=previousRestarts+1;
      state.stateChanges++;
      return true;
    }
    return false;
  },
  restart:function(){
    var previousRestarts=state.restartCount||0;
    reset();
    state.restartCount=previousRestarts+1;
    state.stateChanges++;
    return true;
  }
};

restart.addEventListener("click",function(){
  var previousRestarts=state.restartCount||0;
  reset();
  state.restartCount=previousRestarts+1;
  state.stateChanges++;
  ensureAudio();
});

resize();
window.__RK_GAME_READY__=true;
raf=requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
