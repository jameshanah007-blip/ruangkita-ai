/**
 * James 2D Engine Foundation v1
 *
 * Shared browser-side primitives for genre-specific 2D runtimes:
 * - deterministic original pixel sprite atlas
 * - 4-direction animation
 * - keyboard + touch input
 * - camera
 * - collision
 * - entity state
 *
 * Genre runtimes own their gameplay rules; this file owns reusable 2D engine behavior.
 */
export function build2DEngineCoreScript(): string {
  return `
(function(){
"use strict";

function PixelSpriteAtlas(){
  var atlas=document.createElement("canvas");
  atlas.width=256; atlas.height=256;
  var c=atlas.getContext("2d");
  c.imageSmoothingEnabled=false;

  function px(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h)}

  function hero(frame,dir){
    var ox=(frame%4)*64, oy=dir*64, bob=frame===1||frame===3?1:0;
    var skin="#e9b58f",hair="#3a2927",coat="#3d69a8",coat2="#24466f",shirt="#f0d9b2",boot="#49372e";
    // Shadow/body silhouette
    px(ox+18,oy+50,28,5,"#0005");
    px(ox+21,oy+29+bob,22,20,coat);
    px(ox+24,oy+47+bob,7,9,boot); px(ox+33,oy+47+bob,7,9,boot);
    px(ox+24,oy+31+bob,16,9,shirt);
    px(ox+22,oy+10+bob,20,20,skin);
    px(ox+19,oy+8+bob,26,8,hair);
    px(ox+19,oy+13+bob,5,10,hair); px(ox+40,oy+13+bob,5,10,hair);
    if(dir===0){px(ox+27,oy+19+bob,3,3,"#222");px(ox+35,oy+19+bob,3,3,"#222");px(ox+29,oy+25+bob,7,2,"#b86d62")}
    else if(dir===1){px(ox+37,oy+19+bob,4,3,"#222");px(ox+39,oy+25+bob,4,2,"#b86d62")}
    else if(dir===2){px(ox+24,oy+19+bob,16,3,hair)}
    else {px(ox+22,oy+19+bob,4,3,"#222");px(ox+23,oy+25+bob,4,2,"#b86d62")}
    if(frame===1){px(ox+15,oy+34,7,4,coat2);px(ox+43,oy+31,7,4,coat2)}
    if(frame===3){px(ox+17,oy+31,7,4,coat2);px(ox+41,oy+34,7,4,coat2)}
  }

  function creature(frame,dir){
    var ox=(frame%4)*64,oy=128+dir*32;
    var body="#d67b45",light="#f0c06b",dark="#7a3e35",eye="#1d2630";
    px(ox+12,oy+24,40,22,"#0004");
    px(ox+14,oy+12,36,27,body);
    px(ox+18,oy+7,11,10,body);px(ox+35,oy+7,11,10,body);
    px(ox+21,oy+16,22,14,light);
    px(ox+21,oy+12,5,5,eye);px(ox+38,oy+12,5,5,eye);
    px(ox+6,oy+17,9,7,dark);px(ox+49,oy+17,9,7,dark);
    if(frame%2){px(ox+20,oy+39,9,5,dark);px(ox+35,oy+39,9,5,dark)}
    else{px(ox+17,oy+37,9,5,dark);px(ox+38,oy+37,9,5,dark)}
  }

  for(var d=0;d<4;d++)for(var f=0;f<4;f++){hero(f,d);creature(f,d)}
  return atlas;
}

function Core(opts){
  this.canvas=opts.canvas; this.ctx=this.canvas.getContext("2d");
  this.worldW=opts.worldW||1664; this.worldH=opts.worldH||1216;
  this.speed=opts.speed||130; this.input={up:false,down:false,left:false,right:false,action:false};
  this.camera={x:0,y:0}; this.entities=[]; this.started=false; this.elapsed=0;
  this.atlas=PixelSpriteAtlas();
  this.frame=0;
  this.resize();
  var self=this;
  window.addEventListener("resize",function(){self.resize()});
}
Core.prototype.resize=function(){
  var r=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
  this.canvas.width=Math.max(320,Math.floor(r.width*d));
  this.canvas.height=Math.max(520,Math.floor(r.height*d));
  this.ctx.setTransform(d,0,0,d,0,0);this.viewW=Math.max(320,r.width);this.viewH=Math.max(520,r.height);
};
Core.prototype.bindKeyboard=function(){
  var self=this;
  var map={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",W:"up",s:"down",S:"down",a:"left",A:"left",d:"right",D:"right"," ":"action",Enter:"action",e:"action",E:"action"};
  addEventListener("keydown",function(e){var k=map[e.key];if(k){e.preventDefault();self.input[k]=true}});
  addEventListener("keyup",function(e){var k=map[e.key];if(k)self.input[k]=false});
  addEventListener("blur",function(){Object.keys(self.input).forEach(function(k){self.input[k]=false})});
};
Core.prototype.bindTouch=function(){
  var self=this;
  document.querySelectorAll("[data-core-input]").forEach(function(el){
    var k=el.getAttribute("data-core-input");
    var on=function(e){e.preventDefault();self.input[k]=true};
    var off=function(e){e.preventDefault();self.input[k]=false};
    el.addEventListener("pointerdown",on);el.addEventListener("pointerup",off);
    el.addEventListener("pointercancel",off);el.addEventListener("pointerleave",off);
  });
};
Core.prototype.move=function(entity,dt,blocked){
  var dx=(this.input.right?1:0)-(this.input.left?1:0),dy=(this.input.down?1:0)-(this.input.up?1:0);
  if(!dx&&!dy){entity.moving=false;return {dx:0,dy:0}};
  var len=Math.hypot(dx,dy)||1, vx=dx/len*this.speed*dt,vy=dy/len*this.speed*dt;
  if(Math.abs(dx)>Math.abs(dy))entity.dir=dx<0?3:1;else entity.dir=dy<0?2:0;
  var nx=entity.x+vx,ny=entity.y+vy;
  if(!blocked(nx,entity.y,entity))entity.x=nx;
  if(!blocked(entity.x,ny,entity))entity.y=ny;
  entity.moving=true;entity.animTime=(entity.animTime||0)+dt;
  return {dx:vx,dy:vy};
};
Core.prototype.sprite=function(entity,kind,size){
  var dir=entity.dir||0,frame=entity.moving?Math.floor((entity.animTime||0)*9)%4:Math.floor(this.elapsed*3)%2;
  var sx=(frame%4)*64,sy=kind==="creature"?128+dir*32:dir*64;
  var sw=64,sh=kind==="creature"?32:64;
  this.ctx.imageSmoothingEnabled=false;
  this.ctx.drawImage(this.atlas,sx,sy,sw,sh,entity.x-size/2,entity.y-size*.78,size,size);
};
Core.prototype.updateCamera=function(target){
  this.camera.x=Math.max(0,Math.min(this.worldW-this.viewW,target.x-this.viewW/2));
  this.camera.y=Math.max(0,Math.min(this.worldH-this.viewH,target.y-this.viewH/2));
};
Core.prototype.toScreen=function(x,y){return {x:x-this.camera.x,y:y-this.camera.y}};
Core.prototype.update=function(dt){this.elapsed+=dt;this.frame++};
window.__RK_2D_CORE_VERSION__="1.0.0";
window.__RK_2D_CORE_CAPABILITIES__=["sprite_atlas","4_direction_animation","keyboard","touch","camera","collision","entity_state"];
window.__RK_2D_CORE__={Core:Core,PixelSpriteAtlas:PixelSpriteAtlas};
})();
`;
}
