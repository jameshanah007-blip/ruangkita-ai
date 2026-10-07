import type { GameSpecification2D, GenreRuntimePlan } from "./types";

const esc=(s:string)=>String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]||c));

export function build2DRuntimeHtml(spec:GameSpecification2D, plan:GenreRuntimePlan):string{
  const payload=JSON.stringify({
    title:spec.title||"James 2D Game",
    objective:spec.objective||"Selesaikan objective permainan.",
    genre:spec.genre,
    systems:spec.systems,
    runtimeId:plan.runtimeId,
    label:plan.label,
    tutorial:plan.tutorial,
    testActions:plan.testActions,
  }).replace(/</g,"\\u003c");
  const moduleScript=plan.script.replace(/<\\/script/gi,"<\\/script");
  const palette=plan.palette;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><title>${esc(spec.title)}</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${palette.background};color:${palette.light};font-family:system-ui,sans-serif}
body{display:flex;justify-content:center}#root{position:relative;width:min(100vw,1100px);height:100dvh;min-height:520px;overflow:hidden;background:${palette.background}}
canvas{display:block;width:100%;height:100%;touch-action:none;image-rendering:pixelated}
#hud{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.card{background:${palette.panel}e8;border:1px solid ${palette.light}30;border-radius:13px;padding:8px 11px;font-size:11px;line-height:1.35;max-width:66%;backdrop-filter:blur(4px)}
#objective{position:absolute;top:72px;left:50%;transform:translateX(-50%);max-width:88%;padding:7px 12px;border-radius:999px;background:${palette.panel}dd;border:1px solid ${palette.accent}66;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tutorial{position:absolute;inset:0;display:grid;place-items:center;padding:20px;background:#000b;z-index:10}
#tutorial .box{width:min(92vw,470px);padding:22px;border-radius:20px;background:${palette.panel};border:2px solid ${palette.accent};box-shadow:0 24px 80px #000b}
#tutorial h2{margin:0 0 8px;font-size:22px}#tutorial p{font-size:12px;line-height:1.6;color:${palette.light}dd}
.tag{display:inline-block;margin:4px 4px 0 0;padding:6px 9px;border-radius:9px;background:${palette.ground};font-size:10px;border:1px solid #fff2}
button{border:0;border-radius:12px;font-weight:900;cursor:pointer}
#start,#restart{padding:11px 18px;background:${palette.accent};color:${palette.background}}
#controls{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:space-between;align-items:end;padding:0 14px;pointer-events:none;z-index:8}
.pad,.actions{pointer-events:auto}.pad{position:relative;width:170px;height:158px}.control{position:absolute;width:54px;height:54px;border:1px solid #fff3;background:${palette.panel}ee;color:${palette.light};font-size:20px;touch-action:none;user-select:none}
#up{left:58px;top:0}#left{left:0;top:52px}#right{right:0;top:52px}#down{left:58px;bottom:0}#action{position:relative;width:66px;height:66px;border-radius:50%;background:${palette.danger};color:#fff}
#message{display:none;position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:min(88%,390px);padding:22px;border-radius:20px;background:${palette.panel};border:2px solid ${palette.accent};text-align:center;z-index:12;box-shadow:0 24px 90px #000b}
#message h2{margin:0 0 8px}.msg{font-size:12px;line-height:1.55;color:${palette.light}dd}
@media(min-width:760px){#controls{display:none}}@media(max-width:420px){.control{width:50px;height:50px}#up,#down{left:55px}.pad{width:160px;height:150px}}
</style></head><body><div id="root">
<canvas id="game" aria-label="${esc(plan.label)}"></canvas>
<div id="hud"><div class="card"><b id="title"></b><br><span id="stats"></span></div><div class="card"><b id="genre"></b><br><span>${esc(plan.label)}</span></div></div>
<div id="objective"></div>
<div id="tutorial"><div class="box"><h2>${esc(plan.tutorial.title)}</h2><p>${esc(plan.tutorial.body)}</p><div><span class="tag">W A S D</span><span class="tag">Arrow Keys</span><span class="tag">Android D-pad</span><span class="tag">A / Space / Enter</span></div><p style="margin-bottom:14px"><b>Tujuan:</b> ${esc(spec.objective)}</p><button id="start">MULAI GAME</button></div></div>
<div id="controls"><div class="pad"><button class="control" id="up" data-dir="up">▲</button><button class="control" id="left" data-dir="left">◀</button><button class="control" id="right" data-dir="right">▶</button><button class="control" id="down" data-dir="down">▼</button></div><div class="actions"><button id="action" data-dir="action">A</button></div></div>
<div id="message"><h2 id="messageTitle"></h2><div class="msg" id="messageBody"></div><button id="restart">MAIN LAGI</button></div>
<script>(function(){
"use strict";
var SPEC=${payload};
var canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
var W=720,H=900,dpr=1,last=0,elapsed=0,started=false,won=false,lost=false,raf=0;
var input={up:false,down:false,left:false,right:false,action:false};
var runtimeState=null;
function resize(){var r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=Math.max(320,r.width);H=Math.max(520,r.height);canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function text(t,x,y,s){ctx.font="bold "+(s||12)+"px system-ui";ctx.fillStyle="#fff";ctx.fillText(t,x,y)}
function startGame(){started=true;document.getElementById("tutorial").style.display="none"}
function showMessage(t,b){document.getElementById("messageTitle").textContent=t;document.getElementById("messageBody").textContent=b;document.getElementById("message").style.display="block"}
function hideMessage(){document.getElementById("message").style.display="none"}
function setKey(k,v){input[k]=v}
function commonMove(speed,dt){var dx=(input.right?1:0)-(input.left?1:0),dy=(input.down?1:0)-(input.up?1:0);if(dx&&dy){dx*=.707;dy*=.707}if(!runtimeState||(!dx&&!dy))return false;runtimeState.x=clamp(runtimeState.x+dx*speed*dt,35,W-35);runtimeState.y=clamp(runtimeState.y+dy*speed*dt,95,H-55);runtimeState.steps=(runtimeState.steps||0)+Math.abs(dx)+Math.abs(dy);return true}
function finish(win,title,body){if(win){won=true;runtimeState.won=true}else{lost=true;runtimeState.lost=true}showMessage(title,body)}
${moduleScript}
function commonHud(){document.getElementById("title").textContent=SPEC.title;document.getElementById("genre").textContent=SPEC.genre.toUpperCase()+" · 2D";document.getElementById("objective").textContent=SPEC.objective;document.getElementById("stats").textContent=genreStats()}
function genreStats(){return typeof getGenreStats==="function"?String(getGenreStats()):"Playing"}
document.getElementById("start").onclick=function(){startGame();if(typeof onStart==="function")onStart();};
document.getElementById("restart").onclick=function(){restartGame();started=true;hideMessage();};
function bind(el,k){el.addEventListener("pointerdown",function(e){e.preventDefault();el.setPointerCapture&&el.setPointerCapture(e.pointerId);setKey(k,true);if(k==="action")performGameAction("action")});["pointerup","pointercancel","pointerleave"].forEach(function(t){el.addEventListener(t,function(e){e.preventDefault();setKey(k,false)})})}
document.querySelectorAll("[data-dir]").forEach(function(el){bind(el,el.getAttribute("data-dir"))});
var keymap={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",a:"left",s:"down",d:"right"," ":"action",Enter:"action",e:"action",E:"action"};
addEventListener("keydown",function(e){var k=keymap[e.key];if(!k)return;e.preventDefault();setKey(k,true);if(k==="action"&&!e.repeat)performGameAction("action")});
addEventListener("keyup",function(e){var k=keymap[e.key];if(k)setKey(k,false)});
resize();commonHud();window.__RK_GAME_READY__=true;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;
window.__RK_2D_ENGINE_V2__={version:"2.0.0",genre:SPEC.genre,systems:SPEC.systems,sceneCount:Array.isArray(SPEC.scenes)?SPEC.scenes.length:0,runtimeId:SPEC.runtimeId,label:SPEC.label,architecture:"core+scene+genre-module"};
window.__RK_GAME_TEST__={
getState:function(){return runtimeState?JSON.parse(JSON.stringify(runtimeState)):{started:started,won:won,lost:lost}},
getPlayerState:function(){return runtimeState?{x:runtimeState.x,y:runtimeState.y,hp:runtimeState.hp||runtimeState.health||0}:{x:0,y:0}},
getObjectiveState:function(){return runtimeState&&typeof getObjectiveState==="function"?getObjectiveState():{progress:0,status:won?"won":lost?"lost":"playing"}},
getWinState:function(){return won===true},
getLoseState:function(){return lost===true},
getTutorialState:function(){return {available:true,visible:document.getElementById("tutorial").style.display!=="none"}},
getControlState:function(){return {up:true,down:true,left:true,right:true}},
testDirectionalControl:function(direction){if(typeof testDirection==="function")return testDirection(direction);return false},
getGenreState:function(){return typeof getGenreState==="function"?getGenreState():{}},
performTestAction:function(action){started=true;return typeof performGameAction==="function"?performGameAction(action)===true:false},
restart:function(){restartGame();started=true;hideMessage();return true}
};
function loop(now){var dt=Math.min(.05,(now-last)/1000||.016);last=now;elapsed+=dt;if(started&&!won&&!lost&&typeof updateGame==="function")updateGame(dt);if(typeof renderGame==="function")renderGame();commonHud();window.__RK_GAME_LOOP_STARTED__=true;window.__RK_GAME_RENDERED__=true;raf=requestAnimationFrame(loop)}
requestAnimationFrame(loop);
})();</script></body></html>`;
}
