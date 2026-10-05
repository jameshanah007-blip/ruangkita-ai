import type { GameBlueprint } from "../laboratory/types";
import type { AssetMaterializationResult } from "./assetMaterializer";

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
  return /(pokemon|pokémon|top.?down|top down|2d rpg|rpg|monster tamer|creature collection|pixel art|pixel-art)/i.test(text);
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

  const config = js({
    title: blueprint.title || "James 2D Adventure",
    concept: blueprint.concept,
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
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101b2d;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{display:flex;justify-content:center;align-items:stretch}
#root{position:relative;width:min(100vw,900px);height:100dvh;min-height:500px;overflow:hidden;background:#79b85b}
canvas{display:block;width:100%;height:100%;image-rendering:pixelated;touch-action:none}
#hud{position:absolute;left:10px;right:10px;top:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.card{background:rgba(24,34,42,.86);border:2px solid rgba(255,255,255,.18);border-radius:12px;padding:7px 10px;box-shadow:0 5px 16px rgba(0,0,0,.2);font-size:11px;line-height:1.35;text-shadow:0 1px 1px #000}
#message{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88%,360px);display:none;padding:20px;border-radius:16px;background:rgba(15,24,34,.96);border:2px solid #f5d76e;text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.45)}
#message h2{margin:0 0 8px;font-size:22px}
#message p{margin:0 0 14px;color:#d7e0e7;font-size:12px;line-height:1.5}
#restart{border:0;border-radius:11px;padding:11px 18px;background:#f5d76e;color:#18222c;font-weight:900}
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
<div id="hint">Arrow / WASD: move · Space / E: interact · Touch controls on Android</div>
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
var MAP_W=42;
var MAP_H=30;
var W=720,H=560,dpr=1;
var last=0,raf=0;
var elapsed=0;
var audioCtx=null;
var keys={up:false,down:false,left:false,right:false,action:false};
var keyCodes={};
var spriteCache={};
var state;
var lastMoveSound=0;

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

  map[12][cx-1]="house";map[12][cx]="house";map[12][cx+1]="house";
  map[13][cx-1]="house";map[13][cx]="house";map[13][cx+1]="house";

  return map;
}

function reset(){
  state={
    map:makeMap(),
    player:{x:(Math.floor(MAP_W/2)+.5)*TILE,y:17.5*TILE,dir:"down",moving:false,frame:0,hp:3},
    npc:{x:(Math.floor(MAP_W/2)+4.5)*TILE,y:11.5*TILE,frame:0},
    companion:{x:(Math.floor(MAP_W/2)-4.5)*TILE,y:16.5*TILE,frame:0},
    creature:{x:(Math.floor(MAP_W/2)+7.5)*TILE,y:20.5*TILE,dx:0,dy:0,frame:0},
    crystals:[
      {x:10.5*TILE,y:8.5*TILE,taken:false},
      {x:29.5*TILE,y:7.5*TILE,taken:false},
      {x:8.5*TILE,y:23.5*TILE,taken:false},
      {x:33.5*TILE,y:22.5*TILE,taken:false}
    ],
    crystalsTaken:0,
    dialog:"",
    dialogUntil:0,
    won:false,
    lost:false,
    startedAt:performance.now(),
    stateChanges:0,
    objectiveChanges:0,
    restartCount:0
  };
  message.style.display="none";
  titleEl.textContent=G.title;
  zoneEl.textContent="2D TOP-DOWN · PIXEL ADVENTURE";
  updateHud();
}
reset();

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
  if(!moving)return;
  if(Math.abs(dx)>Math.abs(dy)) state.player.dir=dx<0?"left":"right";
  else state.player.dir=dy<0?"up":"down";

  var nx=state.player.x+dx*speed*dt;
  var ny=state.player.y+dy*speed*dt;
  if(!blocked(nx,state.player.y))state.player.x=nx;
  if(!blocked(state.player.x,ny))state.player.y=ny;
  state.player.frame=(state.player.frame+dt*8)%4;
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
    ctx.fillStyle="#d9bd82";ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle="#a84e43";ctx.fillRect(px+2,py+3,28,10);
    ctx.fillStyle="#8d403a";ctx.fillRect(px+6,py+1,20,7);
    ctx.fillStyle="#8a6a45";ctx.fillRect(px+11,py+15,10,17);
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

function drawSprite(kind,x,y,dir,frame){
  var source=kind==="player"?G.playerAsset:kind==="npc"?G.npcAsset:G.enemyAsset;
  if(source){
    var img=spriteCache[source];
    if(!img){
      img=new Image();img.src=source;spriteCache[source]=img;
    }
    if(img.complete&&img.naturalWidth){
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(img,x-20,y-28,40,56);
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
  ctx.fillStyle="#3d5c3b";ctx.fillRect(-13,17,26,5);
  ctx.fillStyle=body;ctx.fillRect(-10,-1,20,20);
  ctx.fillStyle=skin;ctx.fillRect(-8,-14,16,14);
  ctx.fillStyle=hair;ctx.fillRect(-10,-19,20,7);ctx.fillRect(-7,-22,14,6);
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

function drawWorld(){
  var camX=clamp(state.player.x-W/2,0,MAP_W*TILE-W);
  var camY=clamp(state.player.y-H/2,0,MAP_H*TILE-H);
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

  drawSprite("npc",state.npc.x,state.npc.y,"down",state.npc.frame);
  drawSprite("enemy",state.creature.x,state.creature.y,"down",state.creature.frame);
  drawSprite("player",state.player.x,state.player.y,state.player.dir,state.player.frame);
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

function interact(){
  if(state.won||state.lost)return;
  var dNpc=dist(state.player,state.npc);
  if(dNpc<58){
    state.dialog="Aira: Selamat datang! Jelajahi desa dan kumpulkan Crystal!";
    state.dialogUntil=performance.now()+2600;
    state.stateChanges++;tone(660,.12,"sine",.05);tone(880,.16,"sine",.04);
    return;
  }
  var dEnemy=dist(state.player,state.creature);
  if(dEnemy<48){
    state.dialog="Makhluk liar! Tekan A / Space untuk berinteraksi.";
    state.dialogUntil=performance.now()+1900;
    state.stateChanges++;tone(120,.12,"sawtooth",.04);
  }
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
        showMessage("AREA SELESAI","Semua Crystal ditemukan. Template 2D berhasil dimainkan.");
        tone(523,.12,"sine",.05);tone(659,.12,"sine",.05);tone(784,.2,"sine",.05);
      }
    }
  }
}

function updateCreature(dt){
  state.creature.frame=(state.creature.frame+dt*4)%4;
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
  statsEl.textContent="HP "+state.player.hp+" · Crystal "+state.crystalsTaken+"/"+state.crystals.length+" · WASD/Arrows";
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

document.querySelectorAll("[data-key]").forEach(function(button){
  var key=button.getAttribute("data-key");
  var start=function(e){e.preventDefault();setKey(key,true);if(key==="action")interact()};
  var end=function(e){e.preventDefault();setKey(key,false)};
  button.addEventListener("pointerdown",start);
  button.addEventListener("pointerup",end);
  button.addEventListener("pointercancel",end);
  button.addEventListener("pointerleave",end);
});

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
