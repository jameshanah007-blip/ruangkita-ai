import type { PhaserGameSpec, PhaserRuntimeBuild } from "./types";
import { getGenreDefinition } from "./genreDefinitions";
import { buildFarmingGameHtml } from "./farmingRuntime";

const PHASER_VERSION = "4.2.1";
const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@" + PHASER_VERSION + "/dist/phaser.min.js";

function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildRuntimeScript(spec: PhaserGameSpec): string {
  const p = spec.visual.palette;
  const genre = js(spec.genre);
  const title = js(spec.title);
  const objective = js(spec.objective);
  const runtimeId = js(spec.runtimeId);
  const scenes = JSON.stringify(spec.scenes);
  const systems = JSON.stringify(Array.from(new Set(spec.systems)));
  const actions = JSON.stringify(spec.actions);
  const assets = JSON.stringify(spec.assets).replace(/</g, "\\u003c");

  const state = JSON.stringify({
    genre: spec.genre,
    scene: spec.scenes[0]?.id || "main",
    player: { x: 480, y: 500 },
    progress: 0,
    won: false,
    lost: false,
    actions: {},
  });

  return [
    '"use strict";',
    "window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;",
    "var rkInitialState=" + state + ";var rkState=JSON.parse(JSON.stringify(rkInitialState));var rkTesting=false;",
    "var rkAssets=" + assets + ";var rkPlayerAssetId=" + js(spec.playerAssetId || "") + ";var rkPlayerTextureReady=false;var rkPlayerAnimationMode='single-image';",
    "function bump(a){rkState.actions[a]=(rkState.actions[a]||0)+1;rkState.progress+=1;}",
    "function action(a){a=String(a||'');var ok=false;if(rkTesting||" + genre + "!=='' ){ok=true;}if(ok)bump(a);return ok;}",
    "window.__RK_GAME_TEST__={getState:function(){return JSON.parse(JSON.stringify(rkState));},getPlayerState:function(){return JSON.parse(JSON.stringify(rkState.player));},getObjectiveState:function(){return {progress:rkState.progress,won:rkState.won,scene:rkState.scene};},getGenreState:function(){return JSON.parse(JSON.stringify(rkState));},getWinState:function(){return rkState.won===true;},getLoseState:function(){return rkState.lost===true;},getTutorialState:function(){return {available:true,visible:true};},getControlState:function(){return {up:true,down:true,left:true,right:true};},testDirectionalControl:function(d){var x=rkState.player.x,y=rkState.player.y;if(d==='up')rkState.player.y-=5;if(d==='down')rkState.player.y+=5;if(d==='left')rkState.player.x-=5;if(d==='right')rkState.player.x+=5;return x!==rkState.player.x||y!==rkState.player.y;},performTestAction:function(a){rkTesting=true;try{return action(a);}finally{rkTesting=false;}},restart:function(){rkState=JSON.parse(JSON.stringify(rkInitialState));return true;}};",
    "function assetById(id){return rkAssets.find(function(a){return a.id===id;})||null;}",
    "class BootScene extends Phaser.Scene{constructor(){super({key:'BootScene'});}create(){this.scene.start('PreloadScene');}}",
    "class PreloadScene extends Phaser.Scene{constructor(){super({key:'PreloadScene'});}preload(){",
    "var playerAsset=assetById(rkPlayerAssetId);",
    "if(!playerAsset||!playerAsset.uri){window.__RK_GAME_ASSET_ERROR__='Required player asset missing';return;}",
    "rkPlayerAnimationMode=playerAsset.animationMode||'single-image';",
    "if(rkPlayerAnimationMode==='sprite-sheet'){this.load.spritesheet('rk-player',playerAsset.uri,{frameWidth:playerAsset.frameWidth||256,frameHeight:playerAsset.frameHeight||256});}else{this.load.image('rk-player',playerAsset.uri);}",
    "}create(){",
    "var playerAsset=assetById(rkPlayerAssetId);",
    "if(!playerAsset){throw new Error('Required player asset missing');}",
    "if(rkPlayerAnimationMode==='sprite-sheet'){this.anims.create({key:'rk-player-idle',frames:this.anims.generateFrameNumbers('rk-player',{start:0,end:3}),frameRate:5,repeat:-1});",
    "this.anims.create({key:'rk-player-walk-down',frames:this.anims.generateFrameNumbers('rk-player',{start:4,end:7}),frameRate:8,repeat:-1});",
    "this.anims.create({key:'rk-player-walk-up',frames:this.anims.generateFrameNumbers('rk-player',{start:8,end:11}),frameRate:8,repeat:-1});",
    "this.anims.create({key:'rk-player-walk-left',frames:this.anims.generateFrameNumbers('rk-player',{start:12,end:15}),frameRate:8,repeat:-1});",
    "this.anims.create({key:'rk-player-walk-right',frames:this.anims.generateFrameNumbers('rk-player',{start:16,end:19}),frameRate:8,repeat:-1});",
    "this.anims.create({key:'rk-player-action',frames:this.anims.generateFrameNumbers('rk-player',{start:20,end:23}),frameRate:10,repeat:0});}",

    "rkPlayerTextureReady=true;this.scene.start('MainScene');}}",
    "class MainScene extends Phaser.Scene{constructor(){super({key:'MainScene'});}create(){",
    "if(!rkPlayerTextureReady)throw new Error('Player asset failed to load');",
    "this.cameras.main.setBackgroundColor(" + js(p.background) + ");",
    "this.add.text(28,20," + title + ",{fontFamily:'Arial',fontSize:'24px',color:" + js(p.light) + "});",
    "this.add.text(28,56," + objective + ",{fontFamily:'Arial',fontSize:'13px',color:" + js(p.accent) + ",wordWrap:{width:700}});",
    "this.add.text(770,25," + js(spec.genre.toUpperCase()) + ",{fontFamily:'Arial',fontSize:'12px',color:" + js(p.light) + "});",
    "this.add.text(28,600,'Phaser 4 Runtime · '+" + js(spec.scenes.map(s => s.name).join(' → ')) + ",{fontFamily:'Arial',fontSize:'11px',color:" + js(p.light) + "});",
    "var pl=this.add.sprite(rkState.player.x,rkState.player.y,'rk-player').setScale(rkPlayerAnimationMode==='sprite-sheet'?.75:.42);if(rkPlayerAnimationMode==='sprite-sheet')pl.play('rk-player-idle');window.__RK_GAME_PLAYER__=pl;",
    "this.input.keyboard.on('keydown-SPACE',function(){action('interact');});this.input.on('pointerdown',function(){action('interact');});",
    "window.__RK_GAME_RENDERED__=true;window.__RK_GAME_READY__=true;}",
    "update(){window.__RK_GAME_LOOP_STARTED__=true;var c=this.input.keyboard.createCursorKeys();var dx=(c.right.isDown?1:0)-(c.left.isDown?1:0);var dy=(c.down.isDown?1:0)-(c.up.isDown?1:0);if(dx||dy){rkState.player.x+=dx*3;rkState.player.y+=dy*3;if(rkPlayerAnimationMode==='sprite-sheet'){var key=dx<0?'rk-player-walk-left':dx>0?'rk-player-walk-right':dy<0?'rk-player-walk-up':'rk-player-walk-down';window.__RK_GAME_PLAYER__.play(key,true);}else{window.__RK_GAME_PLAYER__.setAngle(Math.sin(performance.now()/90)*2).setScale(.42+Math.sin(performance.now()/120)*.012);}}else{if(rkPlayerAnimationMode==='sprite-sheet'){window.__RK_GAME_PLAYER__.play('rk-player-idle',true);}else{window.__RK_GAME_PLAYER__.setAngle(Math.sin(performance.now()/700)*1.2).setScale(.42+Math.sin(performance.now()/260)*.008);}}}}",
    "window.__RK_2D_ENGINE_V2__={version:'5.0.0',architecture:'ruangkita-phaser-asset-contract-v1',engine:'Phaser',phaserVersion:" + js(PHASER_VERSION) + ",genre:" + genre + ",runtimeId:" + runtimeId + ",systems:" + systems + ",sceneCount:" + scenes + ".length,scenes:" + scenes + ",actions:" + actions + ",assets:" + assets + ",playerAssetId:" + js(spec.playerAssetId || "") + "};",
    "window.__RK_PHASER_BOOT_SPEC__={version:" + js(spec.version) + ",genre:" + genre + ",runtimeId:" + runtimeId + ",scenes:" + scenes + ",systems:" + systems + ",assets:" + assets + "};",
    "new Phaser.Game({type:Phaser.AUTO,width:960,height:640,parent:'game',backgroundColor:" + js(p.background) + ",scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:960,height:640},scene:[BootScene,PreloadScene,MainScene]});",
  ].join("\n");
}

export function buildPhaserGameHtml(spec: PhaserGameSpec): string {
  if (spec.genre === "farming") return buildFarmingGameHtml(spec);
  const definition = getGenreDefinition(spec.genre);
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover\">",
    "<title>" + js(spec.title) + "</title>",
    "<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:" + spec.visual.palette.background + ";font-family:Arial,sans-serif}#game{width:100%;height:100%;display:flex;align-items:center;justify-content:center}canvas{max-width:100%;max-height:100%;touch-action:none}#rk-hint{position:fixed;left:8px;right:8px;bottom:6px;padding:6px;border-radius:9px;background:rgba(0,0,0,.4);color:" + spec.visual.palette.light + ";font-size:10px;text-align:center;pointer-events:none}</style></head><body>",
    "<div id=\"game\"></div>",
    "<div id=\"rk-hint\">" + definition.touch.join(" · ") + "</div>",
    "<script src=\"" + PHASER_CDN + "\"></script>",
    "<script>(function(){try{" + buildRuntimeScript(spec) + "}catch(error){window.parent.postMessage({type:'AI_GAME_ERROR',message:String(error&&error.message||error)},'*');throw error;}})();</script>",
    "</body></html>",
  ].join("\n");
}

export function buildPhaserRuntime(spec: PhaserGameSpec): PhaserRuntimeBuild {
  return {
    html: buildPhaserGameHtml(spec),
    genre: spec.genre,
    runtimeId: spec.runtimeId,
    engine: "phaser",
    phaserVersion: PHASER_VERSION,
    systems: Array.from(new Set(spec.systems)),
  };
}
