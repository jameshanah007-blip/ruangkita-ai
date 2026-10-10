import type { PhaserGameSpec } from "./types";

const PHASER_VERSION = "4.2.1";
const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@" + PHASER_VERSION + "/dist/phaser.min.js";

export function buildFarmingGameHtml(spec: PhaserGameSpec): string {
  const farmerAsset = spec.assets.find((asset) => asset.id === spec.player.assetId);
  if (!farmerAsset) {
    throw new Error(
      "Farming Phaser runtime requires the declared player asset: " + spec.player.assetId,
    );
  }
  if (farmerAsset.animationMode !== "sprite-sheet") {
    throw new Error(
      "Farming Phaser runtime requires a sprite-sheet player asset; single-image characters are not accepted.",
    );
  }
  if (
    !farmerAsset.frameWidth ||
    !farmerAsset.frameHeight ||
    !farmerAsset.frameCount ||
    farmerAsset.frameCount < 2
  ) {
    throw new Error(
      "Farming Phaser runtime received invalid player sprite-sheet metadata.",
    );
  }
  const config = JSON.stringify({
    title: spec.title,
    objective: spec.objective,
    winCondition: spec.winCondition,
    loseCondition: spec.loseCondition,
    palette: spec.visual.palette,
    playerAssetUri: farmerAsset.uri,
    playerAssetId: spec.player.assetId,
    playerAnimationMode: farmerAsset.animationMode || "single-image",
    playerFrameWidth: farmerAsset.frameWidth || 256,
    playerFrameHeight: farmerAsset.frameHeight || 256,
  }).replace(/</g, "\\u003c");

  const farmerAssetLiteral = JSON.stringify(farmerAsset.uri).replace(/</g, "\\u003c");
  const environmentAsset = spec.assets.find((asset) => asset.kind === "environment");
  const environmentAssetLiteral = environmentAsset
    ? JSON.stringify(environmentAsset.uri).replace(/</g, "\\u003c")
    : null;
  const npcAsset = spec.assets.find((asset) => asset.kind === "npc");
  const npcAssetLiteral = npcAsset
    ? JSON.stringify(npcAsset.uri).replace(/</g, "\\u003c")
    : null;

  const script = `
"use strict";
const CFG=${config};
const FARMER_ASSET=${farmerAssetLiteral};
const FARM_ENVIRONMENT_ASSET=${environmentAssetLiteral || "null"};
const FARM_NPC_ASSET=${npcAssetLiteral || "null"};
let farm={money:50,wheat:0,tool:"till",harvested:0,day:1,plots:Array.from({length:12},()=>({state:"empty"}))};

function targetMoney(){
  const text=String(CFG.objective||"")+" "+String(CFG.winCondition||"");
  const match=text.match(/\\b(\\d{2,})\\s*(?:uang|money|coins?|gold|dollars?|rupiah|rp)\\b/i);
  return match ? Number(match[1]) : null;
}

function objectiveProgress(){
  const target=targetMoney();
  return target && target>0 ? Math.min(1,farm.money/target) : Math.min(1,farm.harvested/3);
}

window.__RK_GAME_READY__=false;
window.__RK_GAME_RENDERED__=false;
window.__RK_GAME_LOOP_STARTED__=false;

function resetFarm(){
  farm={money:50,wheat:0,tool:"till",harvested:0,day:1,plots:Array.from({length:12},()=>({state:"empty"}))};
}

function testAction(action){
  if(action==="till"){
    const plot=farm.plots.find((item)=>item.state==="empty");
    if(!plot) return false;
    plot.state="tilled";
    return true;
  }
  if(action==="plant"){
    const plot=farm.plots.find((item)=>item.state==="tilled");
    if(!plot) return false;
    plot.state="seed";
    return true;
  }
  if(action==="water"){
    const plot=farm.plots.find((item)=>item.state==="seed"||item.state==="growing");
    if(!plot) return false;
    plot.state="ready";
    return true;
  }
  if(action==="harvest"){
    const plot=farm.plots.find((item)=>item.state==="ready");
    if(!plot) return false;
    plot.state="empty";
    farm.wheat+=1;
    farm.harvested+=1;
    return true;
  }
  if(action==="sell"&&farm.wheat>0){
    farm.money+=farm.wheat*15;
    farm.wheat=0;
    return true;
  }
  return false;
}

window.__RK_GAME_TEST__={
  testActions:["till","plant","water","harvest","sell"],
  getState:()=>JSON.parse(JSON.stringify(farm)),
  getPlayerState:()=>({x:window.__RK_FARM_PLAYER__ ? window.__RK_FARM_PLAYER__.x : 0,y:window.__RK_FARM_PLAYER__ ? window.__RK_FARM_PLAYER__.y : 0}),
  getObjectiveState:()=>({progress:objectiveProgress(),harvested:farm.harvested,money:farm.money,targetMoney:targetMoney()}),
  getWinState:()=>{const target=targetMoney();return target && target>0 ? farm.money>=target : farm.harvested>=3;},
  getLoseState:()=>false,
  performTestAction:(action)=>testAction(action),
  restart:()=>{resetFarm();return true;},
};

class FarmScene extends Phaser.Scene {
  constructor(){super({key:"FarmScene"});}

  preload(){
    if(CFG.playerAnimationMode==="sprite-sheet"){this.load.spritesheet("farmer",FARMER_ASSET,{frameWidth:CFG.playerFrameWidth,frameHeight:CFG.playerFrameHeight});}else{this.load.image("farmer",FARMER_ASSET);}
    if(FARM_ENVIRONMENT_ASSET){this.load.image("farm-environment",FARM_ENVIRONMENT_ASSET);}
    if(FARM_NPC_ASSET){this.load.spritesheet("farm-npc",FARM_NPC_ASSET,{frameWidth:256,frameHeight:256});}
  }

  create(){
    if(CFG.playerAnimationMode==="sprite-sheet"){this.anims.create({key:"farmer-idle",frames:this.anims.generateFrameNumbers("farmer",{start:0,end:3}),frameRate:5,repeat:-1}); this.anims.create({key:"farmer-walk",frames:this.anims.generateFrameNumbers("farmer",{start:4,end:7}),frameRate:8,repeat:-1});}

    this.cameras.main.setBackgroundColor("#9bcf7b");
    this.add.rectangle(480,320,960,640,0x9bcf7b);
    if(FARM_ENVIRONMENT_ASSET){this.add.image(480,270,"farm-environment").setDisplaySize(960,540).setDepth(-10);}
    if(FARM_NPC_ASSET){
      this.anims.create({key:"npc-idle",frames:this.anims.generateFrameNumbers("farm-npc",{start:0,end:3}),frameRate:5,repeat:-1});
      const npc=this.add.sprite(820,420,"farm-npc").setScale(.42);
      npc.play("npc-idle");
    }
    this.add.rectangle(120,150,190,105,0xd6b06e).setStrokeStyle(4,0x8b5a2b);
    this.add.rectangle(820,180,170,135,0xe8d9b5).setStrokeStyle(5,0x7a5534);

    this.add.text(32,24,CFG.title,{
      fontSize:"24px",
      fontFamily:"Arial",
      color:"#fff8e7",
      fontStyle:"bold"
    });

    this.add.text(32,58,CFG.objective,{
      fontSize:"12px",
      fontFamily:"Arial",
      color:"#365314",
      wordWrap:{width:700}
    });

    const hud=this.add.text(32,92,"Money: $50 · Wheat: 0 · Harvested: 0",{
      fontSize:"14px",
      fontFamily:"Arial",
      color:"#fff8e7",
      backgroundColor:"#365314",
      padding:{x:8,y:5}
    });

    const info=this.add.text(
      32,555,
      "Choose Till → Plant → Water → Harvest. Sell wheat at the market.",
      {fontSize:"13px",fontFamily:"Arial",color:"#365314"}
    );

    const player=this.add.sprite(180,430,"farmer").setScale(CFG.playerAnimationMode==="sprite-sheet" ? 0.75 : 0.42);
    if(CFG.playerAnimationMode==="sprite-sheet") player.play("farmer-idle");
    this.farmKeys=this.input.keyboard ? this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") : null;
    this.moveState={left:false,right:false,up:false,down:false};
    const moveButton=(x,y,label,direction)=>{
      const control=this.add.circle(x,y,24,0x365314,0.9).setInteractive({useHandCursor:true});
      this.add.text(x,y,label,{fontSize:"18px",fontFamily:"Arial",color:"#fff8e7",fontStyle:"bold"}).setOrigin(.5);
      control.on("pointerdown",()=>{this.moveState[direction]=true;});
      control.on("pointerup",()=>{this.moveState[direction]=false;});
      control.on("pointerout",()=>{this.moveState[direction]=false;});
      return control;
    };
    moveButton(82,468,"▲","up");
    moveButton(82,532,"▼","down");
    moveButton(42,500,"◀","left");
    moveButton(122,500,"▶","right");
    window.__RK_FARM_PLAYER__=player;

    ["till","plant","water","harvest","sell"].forEach((tool,index)=>{
      const button=this.add.rectangle(120+index*180,620,150,42,0x365314)
        .setInteractive({useHandCursor:true});

      this.add.text(80+index*180,612,tool.toUpperCase(),{
        fontSize:"13px",
        fontFamily:"Arial",
        color:"#fff8e7",
        fontStyle:"bold"
      });

      button.on("pointerdown",()=>{
        farm.tool=tool;
        info.setText("Selected "+tool+". Click a plot.");
      });
    });

    farm.plots.forEach((plot,index)=>{
      const x=330+(index%4)*115;
      const y=245+Math.floor(index/4)*95;

      plot.sprite=this.add.rectangle(x,y,92,68,0x8b5a2b)
        .setStrokeStyle(3,0x6b4423)
        .setInteractive({useHandCursor:true});

      plot.sprite.on("pointerdown",()=>{
        const action=farm.tool;

        if(action==="till"&&plot.state==="empty"){
          plot.state="tilled";
          plot.sprite.setFillStyle(0x6b4423);
        }else if(action==="plant"&&plot.state==="tilled"){
          plot.state="seed";
          plot.sprite.setFillStyle(0x8fbc5a);
        }else if(action==="water"&&(plot.state==="seed"||plot.state==="growing")){
          plot.state="ready";
          plot.sprite.setFillStyle(0xf6bd60);
        }else if(action==="harvest"&&plot.state==="ready"){
          plot.state="empty";
          farm.wheat+=1;
          farm.harvested+=1;
          plot.sprite.setFillStyle(0x8b5a2b);
        }else if(action==="sell"&&farm.wheat>0){
          farm.money+=farm.wheat*15;
          farm.wheat=0;
        }

        hud.setText(
          "Money: $"+farm.money+
          " · Wheat: "+farm.wheat+
          " · Harvested: "+farm.harvested
        );
        info.setText(action.toUpperCase()+" · "+plot.state);
      });
    });

    window.__RK_GAME_READY__=true;
    window.__RK_GAME_RENDERED__=true;
  }

  update(){
    window.__RK_GAME_LOOP_STARTED__=true;
    const player=window.__RK_FARM_PLAYER__;
    if(!player) return;
    const speed=2.4;
    const bridged=window.__RK_KEYBOARD_STATE__||{};
    const left=this.moveState.left || bridged.a || bridged.arrowleft || (this.farmKeys && (this.farmKeys.A.isDown || this.farmKeys.LEFT.isDown));
    const right=this.moveState.right || bridged.d || bridged.arrowright || (this.farmKeys && (this.farmKeys.D.isDown || this.farmKeys.RIGHT.isDown));
    const up=this.moveState.up || bridged.w || bridged.arrowup || (this.farmKeys && (this.farmKeys.W.isDown || this.farmKeys.UP.isDown));
    const down=this.moveState.down || bridged.s || bridged.arrowdown || (this.farmKeys && (this.farmKeys.S.isDown || this.farmKeys.DOWN.isDown));
    if(left) player.x=Math.max(48,player.x-speed);
    if(right) player.x=Math.min(912,player.x+speed);
    if(up) player.y=Math.max(150,player.y-speed);
    if(down) player.y=Math.min(510,player.y+speed);
    if(CFG.playerAnimationMode==="sprite-sheet"){
      const moving=left||right||up||down;
      if(moving && player.anims.currentAnim && player.anims.currentAnim.key!=="farmer-walk") player.play("farmer-walk",true);
      if(!moving && player.anims.currentAnim && player.anims.currentAnim.key!=="farmer-idle") player.play("farmer-idle",true);
    }
  }
}

new Phaser.Game({
  type:Phaser.CANVAS,
  width:960,
  height:640,
  parent:"game",
  backgroundColor:"#9bcf7b",
  scale:{
    mode:Phaser.Scale.FIT,
    autoCenter:Phaser.Scale.CENTER_BOTH,
    width:960,
    height:640
  },
  scene:[FarmScene]
});
`;

  try {
    new Function(script);
  } catch (error) {
    throw new Error(
      "Farming Phaser runtime generated invalid JavaScript: " +
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
