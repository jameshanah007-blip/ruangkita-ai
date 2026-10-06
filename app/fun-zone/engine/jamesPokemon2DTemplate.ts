import type { GameBlueprint } from "../laboratory/types";

function esc(value: string): string {
  return String(value || "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c] || c));
}

function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function textOf(b: GameBlueprint): string {
  return [b.title,b.concept,b.genre,b.theme,b.world,b.visualStyle,b.objective,...b.mechanics,...b.playerActions].join(" ").toLowerCase();
}

/**
 * Dedicated 2D monster-tamer runtime.
 * It uses an original visual language inspired by HD-2D:
 * pixel characters + layered 2D environment + depth shadows.
 * It does not depend on third-party game assets.
 */
export function isPokemon2DRequest(b: GameBlueprint): boolean {
  return /pokemon|pokémon|monster tamer|monster-tamer|creature collection|creature tamer|monster collection|monster trainer/i.test(textOf(b));
}

export function buildPokemon2DGameHtml(b: GameBlueprint): string {
  const config = js({
    title: b.title || "James Monster Adventure",
    objective: b.objective || "Jelajahi desa, temukan creature dan selesaikan petualangan.",
    concept: b.concept,
  });

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>${esc(b.title || "James Monster Adventure")}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#182018;color:#fff;font-family:system-ui,sans-serif}
body{display:flex;justify-content:center}
#root{position:relative;width:min(100vw,1100px);height:100dvh;min-height:520px;overflow:hidden;background:#789f68}
canvas{display:block;width:100%;height:100%;image-rendering:pixelated;touch-action:none}
#hud{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.card{background:rgba(25,30,24,.86);border:2px solid rgba(246,224,151,.42);border-radius:10px;padding:8px 11px;font-size:11px;line-height:1.35;text-shadow:0 1px 2px #000;max-width:65%}
#objective{position:absolute;top:72px;left:50%;transform:translateX(-50%);max-width:88%;padding:7px 12px;border-radius:999px;background:rgba(25,30,24,.82);border:1px solid rgba(246,224,151,.42);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tutorial{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(90%,430px);padding:20px;border-radius:18px;background:rgba(20,25,21,.97);border:2px solid #e8ce7b;box-shadow:0 20px 70px #0009;z-index:5}
#tutorial h2{margin:0 0 8px;font-size:22px}
#tutorial p{margin:6px 0;color:#e6eadf;font-size:12px;line-height:1.55}
#tutorial .row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.key{padding:7px 9px;border-radius:9px;background:#304337;border:1px solid #ffffff25;font-size:11px}
#tutorial button,#message button{border:0;border-radius:11px;padding:11px 17px;background:#e4c66d;color:#20251e;font-weight:900}
#controls{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 14px;pointer-events:none;z-index:4}
#pad{position:relative;width:174px;height:158px;pointer-events:auto}
.control{position:absolute;width:54px;height:54px;border:2px solid #ffffff35;border-radius:15px;background:rgba(27,38,45,.88);color:#fff;font-size:20px;font-weight:900;touch-action:none;user-select:none;-webkit-user-select:none}
#up{left:60px;top:0}#left{left:0;top:52px}#right{right:0;top:52px}#down{left:60px;bottom:0}
#actions{display:flex;gap:8px;pointer-events:auto}
.action{position:relative;width:64px;height:64px;border-radius:50%;border:2px solid #ffffff35;background:rgba(171,75,76,.9);color:#fff;font-weight:900;touch-action:none}
#help{position:absolute;right:12px;bottom:190px;width:44px;height:44px;border:1px solid #fff4;border-radius:50%;background:#18251ddd;color:#fff;font-weight:900;z-index:4}
#message{display:none;position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:min(88%,390px);padding:22px;border-radius:18px;background:rgba(20,25,21,.97);border:2px solid #e4c66d;text-align:center;z-index:6}
#message h2{margin:0 0 8px}.message-text{font-size:12px;line-height:1.55;color:#dfe8dc}
#message button{margin-top:10px}
@media(min-width:760px){#controls{display:none}}
@media(max-width:420px){#objective{top:68px;font-size:9px}.card{font-size:10px}.control{width:50px;height:50px}#pad{width:162px;height:150px}}
</style>
</head>
<body>
<div id="root">
<canvas id="game" aria-label="James 2D monster adventure"></canvas>
<div id="hud"><div class="card"><b id="title"></b><br><span id="stats"></span></div><div class="card">MONSTER ADVENTURE · 2D</div></div>
<div id="objective"></div>
<button id="help" type="button" aria-label="Buka petunjuk">?</button>
<div id="tutorial" role="dialog" aria-modal="true">
<h2>🎮 Cara Bermain</h2>
<p><b>Tujuan:</b> jelajahi desa, temui NPC, temukan creature liar, lalu tangkap creature untuk menyelesaikan petualangan.</p>
<div class="row">
<span class="key">▲ Atas / W</span><span class="key">▼ Bawah / S</span>
<span class="key">◀ Kiri / A</span><span class="key">▶ Kanan / D</span><span class="key">A / Space = Aksi</span>
</div>
<p>Di Android gunakan <b>D-pad 4 arah</b>. Tahan tombol untuk berjalan. Dekati NPC atau creature lalu tekan <b>A</b>.</p>
<button id="start" type="button">MULAI GAME</button>
</div>
<div id="controls" aria-label="Kontrol sentuh">
<div id="pad">
<button class="control" id="up" data-dir="up" aria-label="Atas">▲</button>
<button class="control" id="left" data-dir="left" aria-label="Kiri">◀</button>
<button class="control" id="right" data-dir="right" aria-label="Kanan">▶</button>
<button class="control" id="down" data-dir="down" aria-label="Bawah">▼</button>
</div>
<div id="actions"><button class="action" id="action" type="button">A</button></div>
</div>
<div id="message" role="status" aria-live="polite"><h2 id="messageTitle"></h2><div class="message-text" id="messageBody"></div><button id="restart" type="button">MAIN LAGI</button></div>
</div>
<script>
(function(){
"use strict";
var G=${config},c=document.getElementById("game"),x=c.getContext("2d"),W=720,H=900,dpr=1,last=0,elapsed=0;
var input={up:false,down:false,left:false,right:false,action:false};
var state,started=false,tutorial=document.getElementById("tutorial"),message=document.getElementById("message");
var titleEl=document.getElementById("title"),statsEl=document.getElementById("stats"),objectiveEl=document.getElementById("objective");
window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;

function resize(){var r=c.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=Math.max(320,r.width);H=Math.max(520,r.height);c.width=Math.floor(W*dpr);c.height=Math.floor(H*dpr);x.setTransform(dpr,0,0,dpr,0,0)}
function reset(){state={px:360,py:420,dir:"down",hp:100,coins:120,creatures:0,steps:0,npcTalked:false,wildSeen:false,captured:false,stateChanges:0,objectiveChanges:0,won:false,lost:false,restartCount:0,dialog:"",dialogUntil:0,flash:0};message.style.display="none";updateHud()}
function setInput(k,v){input[k]=v}
function bindHold(el,key){el.addEventListener("pointerdown",function(e){e.preventDefault();el.setPointerCapture&&el.setPointerCapture(e.pointerId);setInput(key,true)});["pointerup","pointercancel","pointerleave"].forEach(function(t){el.addEventListener(t,function(e){e.preventDefault();setInput(key,false)})})}
document.querySelectorAll("[data-dir]").forEach(function(el){bindHold(el,el.getAttribute("data-dir"))});
var km={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",s:"down",a:"left",d:"right"," ":"action",Enter:"action"};
addEventListener("keydown",function(e){var k=km[e.key];if(k){e.preventDefault();setInput(k,true);if(k==="action")action()}});
addEventListener("keyup",function(e){var k=km[e.key];if(k)setInput(k,false)});
document.getElementById("action").addEventListener("pointerdown",function(e){e.preventDefault();action()});
document.getElementById("help").addEventListener("click",function(){tutorial.style.display="block"});
document.getElementById("start").addEventListener("click",function(){started=true;tutorial.style.display="none";reset()});
document.getElementById("restart").addEventListener("click",function(){reset();started=true});

function near(px,py,ox,oy,r){return Math.hypot(px-ox,py-oy)<r}
function action(){
 if(!started)return false;
 state.stateChanges++;
 if(near(state.px,state.py,500,385,65)){state.npcTalked=true;state.dialog="Profesor: Temukan creature liar di padang rumput!";state.dialogUntil=elapsed+3;state.objectiveChanges++;return true}
 if(near(state.px,state.py,585,480,75)&&!state.captured){state.wildSeen=true;state.captured=true;state.creatures=1;state.coins=Math.max(0,state.coins-20);state.dialog="Creature berhasil ditangkap! Ini partner pertamamu.";state.dialogUntil=elapsed+3;state.objectiveChanges++;state.won=true;return true}
 return true
}
function move(dt){
 var dx=(input.right?1:0)-(input.left?1:0),dy=(input.down?1:0)-(input.up?1:0);
 var moving=dx||dy;if(!moving)return;
 var len=Math.hypot(dx,dy)||1,speed=155;
 state.px=Math.max(45,Math.min(675,state.px+dx/len*speed*dt));
 state.py=Math.max(155,Math.min(H-55,state.py+dy/len*speed*dt));
 if(Math.abs(dx)>Math.abs(dy))state.dir=dx<0?"left":"right";else state.dir=dy<0?"up":"down";
 state.steps+=dt;state.stateChanges++;
}
function update(dt){if(!started||state.won)return;elapsed+=dt;move(dt);if(state.dialogUntil<elapsed)state.dialog="";if(state.wildSeen&&!state.captured)state.flash=Math.max(0,state.flash-dt);if(state.captured){state.won=true;showMessage("PETUALANGAN DIMULAI!","Kamu mendapatkan creature pertamamu. Selanjutnya James dapat mengembangkan battle, party, evolution, quest, gym, NPC relationship, dan dunia yang lebih luas.");}updateHud()}
function showMessage(t,b){document.getElementById("messageTitle").textContent=t;document.getElementById("messageBody").textContent=b;message.style.display="block"}
function updateHud(){titleEl.textContent=G.title;statsEl.textContent="HP "+state.hp+" · COIN "+state.coins+" · CREATURE "+state.creatures;objectiveEl.textContent=G.objective||"Jelajahi, bicara dengan NPC, temukan dan tangkap creature."}
function tree(px,py,s){x.fillStyle="#62452d";x.fillRect(px-5,py+s*.25,10,s*.75);x.fillStyle="#2e7040";x.fillRect(px-s*.5,py-s*.1,s,s*.7);x.fillStyle="#43834a";x.fillRect(px-s*.32,py-s*.35,s*.64,s*.45)}
function house(px,py){x.fillStyle="#b78a58";x.fillRect(px,py,150,85);x.fillStyle="#d56e3b";x.beginPath();x.moveTo(px-15,py);x.lineTo(px+75,py-65);x.lineTo(px+165,py);x.fill();x.fillStyle="#f2e4bd";x.fillRect(px+20,py+24,32,32);x.fillRect(px+98,py+24,32,32);x.fillStyle="#744a37";x.fillRect(px+64,py+40,25,45)}
function creature(px,py){x.save();x.translate(px,py);x.fillStyle="#f08b34";x.fillRect(-24,-18,48,38);x.fillStyle="#f7c96a";x.fillRect(-15,-8,30,20);x.fillStyle="#26343a";x.fillRect(-12,-8,6,6);x.fillRect(6,-8,6,6);x.fillStyle="#e35b45";x.fillRect(-31,-6,8,8);x.fillRect(23,-6,8,8);x.restore()}
function player(px,py){x.fillStyle="#0004";x.beginPath();x.ellipse(px,py+24,18,7,0,0,Math.PI*2);x.fill();x.fillStyle="#3d70b8";x.fillRect(px-13,py-3,26,29);x.fillStyle="#f1c39b";x.beginPath();x.arc(px,py-16,13,0,Math.PI*2);x.fill();x.fillStyle="#b83c38";x.fillRect(px-15,py-29,30,8);x.fillStyle="#f4e1bd";x.fillRect(px-12,py+26,9,8);x.fillRect(px+3,py+26,9,8)}
function npc(px,py){x.fillStyle="#eee2c4";x.fillRect(px-12,py-4,24,32);x.fillStyle="#d5b35d";x.beginPath();x.arc(px,py-17,14,0,Math.PI*2);x.fill();x.fillStyle="#39433a";x.fillRect(px-18,py-27,36,7)}
function draw(){
 x.fillStyle="#83b96d";x.fillRect(0,0,W,H);
 x.fillStyle="#6da25d";x.fillRect(0,H*.54,W,H*.46);
 for(var i=0;i<12;i++)tree(45+i*67,135+(i%3)*32,58);
 x.fillStyle="#c9b17a";x.fillRect(0,360,W,58);x.fillRect(330,120,60,H);
 house(70,165);house(490,165);
 x.fillStyle="#d8e0d2";x.fillRect(610,475,100,14);x.fillRect(610,490,100,14);x.fillRect(610,505,100,14);
 npc(505,385);
 if(!state.captured)creature(585,480);
 player(state.px,state.py);
 if(state.dialog){x.fillStyle="#18231ddd";x.strokeStyle="#e6cb78";x.lineWidth=2;x.beginPath();x.roundRect(state.px-125,state.py-92,250,48,12);x.fill();x.stroke();x.fillStyle="#fff";x.font="bold 11px system-ui";x.textAlign="center";x.fillText(state.dialog,state.px,state.py-63)}
 x.fillStyle="#fff";x.font="bold 12px system-ui";x.textAlign="left";x.fillText("JAMES 2D MONSTER WORLD",16,105);
 window.__RK_GAME_RENDERED__=true;
}
function loop(t){window.__RK_GAME_LOOP_STARTED__=true;var dt=Math.min(.05,(t-last)/1000||.016);last=t;update(dt);draw();requestAnimationFrame(loop)}
window.__RK_GAME_TEST__={
 getState:function(){return {x:state.px,y:state.py,dir:state.dir,creatures:state.creatures,npcTalked:state.npcTalked,wildSeen:state.wildSeen,captured:state.captured,stateChanges:state.stateChanges,objectiveChanges:state.objectiveChanges,won:state.won}},
 getPlayerState:function(){return {x:state.px,y:state.py,dir:state.dir}},
 getObjectiveState:function(){return {progress:state.captured?1:(state.npcTalked?0.5:0),status:state.won?"won":"playing"}},
 getWinState:function(){return state.won},
 getLoseState:function(){return state.lost},
 performTestAction:function(a){
   if(a==="move"){setInput("up",true);setInput("right",true);setTimeout(function(){setInput("up",false);setInput("right",false)},140);state.stateChanges++;return true}
   if(["up","down","left","right"].indexOf(a)>=0){setInput(a,true);setTimeout(function(){setInput(a,false)},140);state.stateChanges++;return true}
   if(a==="interact"||a==="talk"||a==="collect"||a==="action"){return action()}
   return false;
 },
 restart:function(){reset();started=true;return true},
 getTutorialState:function(){return {available:true,visible:tutorial.style.display!=="none"}},
 getControlState:function(){return {up:true,down:true,left:true,right:true}}
};
resize();reset();window.__RK_GAME_READY__=true;requestAnimationFrame(loop);
})();</script>
</body>
</html>`;
}
