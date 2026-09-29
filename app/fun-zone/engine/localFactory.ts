import type { GameBlueprint } from "../laboratory/types";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c] || c));
}

function modeFor(b: GameBlueprint): string {
  const s=[b.genre,b.concept,b.objective,b.coreLoop,...b.mechanics,...b.playerActions].join(" ").toLowerCase();
  if (/(runner|endless|lari|run)/.test(s)) return "runner";
  if (/(puzzle|teka|logic|match|grid)/.test(s)) return "puzzle";
  if (/(racing|race|balap|driving|kendaraan|mobil)/.test(s)) return "racing";
  if (/(stealth|siluman|infiltrat|patrol|spy)/.test(s)) return "stealth";
  if (/(farm|farming|bertani|tanam|simulation|simulasi)/.test(s)) return "farming";
  if (/(strategy|strategi|tower|defense|pertahan)/.test(s)) return "strategy";
  if (/(combat|fight|battle|perang|shooter|menembak|arena)/.test(s)) return "combat";
  if (/(survival|bertahan|zombie|monster|horror)/.test(s)) return "survival";
  return "adventure";
}

export function buildLocalGameHtml(b: GameBlueprint): string {
  const title=esc(b.title), objective=esc(b.objective), theme=esc(b.theme);
  const mode=modeFor(b), seed=Math.abs([...b.concept].reduce((n,c)=>(n*31+c.charCodeAt(0))|0,17));
  const config=JSON.stringify({mode,seed});
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07111f;color:#fff;font-family:system-ui,sans-serif}
body{display:flex;justify-content:center}#game{position:relative;width:min(100vw,760px);height:100dvh;min-height:480px;overflow:hidden}
canvas{display:block;width:100%;height:100%;min-height:480px}#hud{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;pointer-events:none;font-size:12px}
.panel{background:#0009;border:1px solid #fff2;border-radius:12px;padding:7px 10px}#hint{position:absolute;bottom:88px;left:50%;transform:translateX(-50%);font-size:10px;color:#cbd5e1aa;max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#controls{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:space-between;padding:0 14px;pointer-events:none}.pad,.actions{display:flex;gap:9px;pointer-events:auto}
.ctrl{width:56px;height:56px;border-radius:17px;border:1px solid #fff3;background:#0a1930dd;color:white;font-size:19px;font-weight:800;touch-action:none}.ctrl:active{background:#22d3ee66}
#message{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);display:none;text-align:center;background:#030a14ed;border:1px solid #fff3;border-radius:18px;padding:20px;min-width:230px}#restart{margin-top:12px;border:0;border-radius:12px;padding:10px 18px;font-weight:800;background:#22d3ee}
</style></head><body><div id="game"><canvas id="gameCanvas"></canvas>
<div id="hud"><div class="panel"><b>${title}</b><br><span id="hp">HP 100</span></div><div class="panel"><span id="score">Score 0</span><br><span id="status">PLAYING</span></div></div>
<div id="hint">${objective} · ${theme}</div><div id="controls"><div class="pad"><button class="ctrl" data-a="left">◀</button><button class="ctrl" data-a="up">▲</button><button class="ctrl" data-a="down">▼</button><button class="ctrl" data-a="right">▶</button></div><div class="actions"><button class="ctrl" data-a="action">●</button></div></div>
<div id="message"><div id="messageText"></div><button id="restart">RESTART</button></div></div>
<script>(function(){var C=${config},canvas=document.getElementById("gameCanvas"),ctx=canvas&&canvas.getContext("2d"),w=720,h=900,last=0;
window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;
var input={left:false,right:false,up:false,down:false,action:false},state={mode:C.mode,status:"playing",tick:0,score:0,health:100,progress:0,player:{x:110,y:400},items:[],enemies:[]};
function rnd(n){var x=Math.sin(C.seed+n*997)*43758.5453;return x-Math.floor(x)}
function resize(){if(!canvas||!ctx)return;var r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);w=Math.max(320,r.width);h=Math.max(480,r.height);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0)}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function reset(){state.status="playing";state.tick=0;state.score=0;state.health=100;state.progress=0;state.player={x:110,y:h*.55};state.items=[];state.enemies=[];for(var i=0;i<8;i++)state.items.push({x:70+rnd(i)*Math.max(180,w-110),y:100+rnd(i+20)*(h-250),taken:false});for(var j=0;j<4;j++)state.enemies.push({x:180+rnd(j+40)*(w-210),y:100+rnd(j+60)*(h-250),alive:true,dx:rnd(j+80)>.5?1:-1});updateHud();document.getElementById("message").style.display="none"}
function setI(a,v){if(a in input)input[a]=v}document.querySelectorAll(".ctrl").forEach(function(b){var a=b.dataset.a;["pointerdown","pointerup","pointercancel","pointerleave"].forEach(function(t){b.addEventListener(t,function(e){e.preventDefault();setI(a,t==="pointerdown")})})});
var keys={ArrowLeft:"left",a:"left",ArrowRight:"right",d:"right",ArrowUp:"up",w:"up",ArrowDown:"down",s:"down"," ":"action",Enter:"action"};addEventListener("keydown",function(e){var a=keys[e.key];if(a){e.preventDefault();setI(a,true)}});addEventListener("keyup",function(e){var a=keys[e.key];if(a)setI(a,false)});document.getElementById("restart").onclick=reset;
function move(dt,s){s=s||190*dt;if(input.left)state.player.x-=s;if(input.right)state.player.x+=s;if(input.up)state.player.y-=s;if(input.down)state.player.y+=s;state.player.x=Math.max(20,Math.min(w-20,state.player.x));state.player.y=Math.max(75,Math.min(h-110,state.player.y))}
function finish(win){state.status=win?"won":"lost";document.getElementById("status").textContent=win?"WIN":"LOSE";document.getElementById("messageText").textContent=win?"🏆 Objective complete!":"💫 Game over.";document.getElementById("message").style.display="block"}
function update(dt){if(state.status!=="playing")return;var m=C.mode;
if(m==="runner"||m==="racing"){state.player.y+=(input.up?-170:input.down?170:0)*dt;state.items.forEach(function(o){o.x-=220*dt;if(!o.taken&&Math.abs(o.x-state.player.x)<28&&Math.abs(o.y-state.player.y)<32){o.taken=true;state.score++}});state.enemies.forEach(function(e){e.x-=200*dt;if(e.x<-30){e.x=w+80;e.y=90+rnd(state.tick)*(h-220)}});state.progress=Math.floor(state.tick/60);if(state.enemies.some(function(e){return dist(state.player,e)<30}))state.health-=35*dt;if(state.progress>=25)finish(true)}
else if(m==="puzzle"){if(input.action&&state.tick%12===0){state.progress++;state.score+=10}if(state.progress>=5)finish(true)}
else if(m==="combat"){move(dt);if(input.action&&state.tick%8===0){var e=state.enemies.find(function(x){return x.alive&&dist(state.player,x)<115});if(e){e.alive=false;state.score+=25}}state.enemies.forEach(function(e){if(e.alive&&dist(state.player,e)<30)state.health-=25*dt});state.progress=state.enemies.filter(function(e){return !e.alive}).length;if(state.progress>=4)finish(true)}
else if(m==="survival"){move(dt);state.enemies.forEach(function(e){if(!e.alive)return;var dx=state.player.x-e.x,dy=state.player.y-e.y,l=Math.hypot(dx,dy)||1;e.x+=dx/l*42*dt;e.y+=dy/l*42*dt;if(dist(state.player,e)<28)state.health-=18*dt});state.progress=Math.floor(state.tick/60);if(state.progress>=30)finish(true)}
else if(m==="stealth"){move(dt);state.items.forEach(function(o){if(!o.taken&&dist(state.player,o)<28){o.taken=true;state.score++}});state.enemies.forEach(function(e){if(e.alive){e.x+=e.dx*45*dt;if(e.x<40||e.x>w-40)e.dx*=-1;if(dist(state.player,e)<60)state.health-=28*dt}});state.progress=state.score;if(state.progress>=4)finish(true)}
else if(m==="farming"){move(dt,120*dt);if(input.action&&state.tick%12===0){state.score++;state.progress=state.score}if(state.progress>=8)finish(true)}
else if(m==="strategy"){move(dt,120*dt);if(input.action&&state.tick%12===0){state.progress++;state.score+=10}if(state.progress>=5)finish(true)}
else{move(dt);state.items.forEach(function(o){if(!o.taken&&dist(state.player,o)<28){o.taken=true;state.score++}});state.progress=state.score;if(state.progress>=5)finish(true)}
if(state.health<=0)finish(false);state.tick++;updateHud()}
function draw(){if(!ctx)return;ctx.clearRect(0,0,w,h);var g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#17365d");g.addColorStop(1,"#07111f");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
if(C.mode==="puzzle"){for(var y=0;y<5;y++)for(var x=0;x<4;x++){ctx.fillStyle=((x+y+state.progress+C.seed)%3===0)?"#22d3ee":"#334155";ctx.fillRect(w/2-108+x*54,130+y*54,44,44)}ctx.fillStyle="#fff";ctx.font="bold 14px system-ui";ctx.fillText("ACTION = solve next pattern",w/2-100,h*.67)}
else{state.items.forEach(function(o){if(!o.taken){ctx.fillStyle=C.mode==="farming"?"#34d399":"#facc15";ctx.beginPath();ctx.arc(o.x,o.y,9,0,Math.PI*2);ctx.fill()}});state.enemies.forEach(function(e){if(e.alive){ctx.fillStyle=C.mode==="stealth"?"#a78bfa":"#fb7185";ctx.fillRect(e.x-12,e.y-12,24,24)}});if(C.mode==="racing"){ctx.fillStyle="#102b47";ctx.fillRect(0,h*.7,w,h*.18);ctx.strokeStyle="#ffffff33";ctx.setLineDash([22,18]);ctx.beginPath();ctx.moveTo(0,h*.79);ctx.lineTo(w,h*.79);ctx.stroke();ctx.setLineDash([])}ctx.fillStyle="#f8fafc";ctx.fillRect(state.player.x-11,state.player.y-11,22,22);ctx.fillStyle="#22d3ee";ctx.fillRect(state.player.x-7,state.player.y-7,14,14)}window.__RK_GAME_RENDERED__=true}
function updateHud(){document.getElementById("hp").textContent="HP "+Math.max(0,Math.ceil(state.health));document.getElementById("score").textContent="Score "+state.score+" · Progress "+state.progress}
function loop(t){window.__RK_GAME_LOOP_STARTED__=true;var dt=Math.min(.05,(t-last)/1000||.016);last=t;update(dt);draw();requestAnimationFrame(loop)}
window.__RK_GAME_TEST__={getState:function(){return JSON.parse(JSON.stringify(state))},getPlayerState:function(){return JSON.parse(JSON.stringify(state.player))},getObjectiveState:function(){return {mode:state.mode,progress:state.progress,score:state.score,status:state.status}},getWinState:function(){return state.status==="won"},getLoseState:function(){return state.status==="lost"},performTestAction:function(a){if(["left","right","up","down","action"].indexOf(a)>=0){setI(a,true);setTimeout(function(){setI(a,false)},120);return true}if(a==="collect"){var o=state.items.find(function(x){return !x.taken});if(o){state.player.x=o.x;state.player.y=o.y;o.taken=true;state.score++;return true}}if(a==="attack"){var e=state.enemies.find(function(x){return x.alive&&dist(state.player,x)<120});if(e){e.alive=false;state.score+=25;return true}}return false},restart:function(){reset();return true}};
resize();addEventListener("resize",resize);reset();window.__RK_GAME_READY__=true;draw();requestAnimationFrame(loop)})();</script></body></html>`;
}
