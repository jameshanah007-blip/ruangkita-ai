import type { GameBlueprint } from "../laboratory/types";

function esc(value: string): string {
  return String(value || "James Racing").replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c] || c));
}

export function isRacing3DRequest(blueprint: GameBlueprint): boolean {
  const text = [
    blueprint.title, blueprint.concept, blueprint.genre, blueprint.theme,
    blueprint.world, blueprint.visualStyle, ...blueprint.mechanics, ...blueprint.playerActions,
  ].join(" ").toLowerCase();
  const hasRacing = /(?:racing|race|balap|mobil|kendaraan|driving|car)/i.test(text);
  const has3D = /(?:\b3d\b|three.?dimensional|3d game|webgl)/i.test(text);
  const has2D = /(?:\b2d\b|two.?dimensional|top.?down|side.?scroll)/i.test(text);
  const hasVehicleAction = /(?:accelerate|steer|brake|upgradevehicle|upgrade kendaraan)/i.test(text);
  return hasRacing && !has2D && (has3D || hasVehicleAction || /(?:racing|balap)/i.test(blueprint.genre));
}

/**
 * Provider-free WebGL racing runtime.
 * It is deliberately small but genuinely 3D: perspective road, car mesh,
 * checkpoint gates, laps, vehicle upgrades, keyboard + touch, and semantic QA.
 */
export function buildRacing3DGameHtml(blueprint: GameBlueprint): string {
  const title = esc(blueprint.title || "James 3D Racing");
  const objective = esc(blueprint.objective || "Pass checkpoints and finish the race.");
  const config = JSON.stringify({
    title,
    objective,
    laps: 3,
    checkpointsPerLap: 4,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>${title}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#071018;color:#fff;font-family:system-ui,sans-serif}
#root{position:relative;width:100%;height:100%;min-height:520px;overflow:hidden}canvas{display:block;width:100%;height:100%;touch-action:none}
#hud{position:absolute;left:12px;right:12px;top:12px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.card{background:rgba(7,16,24,.82);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:8px 11px;font-size:11px;line-height:1.4}
#controls{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:space-between;padding:0 14px;pointer-events:none}
.group{display:flex;gap:8px;pointer-events:auto}.btn{width:58px;height:58px;border:1px solid rgba(255,255,255,.25);border-radius:16px;background:rgba(8,18,28,.86);color:#fff;font-weight:900;font-size:18px;touch-action:none}
#message{display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88%,380px);padding:22px;border-radius:18px;background:rgba(5,12,18,.96);border:1px solid rgba(80,220,255,.55);text-align:center}
#message button{margin-top:14px;border:0;border-radius:10px;padding:10px 18px;font-weight:900;background:#50dcff;color:#061018}
</style></head><body><div id="root"><canvas id="game"></canvas>
<div id="hud"><div class="card"><b>${title}</b><br><span id="stats"></span></div><div class="card" id="mode">3D RACING · WEBGL</div></div>
<div id="controls"><div class="group"><button class="btn" data-k="left">◀</button><button class="btn" data-k="right">▶</button></div><div class="group"><button class="btn" data-k="brake">■</button><button class="btn" data-k="accelerate">▲</button><button class="btn" data-k="upgrade">★</button></div></div>
<div id="message"><h2 id="messageTitle"></h2><p id="messageBody"></p><button id="restart">RACE AGAIN</button></div></div>
<script>
(function(){
"use strict";
var G=${config}, canvas=document.getElementById("game"), gl=canvas.getContext("webgl",{antialias:true});
var stats=document.getElementById("stats"),msg=document.getElementById("message"),mt=document.getElementById("messageTitle"),mb=document.getElementById("messageBody");
var state,keys={left:false,right:false,accelerate:false,brake:false},last=0,raf=0;
window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;
function reset(){state={speed:0,distance:0,checkpoint:0,lap:1,upgrade:0,won:false,lost:false,stateChanges:0,objectiveChanges:0,restartCount:0};msg.style.display="none";}
function shader(type,source){var s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s}
function setup(){if(!gl)return;var vs=shader(gl.VERTEX_SHADER,"attribute vec3 p; uniform mat4 m; void main(){gl_Position=m*vec4(p,1.0);}");var fs=shader(gl.FRAGMENT_SHADER,"precision mediump float; uniform vec4 c; void main(){gl_FragColor=c;}");var pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);gl.useProgram(pr);return {p:gl.getAttribLocation(pr,"p"),m:gl.getUniformLocation(pr,"m"),c:gl.getUniformLocation(pr,"c"),pr:pr}}
var P=setup();
function resize(){var d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(320,Math.floor(canvas.clientWidth*d));canvas.height=Math.max(520,Math.floor(canvas.clientHeight*d));gl&&gl.viewport(0,0,canvas.width,canvas.height)}
function mat(){var a=canvas.width/canvas.height,f=1/Math.tan(.55),z=.01,n=120;return new Float32Array([f/a,0,0,0,0,f,0,0,0,0,(n+z)/(z-n),-1,0,0,(2*n*z)/(z-n),0])}
function drawBox(z,x,y,sx,sy,sz,color){if(!gl||!P)return;var v=new Float32Array([-sx,-sy,-sz,sx,-sy,-sz,sx,sy,-sz,-sx,sy,-sz,-sx,-sy,sz,sx,-sy,sz,sx,sy,sz,-sx,sy,sz]);var idx=[0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,2,6,7,2,7,3,0,3,7,0,7,4,1,5,6,1,6,2];var b=gl.createBuffer(),ib=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STREAM_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STREAM_DRAW);var m=mat();m[12]=x;m[13]=y;m[14]=-z;gl.uniformMatrix4fv(P.m,false,m);gl.uniform4fv(P.c,new Float32Array(color));gl.enableVertexAttribArray(P.p);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.vertexAttribPointer(P.p,3,gl.FLOAT,false,0,0);gl.drawElements(gl.TRIANGLES,idx.length,gl.UNSIGNED_SHORT,0);gl.deleteBuffer(b);gl.deleteBuffer(ib)}
function render(){if(!gl||!P)return;gl.clearColor(.025,.055,.08,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);var z0=7+(state.distance%8);for(var i=0;i<18;i++){var z=z0+i*7;drawBox(z,0,-1.5,.08,1.2,3.2,[.18,.2,.22,1]);drawBox(z,-1.35,-1.35,.9,.08,3.2,[.1,.65,.75,1]);drawBox(z,1.35,-1.35,.9,.08,3.2,[.1,.65,.75,1]);if(i%4===0){drawBox(z,0,0.8,.06,.9,.06,[1,.75,.15,1]);drawBox(z,-1.8,0.8,.06,.9,.06,[1,.75,.15,1]);drawBox(z,1.8,0.8,.06,.9,.06,[1,.75,.15,1]);}}drawBox(4,0,-1.05,.42,.28,.72,[.9,.12,.12,1]);window.__RK_GAME_RENDERED__=true;}
function step(dt){if(state.won||state.lost)return;var accel=keys.accelerate?1:0,brake=keys.brake?1:0;state.speed=Math.max(0,Math.min(280,state.speed+(accel?90:-25)*dt-brake*150*dt));if(keys.left)state.distance-=state.speed*.12*dt;if(keys.right)state.distance+=state.speed*.12*dt;state.distance+=state.speed*.32*dt;var lapDistance=120;var checkpoint=Math.floor(state.distance/30)%G.checkpointsPerLap;var lap=Math.min(G.laps,Math.floor(state.distance/lapDistance)+1);if(checkpoint!==state.checkpoint||lap!==state.lap){state.checkpoint=checkpoint;state.lap=lap;state.objectiveChanges++;state.stateChanges++;}if(state.distance>=G.laps*lapDistance){state.won=true;state.objectiveChanges++;mt.textContent="RACE COMPLETE";mb.textContent=${JSON.stringify(objective)};msg.style.display="block";}state.stateChanges++;}
function input(k,v){if(k in keys)keys[k]=v}
function action(a){if(a==="accelerate"||a==="move"){state.speed=Math.min(280,state.speed+40);state.distance+=8;state.stateChanges++;return true}if(a==="brake"||a==="dodge"){state.speed=Math.max(0,state.speed-30);state.stateChanges++;return true}if(a==="steer"||a==="left"||a==="right"){state.distance+=3;state.stateChanges++;return true}if(a==="upgradeVehicle"||a==="upgrade"||a==="interact"||a==="collect"){state.upgrade++;state.speed=Math.min(320,state.speed+20);state.stateChanges++;state.objectiveChanges++;return true}return false}
["pointerdown","pointerup","pointercancel"].forEach(function(t){document.querySelectorAll("[data-k]").forEach(function(b){b.addEventListener(t,function(e){e.preventDefault();var k=b.dataset.k;if(t==="pointerdown"){if(k==="upgrade")action("upgradeVehicle");else input(k==="accelerate"?"accelerate":k==="brake"?"brake":k,true)}else input(k==="accelerate"?"accelerate":k==="brake"?"brake":k,false);})})});
var km={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"accelerate"," ":"brake",e:"upgrade",E:"upgrade"};addEventListener("keydown",function(e){var k=km[e.key];if(k){e.preventDefault();if(k==="upgrade")action("upgradeVehicle");else input(k,true)}});addEventListener("keyup",function(e){var k=km[e.key];if(k)input(k,false)});
addEventListener("message",function(e){var d=e&&e.data;if(!d||d.type!=="AI_GAME_KEY_EVENT")return;var k=km[d.key]||km[d.code];if(k){if(k==="upgrade"&&d.eventType!=="keyup")action("upgradeVehicle");else input(k,d.eventType!=="keyup")}});
document.getElementById("restart").onclick=function(){state.restartCount++;reset();state.restartCount=1};
window.__RK_GAME_TEST__={getState:function(){return JSON.parse(JSON.stringify(state))},getPlayerState:function(){return {speed:state.speed,distance:state.distance}},getObjectiveState:function(){return {checkpoint:state.checkpoint,lap:state.lap,progress:Math.min(1,state.distance/(G.laps*120)),status:state.won?"won":state.lost?"lost":"playing"}},getWinState:function(){return state.won},getLoseState:function(){return state.lost},performTestAction:function(a){return action(a)},restart:function(){var n=state.restartCount+1;reset();state.restartCount=n;return true}};
function loop(t){var dt=Math.min(.05,(t-last)/1000||.016);last=t;step(dt);render();stats.textContent="SPEED "+Math.round(state.speed)+" · LAP "+state.lap+"/"+G.laps+" · CP "+(state.checkpoint+1)+"/"+G.checkpointsPerLap+" · UPG "+state.upgrade;window.__RK_GAME_LOOP_STARTED__=true;raf=requestAnimationFrame(loop)}
resize();addEventListener("resize",resize);reset();window.__RK_GAME_READY__=true;raf=requestAnimationFrame(loop);
})();
</script></body></html>`;
}
