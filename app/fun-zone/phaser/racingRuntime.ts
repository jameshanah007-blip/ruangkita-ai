import type { PhaserGameSpec } from "./types";

const PHASER_VERSION = "4.2.1";
const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@" + PHASER_VERSION + "/dist/phaser.min.js";

export function buildRacingGameHtml(spec: PhaserGameSpec): string {
  const carAsset = spec.assets.find((asset) => asset.id === spec.player.assetId);
  if (!carAsset) {
    throw new Error("Racing Phaser runtime requires the declared player asset: " + spec.player.assetId);
  }
  if (carAsset.animationMode !== "sprite-sheet") {
    throw new Error("Racing Phaser runtime requires a sprite-sheet vehicle asset; single-image vehicles are not accepted.");
  }
  if (!carAsset.frameWidth || !carAsset.frameHeight || !carAsset.frameCount || carAsset.frameCount < 2) {
    throw new Error("Racing Phaser runtime received invalid vehicle sprite-sheet metadata.");
  }

  const config = JSON.stringify({
    title: spec.title,
    objective: spec.objective,
    winCondition: spec.winCondition,
    loseCondition: spec.loseCondition,
    palette: spec.visual.palette,
    carAssetUri: carAsset.uri,
    carAssetId: spec.player.assetId,
    frameWidth: carAsset.frameWidth,
    frameHeight: carAsset.frameHeight,
    frameCount: carAsset.frameCount,
  }).replace(/</g, "\\u003c");

  const carAssetLiteral = JSON.stringify(carAsset.uri).replace(/</g, "\\u003c");
  const environmentAsset = spec.assets.find((asset) => asset.kind === "environment");
  const environmentAssetLiteral = environmentAsset
    ? JSON.stringify(environmentAsset.uri).replace(/</g, "\\u003c")
    : "null";

  const script = `
"use strict";
const CFG=${config};
const CAR_ASSET=${carAssetLiteral};
const TRACK_ASSET=${environmentAssetLiteral};

const race={
  speed:0,
  maxSpeed:6,
  checkpoint:0,
  checkpoints:4,
  lap:1,
  totalLaps:3,
  finished:false,
  elapsed:0,
  position:{x:480,y:470},
};

window.__RK_GAME_READY__=false;
window.__RK_GAME_RENDERED__=false;
window.__RK_GAME_LOOP_STARTED__=false;
window.__RK_RACING_PLAYER__=null;

function objectiveProgress(){
  return race.finished
    ? 1
    : Math.min(1, ((race.lap-1)*race.checkpoints+race.checkpoint)/(race.totalLaps*race.checkpoints));
}

function resetRace(){
  race.speed=0;
  race.maxSpeed=6;
  race.checkpoint=0;
  race.lap=1;
  race.finished=false;
  race.elapsed=0;
  race.position={x:480,y:470};
  if(window.__RK_RACING_PLAYER__){
    window.__RK_RACING_PLAYER__.x=480;
    window.__RK_RACING_PLAYER__.y=470;
    window.__RK_RACING_PLAYER__.angle=0;
  }
}

function passCheckpoint(){
  if(race.finished) return false;
  race.checkpoint+=1;
  if(race.checkpoint>=race.checkpoints){
    race.checkpoint=0;
    race.lap+=1;
    if(race.lap>race.totalLaps){
      race.lap=race.totalLaps;
      race.finished=true;
    }
  }
  return true;
}

function testAction(action){
  if(action==="accelerate"){ race.speed=Math.min(race.maxSpeed,race.speed+1); return true; }
  if(action==="steer"){ race.position.x=Math.min(760,Math.max(200,race.position.x+40)); return true; }
  if(action==="checkpoint"){ return passCheckpoint(); }
  if(action==="finish"){
    while(!race.finished) passCheckpoint();
    return true;
  }
  return false;
}

window.__RK_GAME_TEST__={
  testActions:["accelerate","steer","checkpoint","finish"],
  getState:()=>JSON.parse(JSON.stringify(race)),
  getPlayerState:()=>({
    x:race.position.x,
    y:race.position.y,
    speed:race.speed,
    checkpoint:race.checkpoint,
    lap:race.lap,
    finished:race.finished
  }),
  getObjectiveState:()=>({
    progress:objectiveProgress(),
    checkpoint:race.checkpoint,
    lap:race.lap,
    finished:race.finished
  }),
  getWinState:()=>race.finished,
  getLoseState:()=>false,
  performTestAction:(action)=>testAction(action),
  restart:()=>{resetRace();return true;}
};

class RacingScene extends Phaser.Scene{
  constructor(){super({key:"RacingScene"});}

  preload(){
    this.load.spritesheet("car",CAR_ASSET,{
      frameWidth:CFG.frameWidth,
      frameHeight:CFG.frameHeight
    });
    if(TRACK_ASSET) this.load.image("track-environment",TRACK_ASSET);
  }

  create(){
    this.cameras.main.setBackgroundColor(CFG.palette.background);
    this.add.rectangle(480,320,960,640,0x101820);

    if(TRACK_ASSET){
      this.add.image(480,320,"track-environment")
        .setDisplaySize(960,540)
        .setDepth(-10);
    }else{
      this.drawTrack();
    }

    this.add.text(32,22,CFG.title,{
      fontSize:"24px",
      fontFamily:"Arial",
      color:CFG.palette.light,
      fontStyle:"bold"
    });

    this.add.text(32,58,CFG.objective,{
      fontSize:"12px",
      fontFamily:"Arial",
      color:CFG.palette.light,
      wordWrap:{width:700}
    });

    const hud=this.add.text(32,92,"Speed: 0 · Lap: 1/3 · Checkpoint: 0/4",{
      fontSize:"14px",
      fontFamily:"Arial",
      color:CFG.palette.light,
      backgroundColor:"#101820",
      padding:{x:8,y:5}
    });

    this.add.text(690,28,"TOP-DOWN CIRCUIT",{
      fontSize:"12px",
      fontFamily:"Arial",
      color:CFG.palette.accent,
      fontStyle:"bold"
    });

    const car=this.add.sprite(480,470,"car").setScale(0.7);
    car.setOrigin(0.5);
    this.anims.create({
      key:"car-drive",
      frames:this.anims.generateFrameNumbers("car",{start:0,end:Math.min(3,CFG.frameCount-1)}),
      frameRate:8,
      repeat:-1
    });
    car.play("car-drive");
    window.__RK_RACING_PLAYER__=car;

    this.keys=this.input.keyboard ? this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") : null;
    this.touch={left:false,right:false,accelerate:false,brake:false};

    const button=(x,y,label,key)=>{
      const control=this.add.circle(x,y,25,0x162a3d,0.95)
        .setInteractive({useHandCursor:true});
      this.add.text(x,y,label,{
        fontSize:"17px",
        fontFamily:"Arial",
        color:CFG.palette.light,
        fontStyle:"bold"
      }).setOrigin(0.5);
      control.on("pointerdown",()=>{this.touch[key]=true;});
      control.on("pointerup",()=>{this.touch[key]=false;});
      control.on("pointerout",()=>{this.touch[key]=false;});
    };

    button(75,485,"◀","left");
    button(145,485,"▶","right");
    button(110,435,"▲","accelerate");
    button(110,535,"▼","brake");

    this.checkpointMarkers=[
      {x:480,y:160},
      {x:760,y:320},
      {x:480,y:490},
      {x:200,y:320}
    ];

    this.checkpointSprites=this.checkpointMarkers.map((point,index)=>
      this.add.circle(point.x,point.y,14,index===0 ? 0x00d4ff : 0x263646,0.9)
        .setStrokeStyle(3,0x00d4ff)
    );

    this.status=this.add.text(32,575,"Accelerate, steer through the checkpoints, and finish 3 laps.",{
      fontSize:"13px",
      fontFamily:"Arial",
      color:CFG.palette.light
    });

    window.__RK_GAME_READY__=true;
    window.__RK_GAME_RENDERED__=true;

    this.hud=hud;
  }

  drawTrack(){
    this.add.circle(480,320,300,0x3b3f46);
    this.add.circle(480,320,205,0x101820);
    this.add.rectangle(480,320,610,12,0xf5f7fa,0.5);
    this.add.rectangle(480,320,12,610,0xf5f7fa,0.5);
    this.add.text(480,320,"START / FINISH",{
      fontSize:"16px",
      fontFamily:"Arial",
      color:"#f5f7fa"
    }).setOrigin(0.5);
  }

  update(_,delta){
    window.__RK_GAME_LOOP_STARTED__=true;
    const player=window.__RK_RACING_PLAYER__;
    if(!player || race.finished) return;

    const keys=this.keys;
    const accelerate=this.touch.accelerate || (keys && (keys.W.isDown || keys.UP.isDown));
    const brake=this.touch.brake || (keys && (keys.S.isDown || keys.DOWN.isDown));
    const left=this.touch.left || (keys && (keys.A.isDown || keys.LEFT.isDown));
    const right=this.touch.right || (keys && (keys.D.isDown || keys.RIGHT.isDown));

    if(accelerate) race.speed=Math.min(race.maxSpeed,race.speed+0.08);
    else race.speed=Math.max(0,race.speed-0.025);
    if(brake) race.speed=Math.max(0,race.speed-0.12);

    if(left) player.angle-=2.4;
    if(right) player.angle+=2.4;

    const radians=(player.angle-90)*Math.PI/180;
    player.x+=Math.cos(radians)*race.speed;
    player.y+=Math.sin(radians)*race.speed;
    player.x=Math.max(150,Math.min(810,player.x));
    player.y=Math.max(130,Math.min(510,player.y));

    race.position.x=player.x;
    race.position.y=player.y;
    race.elapsed+=delta;

    const target=this.checkpointMarkers[race.checkpoint];
    if(target){
      const distance=Phaser.Math.Distance.Between(player.x,player.y,target.x,target.y);
      if(distance<42) passCheckpoint();
    }

    this.checkpointSprites.forEach((marker,index)=>{
      marker.setFillStyle(index===race.checkpoint ? 0x00d4ff : 0x263646);
    });

    this.hud.setText(
      "Speed: "+Math.round(race.speed*20)+
      " · Lap: "+race.lap+"/3"+
      " · Checkpoint: "+race.checkpoint+"/4"
    );

    this.status.setText(
      race.finished
        ? "🏁 Finish! Race completed."
        : "Checkpoint "+(race.checkpoint+1)+" of "+race.checkpoints+" · Lap "+race.lap+" of "+race.totalLaps
    );
  }
}

new Phaser.Game({
  type:Phaser.CANVAS,
  width:960,
  height:640,
  parent:"game",
  backgroundColor:CFG.palette.background,
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:960,height:640},
  scene:[RacingScene]
});
`;

  try {
    new Function(script);
  } catch (error) {
    throw new Error(
      "Racing Phaser runtime generated invalid JavaScript: " +
      (error instanceof Error ? error.message : String(error)),
    );
  }

  return "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no\"><title>" +
    spec.title.replace(/</g, "&lt;") +
    "</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:" +
    spec.visual.palette.background +
    "}#game{width:100%;height:100%;display:flex;align-items:center;justify-content:center}canvas{max-width:100%;max-height:100%;touch-action:none}</style></head><body><div id=\"game\"></div><script src=\"" +
    PHASER_CDN +
    "\"></script><script>" +
    script +
    "</script></body></html>";
}
