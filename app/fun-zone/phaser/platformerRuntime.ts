import type { PhaserGameSpec } from "./types";

const PHASER_VERSION = "4.2.1";
const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@" + PHASER_VERSION + "/dist/phaser.min.js";

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Asset-backed platformer runtime. This runtime deliberately fails closed:
 * platform, collectible, finish, environment, and animated player visuals must
 * be supplied as image assets. It never paints geometric stand-ins for them.
 */
export function buildPlatformerGameHtml(spec: PhaserGameSpec): string {
  const player = spec.assets.find((asset) => asset.id === spec.player.assetId);
  if (!player) throw new Error("Platformer runtime requires the declared player image asset.");
  if (player.animationMode !== "sprite-sheet" || !player.frameWidth || !player.frameHeight || !player.frameCount || player.frameCount < 2 || !player.rowCount || player.rowCount < 2) {
    throw new Error("Platformer runtime requires a valid animated player sprite sheet with idle and movement rows.");
  }

  const findImage = (tag: string, label: string) => {
    const asset = spec.assets.find((item) => item.tags?.includes(tag) && item.uri.startsWith("data:image/"));
    if (!asset) throw new Error('Platformer runtime requires a materialized image asset tagged "' + tag + '" for ' + label + '. Geometry fallback is disabled.');
    return asset;
  };
  const platform = findImage("platform-image", "platforms");
  const coin = findImage("coin-image", "collectibles");
  const finish = findImage("finish-image", "the finish goal");
  const environment = spec.assets.find((asset) => asset.kind === "environment" && asset.uri.startsWith("data:image/"));
  const required = [player, platform, coin, finish, ...(environment ? [environment] : [])];
  const assetUris = Object.fromEntries(required.map((asset) => [asset.id, asset.uri]));
  const config = JSON.stringify({
    title: spec.title, objective: spec.objective, palette: spec.visual.palette,
    playerId: player.id, frameWidth: player.frameWidth, frameHeight: player.frameHeight,
    frameCount: player.frameCount, rowCount: player.rowCount,
    platformId: platform.id, coinId: coin.id, finishId: finish.id,
    environmentId: environment?.id || null, assetUris,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>${escapeHtmlText(spec.title)}</title>
<style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#101820;touch-action:none}#game{display:flex;align-items:center;justify-content:center}canvas{max-width:100%;max-height:100%;object-fit:contain}#hint{position:fixed;left:12px;bottom:8px;color:#fff;background:#101820cc;padding:7px 10px;border-radius:8px;font:12px Arial,sans-serif;z-index:2}</style></head>
<body><div id="game"></div><div id="hint">Move: A/D or ←/→ · Jump: Space/↑ · Touch controls supported</div>
<script src="${PHASER_CDN}"></script><script>
"use strict";
const CFG=${config};
window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;
const state={coins:0,won:false,dead:false};let sceneRef=null;
window.__RK_GAME_TEST__={
 testActions:["move_right","jump","collect","reach_finish","restart"],
 getState:()=>({coins:state.coins,won:state.won,dead:state.dead}),
 getPlayerState:()=>sceneRef&&sceneRef.player?({x:sceneRef.player.x,y:sceneRef.player.y,velocityX:sceneRef.player.body.velocity.x,velocityY:sceneRef.player.body.velocity.y}):null,
 getObjectiveState:()=>({progress:Math.min(1,state.coins/5),coins:state.coins}),
 getWinState:()=>state.won,getLoseState:()=>state.dead,
 performTestAction:(action)=>{if(!sceneRef||!sceneRef.player)return false;if(action==="move_right"){sceneRef.player.setVelocityX(180);return true;}if(action==="jump"&&sceneRef.player.body.blocked.down){sceneRef.player.setVelocityY(-430);return true;}if(action==="collect"){const item=sceneRef.coins.getChildren().find((c)=>c.active);if(!item)return false;sceneRef.collectCoin(item);return true;}if(action==="reach_finish"){sceneRef.reachFinish();return true;}return false;},
 restart:()=>{if(!sceneRef)return false;state.coins=0;state.won=false;state.dead=false;sceneRef.scene.restart();return true;}
};
class PlatformerScene extends Phaser.Scene{
 constructor(){super({key:"PlatformerScene"});this.move={left:false,right:false};this.touchJump=false;}
 preload(){
  Object.entries(CFG.assetUris).forEach(([id,uri])=>{if(id===CFG.playerId)this.load.spritesheet(id,uri,{frameWidth:CFG.frameWidth,frameHeight:CFG.frameHeight});else this.load.image(id,uri);});
 }
 create(){
  sceneRef=this;this.cameras.main.setBackgroundColor(CFG.palette.background);this.physics.world.setBounds(0,0,2200,640);
  if(CFG.environmentId)this.add.image(1100,320,CFG.environmentId).setDisplaySize(2200,640).setDepth(-10);
  this.platforms=this.physics.add.staticGroup();
  const placePlatform=(x,y,w)=>{const p=this.platforms.create(x,y,CFG.platformId).setDisplaySize(w,30).refreshBody();};
  placePlatform(1100,628,2200);[[270,510,190],[520,430,170],[790,350,170],[1080,450,190],[1370,365,190],[1640,475,180],[1900,390,190]].forEach(([x,y,w])=>placePlatform(x,y,w));
  this.player=this.physics.add.sprite(80,540,CFG.playerId).setScale(Math.min(1,96/Math.max(CFG.frameWidth,CFG.frameHeight)));
  this.player.setCollideWorldBounds(false);this.player.setBounce(0.04);this.player.setMaxVelocity(260,650);this.physics.add.collider(this.player,this.platforms);
  const rowFrames=Math.max(2,Math.min(CFG.frameCount,8));
  this.anims.create({key:"hero-idle",frames:this.anims.generateFrameNumbers(CFG.playerId,{start:0,end:Math.min(rowFrames-1,3)}),frameRate:5,repeat:-1});
  this.anims.create({key:"hero-run",frames:this.anims.generateFrameNumbers(CFG.playerId,{start:rowFrames,end:Math.min(rowFrames*2-1,rowFrames*2-1)}),frameRate:10,repeat:-1});this.player.play("hero-idle");
  this.coins=this.physics.add.staticGroup();[[300,465],[550,385],[820,305],[1110,405],[1400,320],[1670,430],[1930,345]].forEach(([x,y])=>{const c=this.coins.create(x,y,CFG.coinId).setDisplaySize(26,26);});
  this.physics.add.overlap(this.player,this.coins,(_,item)=>this.collectCoin(item));
  this.finish=this.physics.add.staticImage(2070,330,CFG.finishId).setDisplaySize(58,80).refreshBody();
  this.finishHintShown=false;
  this.physics.add.overlap(this.player,this.finish,()=>this.reachFinish());
  this.add.text(18,16,CFG.title,{fontSize:"22px",fontFamily:"Arial",fontStyle:"bold",color:CFG.palette.light}).setScrollFactor(0);
  this.add.text(18,48,CFG.objective,{fontSize:"12px",fontFamily:"Arial",color:CFG.palette.light,wordWrap:{width:680}}).setScrollFactor(0);
  this.hud=this.add.text(18,72,"Coins: 0 / 5",{fontSize:"16px",fontFamily:"Arial",color:CFG.palette.light,backgroundColor:"#00000088",padding:{x:8,y:5}}).setScrollFactor(0);
  this.cameras.main.setBounds(0,0,2200,640);this.cameras.main.startFollow(this.player,true,0.08,0.08);
  this.keys=this.input.keyboard?this.input.keyboard.addKeys("A,D,LEFT,RIGHT,SPACE,UP,W"):{};
  const touch=(x,label,kind)=>{const b=this.add.image(x,560,CFG.platformId).setDisplaySize(58,58).setScrollFactor(0).setInteractive();this.add.text(x,560,label,{fontSize:"22px",color:"#ffffff"}).setOrigin(.5).setScrollFactor(0);b.on("pointerdown",()=>{if(kind==="left")this.move.left=true;else if(kind==="right")this.move.right=true;else this.touchJump=true;});const release=()=>{if(kind==="left")this.move.left=false;else if(kind==="right")this.move.right=false;else this.touchJump=false;};b.on("pointerup",release);b.on("pointerout",release);};
  touch(54,"◀","left");touch(124,"▶","right");touch(900,"▲","jump");
  window.__RK_GAME_RENDERED__=true;window.__RK_GAME_READY__=true;
 }
 collectCoin(item){if(!item||!item.active||state.dead||state.won)return;item.destroy();state.coins++;this.hud.setText("Coins: "+state.coins+" / 5"+(state.coins>=5?" — Reach the flag!":""));}
 reachFinish(){if(state.dead||state.won)return;if(state.coins<5){if(!this.finishHintShown){this.finishHintShown=true;this.add.text(480,260,"Collect five coins before finishing",{fontSize:"22px",fontFamily:"Arial",color:"#ffffff",backgroundColor:"#000000bb",padding:{x:14,y:10}}).setOrigin(.5).setScrollFactor(0).setDepth(100);}return;}state.won=true;this.player.setVelocity(0,0);this.player.body.setEnable(false);this.add.text(480,300,"You win! Restart to play again",{fontSize:"26px",fontFamily:"Arial",color:"#ffffff",backgroundColor:"#000000bb",padding:{x:14,y:10}}).setOrigin(.5).setScrollFactor(0).setDepth(100); }
 update(){
  if(!this.player||!this.player.body)return;window.__RK_GAME_LOOP_STARTED__=true;
  if(state.won||state.dead){this.player.setVelocity(0,0);return;}
  const left=this.move.left||this.keys.A?.isDown||this.keys.LEFT?.isDown,right=this.move.right||this.keys.D?.isDown||this.keys.RIGHT?.isDown;
  if(left){this.player.setVelocityX(-210);this.player.setFlipX(true);if(this.player.anims.currentAnim?.key!=="hero-run")this.player.play("hero-run",true);}
  else if(right){this.player.setVelocityX(210);this.player.setFlipX(false);if(this.player.anims.currentAnim?.key!=="hero-run")this.player.play("hero-run",true);}
  else{this.player.setVelocityX(0);if(this.player.anims.currentAnim?.key!=="hero-idle")this.player.play("hero-idle",true);}
  if((Phaser.Input.Keyboard.JustDown(this.keys.SPACE)||Phaser.Input.Keyboard.JustDown(this.keys.UP)||Phaser.Input.Keyboard.JustDown(this.keys.W)||this.touchJump)&&this.player.body.blocked.down){this.player.setVelocityY(-430);this.touchJump=false;}
  if(this.player.y>720&&!state.dead){state.dead=true;this.player.setVelocity(0,0);this.player.body.setEnable(false);this.add.text(480,300,"You fell! Restart to try again",{fontSize:"24px",fontFamily:"Arial",color:"#ffffff",backgroundColor:"#000000bb",padding:{x:14,y:10}}).setOrigin(.5).setScrollFactor(0).setDepth(100); }
 }
}
new Phaser.Game({type:Phaser.AUTO,parent:"game",width:960,height:640,backgroundColor:CFG.palette.background,preserveDrawingBuffer:true,physics:{default:"arcade",arcade:{gravity:{y:900},debug:false}},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[PlatformerScene]});
</script></body></html>`;
}
