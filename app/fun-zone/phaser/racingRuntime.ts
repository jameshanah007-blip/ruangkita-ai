import type { PhaserGameSpec } from "./types";

const PHASER_VERSION = "4.2.1";
const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@" + PHASER_VERSION + "/dist/phaser.min.js";

export function buildRacingGameHtml(spec: PhaserGameSpec): string {
  const carAsset = spec.assets.find((asset) => asset.id === spec.player.assetId);
  if (!carAsset) {
    throw new Error("Racing Phaser runtime requires the declared player asset: " + spec.player.assetId);
  }
  if (carAsset.entityKind !== "vehicle") {
    throw new Error("Racing Phaser runtime rejected a non-vehicle player asset.");
  }
  if (carAsset.animationMode !== "sprite-sheet" && carAsset.animationMode !== "single-image") {
    throw new Error("Racing Phaser runtime requires an image-backed vehicle asset.");
  }
  if (!carAsset.provider || /local-fallback|james-native/i.test(carAsset.provider)) {
    throw new Error("Racing Phaser runtime rejects procedural/native vehicle assets.");
  }
  const racing = spec.racing;
  if (!racing) {
    throw new Error("Racing Phaser runtime requires a racing visual/gameplay specification.");
  }
  const trackAsset = spec.assets.find((asset) => asset.id === racing.trackAssetId);
  if (!trackAsset || trackAsset.kind !== "environment") {
    throw new Error("Racing Phaser runtime requires a declared prompt-derived track environment asset.");
  }
  if (!trackAsset.provider || /local-fallback|james-native/i.test(trackAsset.provider)) {
    throw new Error("Racing Phaser runtime rejects procedural/native track assets.");
  }
  if (trackAsset.racingTrackLayout === "square-loop" && !trackAsset.imageCrop) {
    throw new Error("Racing Phaser runtime requires crop metadata for the curated square-loop track image.");
  }
  if (racing.checkpointAnchors.length !== racing.checkpointCount) {
    throw new Error("Racing Phaser runtime received incomplete checkpoint layout data.");
  }
  if (
    carAsset.animationMode === "sprite-sheet" &&
    (!carAsset.frameWidth || !carAsset.frameHeight || !carAsset.frameCount || carAsset.frameCount < 2)
  ) {
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
    trackAssetUri: trackAsset.uri,
    animationMode: carAsset.animationMode,
    frameWidth: carAsset.frameWidth,
    frameHeight: carAsset.frameHeight,
    frameCount: carAsset.frameCount,
    trackCrop: trackAsset.imageCrop,
    racingTrackLayout: trackAsset.racingTrackLayout,
    racing,
  }).replace(/</g, "\\u003c");

  const carAssetLiteral = JSON.stringify(carAsset.uri).replace(/</g, "\\u003c");


  const script = `
"use strict";
const CFG=${config};
const CAR_ASSET=${carAssetLiteral};

const race={
  speed:0,
  maxSpeed:CFG.racing.maxSpeed,
  checkpoint:0,
  checkpoints:CFG.racing.checkpointCount,
  lap:1,
  totalLaps:CFG.racing.laps,
  upgradeLevel:0,
  finished:false,
  elapsed:0,
  position:{x:480,y:520},
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
  race.maxSpeed=CFG.racing.maxSpeed+race.upgradeLevel;
  race.checkpoint=0;
  race.lap=1;
  race.finished=false;
  race.elapsed=0;
  race.position={x:480,y:520};
  if(window.__RK_RACING_PLAYER__){
    window.__RK_RACING_PLAYER__.x=480;
    window.__RK_RACING_PLAYER__.y=520;
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

function upgradeVehicle(){
  if(!CFG.racing.upgradeEnabled || race.upgradeLevel>=3) return false;
  race.upgradeLevel+=1;
  race.maxSpeed=CFG.racing.maxSpeed+race.upgradeLevel;
  return true;
}

function testAction(action){
  if(action==="accelerate"){ race.speed=Math.min(race.maxSpeed,race.speed+1); return true; }
  if(action==="steer"){ race.position.x=Math.min(820,Math.max(140,race.position.x+40)); return true; }
  if(action==="checkpoint"){ return passCheckpoint(); }
  if(action==="upgrade"){ return upgradeVehicle(); }
  if(action==="finish"){
    while(!race.finished) passCheckpoint();
    return true;
  }
  return false;
}

window.__RK_GAME_TEST__={
  testActions:["accelerate","steer","checkpoint","finish"].concat(CFG.racing.upgradeEnabled?["upgrade"]:[]),
  getState:()=>JSON.parse(JSON.stringify(race)),
  getPlayerState:()=>({
    x:race.position.x,
    y:race.position.y,
    speed:race.speed,
    checkpoint:race.checkpoint,
    lap:race.lap,
    finished:race.finished,
    upgradeLevel:race.upgradeLevel
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
    if(CFG.animationMode==="sprite-sheet"){
      this.load.spritesheet("car",CAR_ASSET,{
        frameWidth:CFG.frameWidth,
        frameHeight:CFG.frameHeight
      });
    }else{
      this.load.image("car",CAR_ASSET);
    }
    this.load.image("track-environment",CFG.trackAssetUri);
  }

  create(){
    this.cameras.main.setBackgroundColor(CFG.palette.background);
    let trackImage;
    if(CFG.trackCrop){
      const sourceImage=this.textures.get("track-environment").getSourceImage();
      const cropTexture=this.textures.createCanvas(
        "track-loop",
        CFG.trackCrop.width,
        CFG.trackCrop.height
      );
      if(!sourceImage || !cropTexture){
        throw new Error("Racing Phaser runtime could not materialize the verified track image crop.");
      }
      const context=cropTexture.getContext();
      context.clearRect(0,0,CFG.trackCrop.width,CFG.trackCrop.height);
      context.drawImage(
        sourceImage,
        CFG.trackCrop.x,
        CFG.trackCrop.y,
        CFG.trackCrop.width,
        CFG.trackCrop.height,
        0,
        0,
        CFG.trackCrop.width,
        CFG.trackCrop.height
      );
      cropTexture.refresh();
      trackImage=this.add.image(480,330,"track-loop").setDisplaySize(540,540).setDepth(-10);
    }else{
      trackImage=this.add.image(480,330,"track-environment").setDisplaySize(960,540).setDepth(-10);
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

    const hud=this.add.text(32,92,"Speed: 0 · Lap: 1/"+race.totalLaps+" · Checkpoint: 0/"+race.checkpoints,{
      fontSize:"14px",
      fontFamily:"Arial",
      color:CFG.palette.light,
      backgroundColor:"#101820",
      padding:{x:8,y:5}
    });

    this.add.text(690,28,CFG.racing.trackStyle.toUpperCase(),{
      fontSize:"12px",
      fontFamily:"Arial",
      color:CFG.palette.accent,
      fontStyle:"bold"
    });

    const car=this.add.image(480,520,"car").setScale(CFG.animationMode==="single-image" ? 0.72 : 1.65);
    car.setOrigin(0.5);
    if(CFG.animationMode==="sprite-sheet"){
      const animatedCar=this.add.sprite(480,520,"car").setScale(1.65);
      animatedCar.setOrigin(0.5);
      this.anims.create({
        key:"car-drive",
        frames:this.anims.generateFrameNumbers("car",{start:0,end:Math.min(3,CFG.frameCount-1)}),
        frameRate:8,
        repeat:-1
      });
      animatedCar.play("car-drive");
      car.destroy();
      window.__RK_RACING_PLAYER__=animatedCar;
    }else{
      window.__RK_RACING_PLAYER__=car;
    }

    this.keys=this.input.keyboard ? this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") : null;
    this.touch={left:false,right:false,accelerate:false,brake:false};

    const button=(x,y,label,key)=>{
      const control=this.add.text(x,y,label,{
        fontSize:"22px",
        fontFamily:"Arial",
        color:CFG.palette.light,
        backgroundColor:"#162a3d",
        padding:{x:12,y:8}
      }).setOrigin(0.5).setInteractive({useHandCursor:true});
      control.on("pointerdown",()=>{this.touch[key]=true;});
      control.on("pointerup",()=>{this.touch[key]=false;});
      control.on("pointerout",()=>{this.touch[key]=false;});
    };

    button(75,485,"◀","left");
    button(145,485,"▶","right");
    button(110,435,"▲","accelerate");
    button(110,535,"▼","brake");

    this.checkpointSprites=CFG.racing.checkpointAnchors.map((point)=>({x:point.x,y:point.y}));

    this.status=this.add.text(32,575,"",{
      fontSize:"13px",
      fontFamily:"Arial",
      color:CFG.palette.light
    });

    window.__RK_GAME_READY__=true;
    window.__RK_GAME_RENDERED__=true;

    this.hud=hud;
    this.updateHud();
  }

  updateHud(){
    this.hud.setText(
      "Speed: "+Math.round(race.speed*20)+
      " · Lap: "+race.lap+"/"+race.totalLaps+
      " · Checkpoint: "+race.checkpoint+"/"+race.checkpoints+
      (CFG.racing.upgradeEnabled ? " · Upgrade: "+race.upgradeLevel : "")
    );
    this.status.setText(
      race.finished
        ? "🏁 Finish! Race completed."
        : "Checkpoint "+(race.checkpoint+1)+" of "+race.checkpoints+" · Lap "+race.lap+" of "+race.totalLaps+
          (CFG.racing.upgradeEnabled ? " · Vehicle upgrade available" : "")
    );
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

    const target=this.checkpointSprites[race.checkpoint];
    if(target){
      const distance=Phaser.Math.Distance.Between(player.x,player.y,target.x,target.y);
      if(distance<42) passCheckpoint();
    }

    this.updateHud();
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
