import type { GameBlueprint } from "../laboratory/types";

function textOf(b: GameBlueprint): string {
  return [b.title,b.concept,b.genre,b.theme,b.world,b.visualStyle,b.objective,...b.mechanics,...b.playerActions].join(" ").toLowerCase();
}
function esc(v: string): string {
  return String(v || "James Game").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c] || c));
}
function config(b: GameBlueprint) {
  return JSON.stringify({title:b.title || "James Game",objective:b.objective || "Complete the objective."}).replace(/</g,"\\u003c");
}

export type SpecializedRuntime = "platformer" | "fps" | "voxel" | "strategy" | null;

export function getSpecializedRuntime(b: GameBlueprint): SpecializedRuntime {
  const t=textOf(b);
  if (/(minecraft|voxel|block world|block-based|sandbox building)/.test(t)) return "voxel";
  if (/(first.?person|\\bfps\\b|shooter 3d|first person shooter)/.test(t)) return "fps";
  if (/(platformer|side.?scroll|metroidvania|platform game|mario-like)/.test(t)) return "platformer";
  if (/(strategy|strategi|tactical|taktis|base building|tower defense|tower defence)/.test(t)) return "strategy";
  return null;
}

function shell(title:string, body:string, script:string):string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><title>${title}</title>
<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#081018;color:#fff;font-family:system-ui,sans-serif}#root{position:relative;width:100%;height:100%;min-height:520px;overflow:hidden}canvas{width:100%;height:100%;display:block;touch-action:none}.hud{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}.card{background:#071018dd;border:1px solid #ffffff22;border-radius:12px;padding:8px 11px;font-size:11px}.controls{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:space-between;padding:0 14px;pointer-events:none}.group{display:flex;gap:8px;pointer-events:auto}.btn{width:58px;height:58px;border:1px solid #ffffff30;border-radius:16px;background:#071018dd;color:#fff;font-weight:900;font-size:18px;touch-action:none}.message{display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88%,380px);padding:22px;border-radius:18px;background:#050c12f5;border:1px solid #ffffff44;text-align:center}.message button{padding:10px 18px;border:0;border-radius:10px;font-weight:900}</style></head><body><div id="root"><canvas id="game"></canvas><div class="hud"><div class="card"><b>${title}</b><br><span id="stats"></span></div><div class="card" id="family"></div></div><div class="controls" id="controls"></div><div class="message" id="message"><h2 id="mt"></h2><p id="mb"></p><button id="restart">RESTART</button></div></div><script>${script}</script></body></html>`;
}

function commonScript(kind:string,b:GameBlueprint,extra:string):string {
  const c=config(b);
  return `(function(){var G=${c},C=document.getElementById("game"),X=C.getContext("2d"),W=720,H=900,st={stateChanges:0,objectiveChanges:0,won:false,lost:false,restartCount:0},keys={};function resize(){W=C.clientWidth||720;H=C.clientHeight||900;C.width=W*devicePixelRatio;C.height=H*devicePixelRatio;X.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}function reset(){st=Object.assign(st,{stateChanges:0,objectiveChanges:0,won:false,lost:false});document.getElementById("message").style.display="none"}function win(t){st.won=true;st.objectiveChanges++;document.getElementById("mt").textContent=t;document.getElementById("mb").textContent=G.objective;document.getElementById("message").style.display="block"}function button(label,action){var b=document.createElement("button");b.className="btn";b.textContent=label;b.onpointerdown=function(e){e.preventDefault();action(true)};b.onpointerup=b.onpointercancel=function(){action(false)};document.getElementById("controls").appendChild(b)}document.getElementById("family").textContent="${kind.toUpperCase()} RUNTIME";document.getElementById("restart").onclick=function(){st.restartCount++;reset()};addEventListener("resize",resize);addEventListener("keydown",function(e){keys[e.key]=1});addEventListener("keyup",function(e){keys[e.key]=0});window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;${extra}window.__RK_GAME_TEST__={getState:function(){return JSON.parse(JSON.stringify(st))},getPlayerState:function(){return st.player||{}},getObjectiveState:function(){return {progress:st.progress||0,status:st.won?"won":st.lost?"lost":"playing"}},getWinState:function(){return st.won},getLoseState:function(){return st.lost},performTestAction:function(a){if(typeof st.actionMap[a]==="function"){st.actionMap[a]();return true}return false},restart:function(){st.restartCount++;reset();return true}};resize();reset();window.__RK_GAME_READY__=true;requestAnimationFrame(loop);function loop(t){update(.016);draw();window.__RK_GAME_RENDERED__=true;window.__RK_GAME_LOOP_STARTED__=true;requestAnimationFrame(loop)}function update(dt){}${kind==="platformer"?"":""}})();`;
}

export function buildPlatformerRuntime(b:GameBlueprint):string {
  const title=esc(b.title||"James Platformer");
  const script=commonScript("platformer",b,`
var p={x:90,y:300,vx:0,vy:0,onGround:false,jumps:0},platforms=[{x:0,y:470,w:900,h:40},{x:180,y:380,w:150,h:18},{x:410,y:315,w:150,h:18},{x:650,y:250,w:140,h:18}],goal={x:760,y:205};st.player=p;st.progress=0;st.actionMap={move:function(){p.x+=30;st.stateChanges++},jump:function(){if(p.onGround||p.jumps<1){p.vy=-300;p.onGround=false;p.jumps++;st.stateChanges++}},collect:function(){st.progress=1;st.stateChanges++;win("LEVEL COMPLETE")}};button("◀",function(v){keys.left=v});button("▶",function(v){keys.right=v});button("JUMP",function(v){if(v)st.actionMap.jump()});button("★",function(v){if(v)st.actionMap.collect()});function update(dt){p.vx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0);p.x+=p.vx*180*dt;p.vy+=720*dt;p.y+=p.vy*dt;p.onGround=false;for(var i=0;i<platforms.length;i++){var q=platforms[i];if(p.x>q.x&&p.x<q.x+q.w&&p.y+18>=q.y&&p.y+18<=q.y+20&&p.vy>=0){p.y=q.y-18;p.vy=0;p.onGround=true;p.jumps=0}}if(p.x>=goal.x){st.progress=1;win("LEVEL COMPLETE")}}function draw(){X.fillStyle="#071a2b";X.fillRect(0,0,W,H);X.fillStyle="#123d5a";X.fillRect(0,0,W,H*.55);X.fillStyle="#45c46b";platforms.forEach(q=>X.fillRect(q.x-p.x+W*.35,q.y,q.w,q.h));X.fillStyle="#ffd166";X.fillRect(W*.35,p.y,28,28);X.fillStyle="#fff";X.fillText("SIDE-SCROLLER · JUMP · PLATFORM PHYSICS",16,90);document.getElementById("stats").textContent="X "+Math.round(p.x)+" · "+(p.onGround?"GROUND":"AIR")+" · "+Math.round(st.progress*100)+"%"}`);
  return shell(title,script,"");
}

export function buildFPSRuntime(b:GameBlueprint):string {
  const title=esc(b.title||"James FPS");
  const script=commonScript("fps",b,`
var angle=0,depth=0,targets=3;st.player={angle:0,depth:0};st.progress=0;st.actionMap={move:function(){depth+=1;st.player.depth=depth;st.stateChanges++},shoot:function(){if(targets>0){targets--;st.progress=1-targets/3;st.stateChanges++;st.objectiveChanges++;if(targets===0)win("TARGETS CLEARED")}},turn:function(){angle+=.25;st.player.angle=angle;st.stateChanges++}};button("◀",function(v){if(v)st.actionMap.turn()});button("▲",function(v){if(v)st.actionMap.move()});button("FIRE",function(v){if(v)st.actionMap.shoot()});function update(dt){if(keys.ArrowLeft){angle-=dt;st.stateChanges++}if(keys.ArrowRight){angle+=dt;st.stateChanges++}if(keys.w||keys.ArrowUp)st.actionMap.move()}function draw(){X.fillStyle="#111";X.fillRect(0,0,W,H);var horizon=H*.45;X.fillStyle="#253246";X.fillRect(0,0,W,horizon);X.fillStyle="#17201b";X.fillRect(0,horizon,W,H-horizon);for(var i=0;i<7;i++){var z=i+1;var size=260/z;var x=W/2+Math.sin(angle+i)*W*.25/z;X.fillStyle=i%2?"#d34":"#4bd";X.fillRect(x-size/2,horizon-size*.65,size,size);};X.strokeStyle="#fff";X.strokeRect(W/2-3,H/2-3,6,6);X.fillStyle="#fff";X.fillText("FIRST-PERSON · AIM · SHOOT",16,90);document.getElementById("stats").textContent="TARGETS "+targets+" · DEPTH "+depth} `);
  return shell(title,script,"");
}

export function buildVoxelRuntime(b:GameBlueprint):string {
  const title=esc(b.title||"James Voxel World");
  const script=commonScript("voxel",b,`
var blocks=[],selected=0;for(var z=0;z<7;z++)for(var x=0;x<9;x++)blocks.push({x:x,z:z,h:1+((x+z)%3)});st.player={x:4,z:3};st.progress=0;st.actionMap={place:function(){blocks.push({x:st.player.x,z:st.player.z,h:3});selected++;st.progress=Math.min(1,selected/3);st.stateChanges++;st.objectiveChanges++;if(selected>=3)win("WORLD BUILT")},mine:function(){if(blocks.length){blocks.pop();st.stateChanges++;st.progress=Math.min(1,st.progress+.2)}}};button("−",function(v){if(v)st.actionMap.mine()});button("+",function(v){if(v)st.actionMap.place()});function update(dt){if(keys.ArrowLeft)st.player.x=Math.max(0,st.player.x-1);if(keys.ArrowRight)st.player.x=Math.min(8,st.player.x+1);if(keys.ArrowUp)st.player.z=Math.max(0,st.player.z-1);if(keys.ArrowDown)st.player.z=Math.min(6,st.player.z+1)}function draw(){X.fillStyle="#79c7ff";X.fillRect(0,0,W,H);for(var i=0;i<blocks.length;i++){var q=blocks[i],sx=W/2+(q.x-q.z)*34,sy=250+(q.x+q.z)*14-q.h*24;X.fillStyle="#79b84a";X.beginPath();X.moveTo(sx,sy);X.lineTo(sx+34,sy+14);X.lineTo(sx,sy+28);X.lineTo(sx-34,sy+14);X.closePath();X.fill();X.fillStyle="#9b6b43";X.fillRect(sx-28,sy+14,56,q.h*24)}X.fillStyle="#fff";X.fillText("VOXEL 3D · BLOCK WORLD · BUILD",16,90);document.getElementById("stats").textContent="BLOCKS "+blocks.length+" · BUILD "+Math.round(st.progress*100)+"%"}`);
  return shell(title,script,"");
}

export function buildStrategyRuntime(b:GameBlueprint):string {
  const title=esc(b.title||"James Strategy");
  const script=commonScript("strategy",b,`
var grid=Array.from({length:8},()=>Array(12).fill(0)),units=2,resources=10,selected=null;st.player={selected:null};st.progress=0;st.actionMap={place:function(){var x=selected==null?4:selected;grid[3][x]=1;resources--;st.progress=Math.min(1,(10-resources)/5);st.stateChanges++;st.objectiveChanges++;if(resources<=5)win("STRATEGY OBJECTIVE COMPLETE")},command:function(){units++;st.stateChanges++}};button("SELECT",function(v){if(v){selected=(selected==null?0:selected+1)%12;st.player.selected=selected;st.stateChanges++}});button("BUILD",function(v){if(v&&resources>0)st.actionMap.place()});button("CMD",function(v){if(v)st.actionMap.command()});function update(dt){}function draw(){X.fillStyle="#142018";X.fillRect(0,0,W,H);var ox=30,oy=150,s=48;for(var y=0;y<8;y++)for(var x=0;x<12;x++){X.strokeStyle="#ffffff22";X.strokeRect(ox+x*s,oy+y*s,s,s);if(grid[y][x]){X.fillStyle="#4ade80";X.fillRect(ox+x*s+8,oy+y*s+8,s-16,s-16)}}if(selected!=null){X.strokeStyle="#ffd166";X.lineWidth=3;X.strokeRect(ox+selected*s,oy+3*s,s,s);X.lineWidth=1}X.fillStyle="#fff";X.fillText("STRATEGY · GRID · RESOURCES · COMMAND",16,90);document.getElementById("stats").textContent="UNITS "+units+" · RES "+resources+" · PROGRESS "+Math.round(st.progress*100)+"%"}`);
  return shell(title,script,"");
}
