import type { PhaserGameSpec } from "./types";

const PHASER_VERSION = "4.2.1";
const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@" + PHASER_VERSION + "/dist/phaser.min.js";

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Dedicated asset-backed platformer runtime.
 * The player must be a real materialized sprite sheet; this runtime never draws a
 * geometric substitute for the player character.
 */
export function buildPlatformerGameHtml(spec: PhaserGameSpec): string {
  const player = spec.assets.find((asset) => asset.id === spec.player.assetId);
  if (!player) {
    throw new Error("Platformer Phaser runtime requires the declared player asset: " + spec.player.assetId);
  }
  if (player.animationMode !== "sprite-sheet") {
    throw new Error("Platformer Phaser runtime requires an animated sprite-sheet player asset; single-image characters are not accepted.");
  }
  if (!player.frameWidth || !player.frameHeight || !player.frameCount || player.frameCount < 2) {
    throw new Error("Platformer Phaser runtime received invalid player sprite-sheet metadata.");
  }

  const environment = spec.assets.find((asset) => asset.kind === "environment");
  const config = JSON.stringify({
    title: spec.title,
    objective: spec.objective,
    winCondition: spec.winCondition,
    loseCondition: spec.loseCondition,
    palette: spec.visual.palette,
    playerAssetId: player.id,
    playerUri: player.uri,
    frameWidth: player.frameWidth,
    frameHeight: player.frameHeight,
    frameCount: player.frameCount,
    environmentUri: environment?.uri || null,
  }).replace(/</g, "\\u003c");
  const playerUri = JSON.stringify(player.uri).replace(/</g, "\\u003c");
  const environmentUri = environment ? JSON.stringify(environment.uri).replace(/</g, "\\u003c") : "null";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>${escapeHtmlText(spec.title)}</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101820;font-family:Arial,sans-serif;touch-action:none}#game{width:100%;height:100%;display:flex;align-items:center;justify-content:center}canvas{max-width:100%;max-height:100%;object-fit:contain}#hint{position:fixed;left:12px;bottom:8px;color:#fff;background:#101820cc;padding:7px 10px;border-radius:8px;font-size:12px;z-index:2}</style></head>
<body><div id="game"></div><div id="hint">Move: A/D or ←/→ · Jump: Space/↑ · Touch controls supported</div>
<script src="${PHASER_CDN}"></script><script>
"use strict";
const CFG=${config};
const PLAYER_ASSET=${playerUri};
const ENVIRONMENT_ASSET=${environmentUri};
window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;
const state={coins:0,won:false,dead:false,startedAt:Date.now()};
let sceneRef=null;
window.__RK_GAME_TEST__={
 testActions:["move_right","jump","collect","restart"],
 getState:()=>({coins:state.coins,won:state.won,dead:state.dead}),
 getPlayerState:()=>sceneRef&&sceneRef.player?({x:sceneRef.player.x,y:sceneRef.player.y,velocityX:sceneRef.player.body.velocity.x,velocityY:sceneRef.player.body.velocity.y}):null,
 getObjectiveState:()=>({progress:Math.min(1,state.coins/5),coins:state.coins}),
 getWinState:()=>state.won,getLoseState:()=>state.dead,
 performTestAction:(action)=>{if(!sceneRef)return false;if(action==="move_right"){sceneRef.player.setVelocityX(180);return true;}if(action==="jump"&&sceneRef.player.body.blocked.down){sceneRef.player.setVelocityY(-430);return true;}if(action==="collect"){const coin=sceneRef.coins.getChildren().find((item)=>item.active);if(!coin)return false;sceneRef.physics.overlap(sceneRef.player,coin,()=>sceneRef.collectCoin(coin));return true;}return false;},
 restart:()=>{if(!sceneRef)return false;state.coins=0;state.won=false;state.dead=false;sceneRef.scene.restart();return true;}
};
class PlatformerScene extends Phaser.Scene{
 constructor(){super({key:"PlatformerScene"});this.move={left:false,right:false};this.touchJump=false;}
 preload(){this.load.spritesheet("hero",PLAYER_ASSET,{frameWidth:CFG.frameWidth,frameHeight:CFG.frameHeight});if(ENVIRONMENT_ASSET)this.load.image("environment",ENVIRONMENT_ASSET);}
 create(){
  sceneRef=this;this.cameras.main.setBackgroundColor(CFG.palette.background);
  if(ENVIRONMENT_ASSET){this.add.image(480,270,"environment").setDisplaySize(960,540).setDepth(-5);}
  this.physics.world.setBounds(0,0,2200,640);
  const platform=(x,y,w)=>{const p=this.add.rectangle(x,y,w,18,parseInt(CFG.palette.ground.replace("#",""),16));this.physics.add.existing(p,true);this.platforms.add(p);};
  this.platforms=this.physics.add.staticGroup();
  // The ground must have a static Arcade body; a decorative rectangle alone cannot stop falling.
  platform(1100,628,2200);
  // Level layout is environmental geometry, not a substitute for the animated character art.
  platform(270,510,190);platform(520,430,170);platform(790,350,170);platform(1080,450,190);platform(1370,365,190);platform(1640,475,180);platform(1900,390,190);
  this.physics.world.setBounds(0,0,2200,640);
  this.player=this.physics.add.sprite(80,540,"hero").setScale(Math.min(1,96/Math.max(CFG.frameWidth,CFG.frameHeight)));
  this.player.setCollideWorldBounds(false);this.player.setBounce(0.04);this.player.setMaxVelocity(260,650);
  this.physics.add.collider(this.player,this.platforms);
  const frames=Math.max(2,Math.min(CFG.frameCount,8));
  this.anims.create({key:"hero-idle",frames:this.anims.generateFrameNumbers("hero",{start:0,end:Math.min(3,frames-1)}),frameRate:5,repeat:-1});
  this.anims.create({key:"hero-run",frames:this.anims.generateFrameNumbers("hero",{start:0,end:frames-1}),frameRate:10,repeat:-1});
  this.player.play("hero-idle");
  this.coins=this.physics.add.staticGroup();
  [[300,465],[550,385],[820,305],[1110,405],[1400,320],[1670,430],[1930,345]].forEach(([x,y])=>{const c=this.add.circle(x,y,11,parseInt(CFG.palette.accent.replace("#",""),16));this.physics.add.existing(c,true);this.coins.add(c);});
  this.physics.add.overlap(this.player,this.coins,(hero,coin)=>this.collectCoin(coin));
  this.add.text(18,16,CFG.title,{fontSize:"22px",fontFamily:"Arial",fontStyle:"bold",color:CFG.palette.light}).setScrollFactor(0);
  this.add.text(18,48,CFG.objective,{fontSize:"12px",fontFamily:"Arial",color:CFG.palette.light,wordWrap:{width:680}}).setScrollFactor(0);
  this.hud=this.add.text(18,72,"Coins: 0 / 5",{fontSize:"16px",fontFamily:"Arial",color:CFG.palette.light,backgroundColor:"#00000088",padding:{x:8,y:5}}).setScrollFactor(0);
  this.cameras.main.setBounds(0,0,2200,640);this.cameras.main.startFollow(this.player,true,0.08,0.08);
  this.keys=this.input.keyboard?this.input.keyboard.addKeys("A,D,LEFT,RIGHT,SPACE,UP,W"):{};
  const touchButton=(x,label,kind)=>{const b=this.add.circle(x,560,30,0x17212b,0.8).setStrokeStyle(2,0xffffff).setScrollFactor(0).setInteractive();this.add.text(x,560,label,{fontSize:"22px",color:"#ffffff"}).setOrigin(.5).setScrollFactor(0);b.on("pointerdown",()=>{if(kind==="left")this.move.left=true;else if(kind==="right")this.move.right=true;else this.touchJump=true;});const release=()=>{if(kind==="left")this.move.left=false;else if(kind==="right")this.move.right=false;else this.touchJump=false;};b.on("pointerup",release);b.on("pointerout",release);};
  touchButton(54,"◀","left");touchButton(124,"▶","right");touchButton(900,"▲","jump");
  window.__RK_GAME_RENDERED__=true;window.__RK_GAME_READY__=true;
 }
 collectCoin(coin){if(!coin||!coin.active)return;coin.destroy();state.coins++;this.hud.setText("Coins: "+state.coins+" / 5");if(state.coins>=5)state.won=true;}
 update(){
  if(!this.player||!this.player.body)return;window.__RK_GAME_LOOP_STARTED__=true;
  const left=this.move.left||this.keys.A?.isDown||this.keys.LEFT?.isDown;
  const right=this.move.right||this.keys.D?.isDown||this.keys.RIGHT?.isDown;
  if(left){this.player.setVelocityX(-210);this.player.setFlipX(true);if(this.player.anims.currentAnim?.key!=="hero-run")this.player.play("hero-run",true);}
  else if(right){this.player.setVelocityX(210);this.player.setFlipX(false);if(this.player.anims.currentAnim?.key!=="hero-run")this.player.play("hero-run",true);}
  else{this.player.setVelocityX(0);if(this.player.anims.currentAnim?.key!=="hero-idle")this.player.play("hero-idle",true);}
  if((Phaser.Input.Keyboard.JustDown(this.keys.SPACE)||Phaser.Input.Keyboard.JustDown(this.keys.UP)||Phaser.Input.Keyboard.JustDown(this.keys.W)||this.touchJump)&&this.player.body.blocked.down){this.player.setVelocityY(-430);this.touchJump=false;}
  if(this.player.y>720){state.dead=true;this.scene.restart();}
 }
}
const game=new Phaser.Game({type:Phaser.AUTO,parent:"game",width:960,height:640,backgroundColor:CFG.palette.background,physics:{default:"arcade",arcade:{gravity:{y:900},debug:false}},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[PlatformerScene]});
window.__RK_GAME__=game;
function escapeHtml(value){return String(value).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
</script></body></html>`;
}
