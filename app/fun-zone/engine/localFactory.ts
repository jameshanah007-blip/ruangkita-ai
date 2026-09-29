import type { GameBlueprint } from "../laboratory/types";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] || char));
}

export function buildLocalGameHtml(blueprint: GameBlueprint): string {
  const title = esc(blueprint.title);
  const objective = esc(blueprint.objective);
  const theme = esc(blueprint.theme);

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07111f;color:#fff;font-family:system-ui,sans-serif}
body{display:flex;align-items:center;justify-content:center}
#game{position:relative;width:min(100vw,720px);height:100dvh;max-height:900px;min-height:480px;background:#0b1728;overflow:hidden;touch-action:none}
canvas{display:block;width:100%;height:100%;min-height:480px;background:linear-gradient(#102744,#07111f)}
#hud{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none;font-size:12px}
.panel{background:rgba(0,0,0,.48);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:7px 10px;backdrop-filter:blur(4px)}
#message{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);display:none;text-align:center;background:rgba(3,10,20,.9);border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:18px;min-width:220px;max-width:90%}
#message button{margin-top:12px;border:0;border-radius:12px;padding:10px 18px;font-weight:700;background:#22d3ee;color:#03111b}
#controls{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:space-between;padding:0 14px;pointer-events:none}
.pad,.actions{display:flex;gap:10px;pointer-events:auto}
button.ctrl{width:58px;height:58px;border-radius:18px;border:1px solid rgba(255,255,255,.2);background:rgba(10,25,45,.78);color:white;font-size:20px;font-weight:800;touch-action:none;user-select:none}
button.ctrl:active{transform:scale(.96);background:rgba(34,211,238,.45)}
#hint{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);font-size:10px;color:rgba(255,255,255,.55);white-space:nowrap;pointer-events:none}
</style>
</head>
<body>
<div id="game">
<canvas id="gameCanvas"></canvas>
<div id="hud">
  <div class="panel"><b>${title}</b><br><span id="hp">HP 100</span></div>
  <div class="panel"><span id="orb">Energy 0/3</span><br><span id="status">PLAYING</span></div>
</div>
<div id="hint">${objective} · ${theme}</div>
<div id="controls">
  <div class="pad">
    <button class="ctrl" data-action="left" aria-label="left">◀</button>
    <button class="ctrl" data-action="up" aria-label="up">▲</button>
    <button class="ctrl" data-action="down" aria-label="down">▼</button>
    <button class="ctrl" data-action="right" aria-label="right">▶</button>
  </div>
  <div class="actions">
    <button class="ctrl" data-action="action" aria-label="action">●</button>
  </div>
</div>
<div id="message"><div id="messageText"></div><button id="restart">RESTART</button></div>
</div>
<script>
(function(){
"use strict";
var canvas=document.getElementById("gameCanvas");
var ctx=canvas&&canvas.getContext("2d");
window.__RK_GAME_READY__=false;
window.__RK_GAME_RENDERED__=false;
window.__RK_GAME_LOOP_STARTED__=false;

var state={
  player:{x:80,y:220,size:22,health:100,score:0},
  orbs:[
    {x:260,y:150,taken:false},
    {x:430,y:310,taken:false},
    {x:170,y:390,taken:false}
  ],
  enemy:{x:520,y:210,size:24,active:true},
  portal:{x:650,y:430,size:30},
  status:"playing",
  tick:0
};
var input={left:false,right:false,up:false,down:false,action:false};
var last=0;
var width=720,height=900;

function resize(){
  if(!canvas||!ctx)return;
  var rect=canvas.getBoundingClientRect();
  width=Math.max(320,rect.width);
  height=Math.max(480,rect.height);
  var dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.floor(width*dpr);
  canvas.height=Math.floor(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  state.player.x=Math.min(state.player.x,width-30);
  state.player.y=Math.min(state.player.y,height-150);
}
function reset(){
  state.player={x:80,y:Math.min(220,height-170),size:22,health:100,score:0};
  state.orbs=[
    {x:width*.36,y:height*.28,taken:false},
    {x:width*.68,y:height*.45,taken:false},
    {x:width*.28,y:height*.62,taken:false}
  ];
  state.enemy={x:width*.72,y:height*.30,size:24,active:true};
  state.portal={x:width*.86,y:height*.78,size:30};
  state.status="playing"; state.tick=0;
  document.getElementById("message").style.display="none";
  updateHud();
}
function setInput(action,value){if(Object.prototype.hasOwnProperty.call(input,action))input[action]=value;}
function bindButton(button){
  var action=button.getAttribute("data-action");
  ["pointerdown","pointerup","pointercancel","pointerleave"].forEach(function(type){
    button.addEventListener(type,function(e){
      e.preventDefault();
      setInput(action,type==="pointerdown");
    });
  });
}
document.querySelectorAll(".ctrl").forEach(bindButton);
window.addEventListener("keydown",function(e){
  var map={ArrowLeft:"left",a:"left",ArrowRight:"right",d:"right",ArrowUp:"up",w:"up",ArrowDown:"down",s:"down"," ":"action",Enter:"action"};
  var action=map[e.key]; if(action){e.preventDefault();setInput(action,true);}
});
window.addEventListener("keyup",function(e){
  var map={ArrowLeft:"left",a:"left",ArrowRight:"right",d:"right",ArrowUp:"up",w:"up",ArrowDown:"down",s:"down"," ":"action",Enter:"action"};
  var action=map[e.key]; if(action)setInput(action,false);
});
document.getElementById("restart").addEventListener("click",reset);

function dist(a,b){var dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}
function update(dt){
  if(state.status!=="playing")return;
  var speed=170*dt;
  if(input.left)state.player.x-=speed;
  if(input.right)state.player.x+=speed;
  if(input.up)state.player.y-=speed;
  if(input.down)state.player.y+=speed;
  state.player.x=Math.max(15,Math.min(width-15,state.player.x));
  state.player.y=Math.max(65,Math.min(height-75,state.player.y));

  state.orbs.forEach(function(orb){
    if(!orb.taken&&dist(state.player,orb)<30){orb.taken=true;state.player.score++;}
  });
  if(state.enemy.active&&dist(state.player,state.enemy)<38){
    state.player.health=Math.max(0,state.player.health-20*dt);
    if(state.player.health<=0)finish(false);
  }
  if(state.player.score>=3&&dist(state.player,state.portal)<45)finish(true);
  state.tick++;
  updateHud();
}
function finish(won){
  state.status=won?"won":"lost";
  document.getElementById("status").textContent=won?"WIN":"LOSE";
  document.getElementById("messageText").textContent=won?"🏆 Mission complete!":"💫 Game over.";
  document.getElementById("message").style.display="block";
}
function draw(){
  if(!ctx)return;
  ctx.clearRect(0,0,width,height);
  var g=ctx.createLinearGradient(0,0,0,height);g.addColorStop(0,"#17365d");g.addColorStop(1,"#07111f");ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
  ctx.fillStyle="rgba(255,255,255,.05)";
  for(var i=0;i<24;i++){ctx.beginPath();ctx.arc((i*97)%width,90+((i*151)%Math.max(100,height-130)),2,0,Math.PI*2);ctx.fill();}
  state.orbs.forEach(function(o){if(o.taken)return;ctx.fillStyle="#22d3ee";ctx.beginPath();ctx.arc(o.x,o.y,10+Math.sin(state.tick*.08)*2,0,Math.PI*2);ctx.fill();});
  if(state.enemy.active){ctx.fillStyle="#fb7185";ctx.fillRect(state.enemy.x-12,state.enemy.y-12,24,24);}
  ctx.strokeStyle=state.player.score>=3?"#34d399":"#64748b";ctx.lineWidth=4;ctx.beginPath();ctx.arc(state.portal.x,state.portal.y,state.portal.size,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="#f8fafc";ctx.fillRect(state.player.x-11,state.player.y-11,22,22);
  ctx.fillStyle="#22d3ee";ctx.fillRect(state.player.x-8,state.player.y-8,16,16);
  window.__RK_GAME_RENDERED__=true;
}
function updateHud(){
  document.getElementById("hp").textContent="HP "+Math.ceil(state.player.health);
  document.getElementById("orb").textContent="Energy "+state.player.score+"/3";
}
function loop(ts){
  window.__RK_GAME_LOOP_STARTED__=true;
  var dt=Math.min(.05,(ts-last)/1000||.016);last=ts;
  update(dt);draw();requestAnimationFrame(loop);
}
window.__RK_GAME_TEST__={
  getState:function(){return JSON.parse(JSON.stringify(state));},
  getPlayerState:function(){return JSON.parse(JSON.stringify(state.player));},
  getObjectiveState:function(){return {collected:state.player.score,total:3,status:state.status};},
  getWinState:function(){return state.status==="won";},
  getLoseState:function(){return state.status==="lost";},
  performTestAction:function(action){
    if(action==="left"||action==="right"||action==="up"||action==="down"||action==="action"){
      setInput(action,true);setTimeout(function(){setInput(action,false);},120);return true;
    }
    if(action==="collect") { state.orbs.forEach(function(o){if(!o.taken){state.player.x=o.x;state.player.y=o.y;return;}}); return true; }
    if(action==="goal"){state.player.x=state.portal.x;state.player.y=state.portal.y;return true;}
    return false;
  },
  restart:function(){reset();return true;}
};
resize();window.addEventListener("resize",resize);reset();
window.__RK_GAME_READY__=true;draw();requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;
}
