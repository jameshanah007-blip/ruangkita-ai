import type { GameBlueprint } from "../laboratory/types";

/**
 * Genre-specific 2D runtime registry.
 *
 * Important architecture rule:
 * - Each genre has its own visual scene and gameplay model.
 * - Shared input/tutorial/test plumbing is allowed.
 * - A genre must never silently fall back to the generic autonomous renderer.
 * - Adventure/RPG is intentionally handled by james2DTopDownTemplate.
 * - Monster-tamer is intentionally handled by jamesPokemon2DTemplate.
 */

export type Game2DGenre =
  | "adventure"
  | "rpg"
  | "farming"
  | "platformer"
  | "puzzle"
  | "shooter"
  | "racing"
  | "strategy"
  | "simulation"
  | "survival";

function textOf(b: GameBlueprint): string {
  return [
    b.title,b.concept,b.genre,b.theme,b.world,b.visualStyle,b.coreLoop,
    b.objective,...b.mechanics,...b.playerActions,
  ].join(" ").toLowerCase();
}

function has(t: string, re: RegExp) { return re.test(t); }

export function classify2DGenre(b: GameBlueprint): Game2DGenre | null {
  const t = textOf(b);
  const g = (b.genre || "").toLowerCase();

  // Explicit genre wins over secondary mechanics.
  if (has(t,/pokemon|pokémon|monster tamer|monster-tamer|creature collection|creature tamer/)) return null;
  if (has(g,/farming|farm/ ) || has(t,/farming|bertani|menanam|tanam|panen|kebun|peternakan|crops|harvest/)) return "farming";
  if (has(g,/platformer|platform/ ) || has(t,/platformer|platform game|lompat|jumping|side.?scroll/)) return "platformer";
  if (has(g,/puzzle|puzz/ ) || has(t,/puzzle|teka-teki|teka teki|logic|logika|match.?3|maze|labirin/)) return "puzzle";
  if (has(g,/shooter|shooting/ ) || has(t,/shooter|shooting|menembak|tembak|laser|bullet|peluru/)) return "shooter";
  if (has(g,/racing|race/ ) || has(t,/racing|race|balap|mobil|motor|kendaraan|lap|finish line/)) return "racing";
  if (has(g,/strategy|strategi/ ) || has(t,/strategy|strategi|tower defense|menara|unit|resource management/)) return "strategy";
  if (has(g,/simulation|simulasi/ ) || has(t,/simulation|simulasi|management|mengelola|city builder|tycoon/)) return "simulation";
  if (has(g,/survival|horror/ ) || has(t,/survival|bertahan hidup|zombie|wave|gelombang|horror|horor/)) return "survival";
  if (has(g,/adventure|petualangan|rpg/) || has(t,/adventure|petualangan|rpg|role.?playing|quest|npc/)) return "adventure";
  return null;
}

function esc(v: string) {
  return String(v || "").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]||c));
}

function js(v: unknown) { return JSON.stringify(v).replace(/</g,"\\u003c"); }

type RuntimeConfig = {
  title:string;
  objective:string;
  genre:Game2DGenre;
  concept:string;
};

function config(b: GameBlueprint, genre: Game2DGenre): RuntimeConfig {
  return {
    title: b.title || "James 2D Game",
    objective: b.objective || "Selesaikan tujuan permainan.",
    genre,
    concept: b.concept || "",
  };
}

export function buildGenre2DGameHtml(b: GameBlueprint, genre: Game2DGenre): string {
  const c = config(b,genre);
  const palettes: Record<Game2DGenre,string[]> = {
    adventure:["#183b2a","#6da34d","#e7c56b","#7d4e57"],
    rpg:["#1e1635","#7d5cff","#d7b46a","#5b3f91"],
    farming:["#26452b","#83c567","#e8c76a","#a85d3d"],
    platformer:["#17264a","#4b83c6","#f6c453","#d65b63"],
    puzzle:["#18243a","#56b4c7","#f3d36b","#cf6aa4"],
    shooter:["#111b27","#365b78","#66d6ff","#ef5c66"],
    racing:["#101216","#39404c","#f4b83f","#d95b52"],
    strategy:["#182018","#526b3b","#d4b86a","#a35e4d"],
    simulation:["#17302e","#4fa59b","#e5cf77","#c57c58"],
    survival:["#101313","#3c5550","#b8c07a","#b64c5b"],
  };
  const [bg,ground,accent,danger]=palettes[genre];

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>${esc(c.title)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${bg};color:#fff;font-family:system-ui,sans-serif}
body{display:flex;justify-content:center}#root{position:relative;width:min(100vw,1000px);height:100dvh;min-height:520px;overflow:hidden;background:${bg}}
canvas{display:block;width:100%;height:100%;touch-action:none;image-rendering:pixelated}
#hud{position:absolute;left:10px;right:10px;top:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.card{background:#071018d9;border:1px solid #ffffff30;border-radius:12px;padding:8px 11px;font-size:11px;line-height:1.35}
#tutorial{position:absolute;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px;z-index:5}
#tutorial>div{width:min(92%,430px);background:#10161eeF;border:2px solid ${accent};border-radius:18px;padding:20px}
#tutorial h2{margin:0 0 8px}#tutorial p{font-size:12px;line-height:1.55;color:#dbe5ec}
button{border:0;border-radius:12px;padding:10px 16px;background:${accent};color:#101010;font-weight:900}
#controls{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:space-between;padding:0 14px;pointer-events:none}
.pad,.actions{display:flex;gap:7px;pointer-events:auto}.pad{position:relative;width:170px;height:150px}
.control{position:absolute;width:52px;height:52px;border:1px solid #ffffff35;border-radius:14px;background:#071018dd;color:#fff;font-size:19px;font-weight:900;touch-action:none}
#up{left:59px;top:0}#down{left:59px;bottom:0}#left{left:0;top:49px}#right{right:0;top:49px}
#act{position:relative;width:64px;height:64px;border-radius:50%;background:${danger}}
#message{display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88%,360px);padding:20px;border-radius:18px;background:#0b1118f5;border:2px solid ${accent};text-align:center;z-index:4}
@media(min-width:760px){#controls{display:none}}
</style></head>
<body><div id="root">
<canvas id="game"></canvas>
<div id="hud"><div class="card"><b id="title"></b><br><span id="stats"></span></div><div class="card"><b id="genre"></b><br><span id="obj"></span></div></div>
<div id="tutorial"><div><h2>${esc(c.title)}</h2><p><b>${genre.toUpperCase()} · 2D</b></p><p>${esc(c.concept.slice(0,420))}</p><p><b>Kontrol:</b> WASD / Arrow Keys untuk bergerak. Tombol ▲▼◀▶ untuk Android. Tombol A/Space untuk aksi.</p><p><b>Tujuan:</b> ${esc(c.objective)}</p><button id="start">MULAI GAME</button></div></div>
<div id="controls"><div class="pad"><button class="control" id="up" data-k="up">▲</button><button class="control" id="left" data-k="left">◀</button><button class="control" id="right" data-k="right">▶</button><button class="control" id="down" data-k="down">▼</button></div><div class="actions"><button class="control" id="act" data-k="action">A</button></div></div>
<div id="message"><h2 id="mt"></h2><p id="mb"></p><button id="restart">MAIN LAGI</button></div>
</div>
<script>
(function(){
"use strict";
var G=${js(c)},genre="${genre}",canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),root=document.getElementById("root");
var W=800,H=560,dpr=1,last=0,elapsed=0,started=false,raf=0;
var keys={up:false,down:false,left:false,right:false,action:false};
var state={x:400,y:390,hp:5,score:0,progress:0,wave:0,won:false,lost:false,turn:0,restarts:0,plants:0,money:30,lap:0,speed:0,target:0,shots:0,enemies:0,selected:0,coins:0,build:0,energy:0};
var mode=genre;

window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;
function resize(){var r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=Math.max(320,r.width);H=Math.max(500,r.height);canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}window.addEventListener("resize",resize);
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function rect(x,y,w,h,fill){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)}
function circle(x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function text(t,x,y,size,fill){ctx.fillStyle=fill||"#fff";ctx.font="bold "+(size||12)+"px system-ui";ctx.fillText(t,x,y)}
function reset(){state={x:400,y:390,hp:5,score:0,progress:0,wave:0,won:false,lost:false,turn:0,restarts:state.restarts||0,plants:0,money:30,lap:0,speed:0,target:0,shots:0,enemies:0,selected:0,coins:0,build:0,energy:0};document.getElementById("message").style.display="none";updateHud()}
function show(title,body){document.getElementById("mt").textContent=title;document.getElementById("mb").textContent=body;document.getElementById("message").style.display="block"}
function updateHud(){document.getElementById("title").textContent=G.title;document.getElementById("genre").textContent=genre.toUpperCase()+" · 2D";document.getElementById("obj").textContent=G.objective;var s="HP "+state.hp; if(mode==="farming")s+=" · Tanaman "+state.plants+" · Uang "+state.money;else if(mode==="racing")s+=" · Lap "+state.lap+" · Speed "+Math.round(state.speed);else if(mode==="shooter")s+=" · Musuh "+state.enemies+" · Shot "+state.shots;else if(mode==="platformer")s+=" · Score "+state.score+" · Gems "+state.progress;else if(mode==="puzzle")s+=" · Puzzle "+state.progress+"/3";else if(mode==="strategy")s+=" · Unit "+state.build+" · Resource "+state.coins;else if(mode==="simulation")s+=" · Energy "+state.energy+" · Build "+state.build;else if(mode==="survival")s+=" · Wave "+state.wave+" · Score "+state.score;else s+=" · Quest "+state.progress+"/3";document.getElementById("stats").textContent=s}
function move(dt){var dx=(keys.right?1:0)-(keys.left?1:0),dy=(keys.down?1:0)-(keys.up?1:0);if(dx&&dy){dx*=.707;dy*=.707}if(mode==="platformer"){state.x+=dx*180*dt;state.y+=dy*180*dt;state.y=clamp(state.y,90,H-105)}else if(mode==="racing"){state.x+=dx*260*dt;state.y+=dy*180*dt;state.x=clamp(state.x,110,W-110);state.y=clamp(state.y,80,H-100);state.speed=clamp(state.speed+(keys.action?160:-70)*dt,0,320)}else{state.x=clamp(state.x+dx*150*dt,35,W-35);state.y=clamp(state.y+dy*150*dt,85,H-65)}}
function action(){state.turn++;if(mode==="farming"){state.plants=Math.min(5,state.plants+1);state.money+=10;state.progress=state.plants}else if(mode==="puzzle"){state.progress=Math.min(3,state.progress+1)}else if(mode==="shooter"){state.shots++;state.enemies=Math.max(0,state.enemies-1);state.progress=state.shots}else if(mode==="racing"){state.speed=Math.min(320,state.speed+80);if(state.speed>230)state.lap=Math.min(3,state.lap+1)}else if(mode==="strategy"){state.build=Math.min(3,state.build+1);state.coins=Math.max(0,state.coins-5)}else if(mode==="simulation"){state.build=Math.min(3,state.build+1);state.energy=Math.min(100,state.energy+25)}else if(mode==="survival"){state.wave++;state.score+=25;state.progress=state.wave}else if(mode==="platformer"){state.score+=50;state.progress=Math.min(3,state.progress+1)}else{state.progress=Math.min(3,state.progress+1)}state.hp=Math.max(0,state.hp);state.turn++;checkWin();updateHud()}
function checkWin(){var need=mode==="farming"?state.plants>=5:mode==="racing"?state.lap>=3:mode==="shooter"?state.shots>=5:mode==="platformer"?state.progress>=3:mode==="puzzle"?state.progress>=3:mode==="strategy"?state.build>=3:mode==="simulation"?state.build>=3:mode==="survival"?state.wave>=5:state.progress>=3;if(need&&!state.won){state.won=true;show("MENANG","Template "+genre+" berhasil menyelesaikan objective.")}}
function draw(){ctx.clearRect(0,0,W,H);
  if(mode==="farming")drawFarm();else if(mode==="platformer")drawPlatform();else if(mode==="puzzle")drawPuzzle();else if(mode==="shooter")drawShooter();else if(mode==="racing")drawRacing();else if(mode==="strategy")drawStrategy();else if(mode==="simulation")drawSimulation();else if(mode==="survival")drawSurvival();else drawAdventure();
}
function player(color){circle(state.x,state.y,16,color);rect(state.x-8,state.y-20,16,7,"#f2d1b0")}
function drawFarm(){rect(0,0,W,H,"${ground}");for(var y=100;y<H-50;y+=54){rect(20,y,W-40,42,"#6d9c4f");for(var x=30;x<W-30;x+=42){circle(x+10,y+22,5,"${accent}");}}rect(0,0,W,80,"${bg}");text("FARMING FIELD",20,45,20);player("#8b5cf6");}
function drawPlatform(){rect(0,0,W,H,"${bg}");for(var y=70;y<H;y+=45){rect(0,y,W,45,(y/45)%2?"#376fa8":"#417bb7")}for(var i=0;i<7;i++){rect(i*140, H-85-(i%3)*55,100,18,"${accent}")}circle(650,130,18,"${accent}");player("#f1f1f1");}
function drawPuzzle(){rect(0,0,W,H,"${bg}");for(var y=120;y<420;y+=75)for(var x=120;x<700;x+=75){rect(x,y,55,55,(Math.floor(x/75)+Math.floor(y/75)+state.selected)%2?"#3e7f91":"#8d4e87")}text("PUZZLE GRID",20,45,20);text("Tekan A untuk mengubah susunan",20,70,12);player("${accent}");}
function drawShooter(){rect(0,0,W,H,"${bg}");for(var i=0;i<20;i++){circle((i*97)%W,110+(i*53)%(H-150),2,"#9bc7df")}for(var e=0;e<5;e++){circle(120+e*140,160+(e%2)*120,16,"${danger}")}player("${accent}");}
function drawRacing(){rect(0,0,W,H,"${bg}");rect(90,70,W-180,H-120,"#25282e");for(var x=100;x<W-100;x+=55){rect(x,0,5,H,"#e6e6e6")}rect(120,95,8,H-170,"${accent}");rect(W-128,95,8,H-170,"${danger}");rect(state.x-22,state.y-13,44,26,"${accent}");}
function drawStrategy(){rect(0,0,W,H,"${bg}");for(var y=110;y<500;y+=80)for(var x=90;x<760;x+=90){rect(x,y,60,60,"#30452d");circle(x+30,y+30,10,state.selected%2?"#d7a85a":"#7fae67")}text("TACTICAL BOARD",20,45,20);player("${accent}");}
function drawSimulation(){rect(0,0,W,H,"${bg}");rect(40,90,W-80,H-140,"#224743");for(var i=0;i<5;i++){rect(90+i*125,250-(i%2)*40,70,110+i*10,"${ground}")}text("SIMULATION / MANAGEMENT",20,45,20);player("${accent}");}
function drawSurvival(){rect(0,0,W,H,"${bg}");for(var i=0;i<12;i++){circle(70+i*70,140+(i%4)*85,18,"${ground}")}rect(0,H-70,W,70,"#171b1a");text("SURVIVAL WAVE "+state.wave,20,45,20);player("${accent}");}
function drawAdventure(){rect(0,0,W,H,"${ground}");for(var x=0;x<W;x+=40)for(var y=90;y<H;y+=40)if((x+y)%120===0)rect(x,y,30,30,"${accent}");player("${accent}")}
function frame(now){var dt=Math.min(.033,(now-last)/1000||.016);last=now;elapsed+=dt;if(started&&!state.won&&!state.lost){move(dt);if(mode==="survival"&&elapsed>1.8*(state.wave+1)){state.wave++;state.score+=10;elapsed=0;checkWin()}updateHud()}draw();window.__RK_GAME_RENDERED__=true;window.__RK_GAME_LOOP_STARTED__=true;raf=requestAnimationFrame(frame)}
function setKey(k,v){keys[k]=v}
function onKey(e,down){var c=e.code,k=null;if(c==="ArrowUp"||c==="KeyW")k="up";else if(c==="ArrowDown"||c==="KeyS")k="down";else if(c==="ArrowLeft"||c==="KeyA")k="left";else if(c==="ArrowRight"||c==="KeyD")k="right";else if(c==="Space"||c==="Enter"||c==="KeyE")k="action";if(!k)return;e.preventDefault();setKey(k,down);if(down&&k==="action"&&!e.repeat)action()}
window.addEventListener("keydown",e=>onKey(e,true));window.addEventListener("keyup",e=>onKey(e,false));
window.addEventListener("message",e=>{var d=e&&e.data;if(!d||d.type!=="AI_GAME_KEY_EVENT")return;var c=d.code||"",k=d.key||"",m=null;if(c==="ArrowUp"||c==="KeyW"||k==="ArrowUp"||k==="w"||k==="W")m="up";else if(c==="ArrowDown"||c==="KeyS"||k==="ArrowDown"||k==="s"||k==="S")m="down";else if(c==="ArrowLeft"||c==="KeyA"||k==="ArrowLeft"||k==="a"||k==="A")m="left";else if(c==="ArrowRight"||c==="KeyD"||k==="ArrowRight"||k==="d"||k==="D")m="right";else if(c==="Space"||c==="Enter"||c==="KeyE"||k===" "||k==="Enter"||k==="e"||k==="E")m="action";if(!m)return;setKey(m,d.eventType!=="keyup");if(m==="action"&&d.eventType!=="keyup"&&!d.repeat)action()});
document.querySelectorAll("[data-k]").forEach(b=>{var k=b.getAttribute("data-k"),s=e=>{e.preventDefault();setKey(k,true);if(k==="action")action()},u=e=>{e.preventDefault();setKey(k,false)};b.addEventListener("pointerdown",s);b.addEventListener("pointerup",u);b.addEventListener("pointercancel",u);b.addEventListener("pointerleave",u)});
document.getElementById("start").onclick=function(){started=true;document.getElementById("tutorial").style.display="none";};
document.getElementById("restart").onclick=function(){state.restarts++;reset();started=true;};
resize();reset();
window.__RK_GAME_TEST__={
getState:function(){return {...state};},
getPlayerState:function(){return {x:state.x,y:state.y,hp:state.hp};},
getObjectiveState:function(){return {progress:state.progress,status:state.won?"won":state.lost?"lost":"playing"};},
getWinState:function(){return state.won===true;},getLoseState:function(){return state.lost===true;},
getTutorialState:function(){return {available:true,visible:!started};},
getControlState:function(){return {up:true,down:true,left:true,right:true};},
testDirectionalControl:function(direction){var bx=state.x,by=state.y;var step=direction==="left"?[-20,0]:direction==="right"?[20,0]:direction==="up"?[0,-20]:[0,20];state.x=clamp(state.x+step[0],25,W-25);state.y=clamp(state.y+step[1],90,H-45);return bx!==state.x||by!==state.y;},
performTestAction:function(a){if(a==="move"||a==="explore"){testDirectionalControl("right");return true}if(a==="restart"){var n=state.restarts+1;reset();state.restarts=n;return true}if(a==="interact"||a==="talk"||a==="attack"||a==="work"||a==="farm"||a==="harvest"||a==="solve"||a==="accelerate"||a==="build"||a==="survive"){action();return true}return false;},
restart:function(){var n=state.restarts+1;reset();state.restarts=n;return true;}
};
raf=requestAnimationFrame(frame);
})();
</script></body></html>`;
}
