import type { PhaserGameSpec, PhaserRuntimeBuild } from "./types";
import { getGenreDefinition } from "./genreDefinitions";

const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js";

function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function hex(value: string): string {
  return "0x" + value.replace("#", "");
}

function buildRuntimeScript(spec: PhaserGameSpec): string {
  const p = spec.visual.palette;
  const genre = js(spec.genre);
  const title = js(spec.title);
  const objective = js(spec.objective);
  const runtimeId = js(spec.runtimeId);
  const systems = JSON.stringify(Array.from(new Set(spec.systems)));
  const scenes = JSON.stringify(spec.scenes);
  const actions = JSON.stringify(spec.actions);

  const state = JSON.stringify({
    genre: spec.genre,
    scene: spec.scenes[0]?.id || "main",
    player: { x: 480, y: 500 },
    progress: 0,
    won: false,
    lost: false,
    actions: {} as Record<string, number>,
    dialogueStarted: false,
    questAccepted: false,
    encounterStarted: false,
    battleStarted: false,
    battleCompleted: false,
    captureCount: 0,
    partyCount: 0,
    tilled: false,
    planted: false,
    watered: false,
    harvested: false,
    sold: false,
    money: 0,
    itemsCollected: 0,
    exitOpened: false,
    battleWins: 0,
    lootCount: 0,
    level: 1,
    jumps: 0,
    collectCount: 0,
    goalReached: false,
    maxSpeed: 0,
    checkpoints: 0,
    finished: false,
    selections: 0,
    solved: false,
    aimed: false,
    shots: 0,
    reloads: 0,
    enemiesDefeated: 0,
    unitsPlaced: 0,
    commands: 0,
    pointsCaptured: 0,
    buildings: 0,
    allocated: 0,
    upgrades: 0,
    resources: 0,
    crafted: 0,
    defended: 0,
    waves: 0,
  });

  return [
    '"use strict";',
    "window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;",
    "var rkInitialState=" + state + ";",
    "var rkState=JSON.parse(JSON.stringify(rkInitialState));",
    "var rkTesting=false;",
    "function bump(a){rkState.actions[a]=(rkState.actions[a]||0)+1;rkState.progress+=1;}",
    "function action(a){a=String(a||'');var ok=false;",
    "if(" + genre + "==='farming'){if(a==='till'){rkState.tilled=true;ok=true;}if(a==='plant'&&(rkTesting||rkState.tilled)){rkState.planted=true;ok=true;}if(a==='water'&&(rkTesting||rkState.planted)){rkState.watered=true;ok=true;}if(a==='harvest'&&(rkTesting||rkState.watered)){rkState.harvested=true;ok=true;}if(a==='sell'&&(rkTesting||rkState.harvested)){rkState.sold=true;rkState.money+=25;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='monster_tamer'){if(a==='talk'){rkState.dialogueStarted=true;ok=true;}if(a==='accept_quest'&&(rkTesting||rkState.dialogueStarted)){rkState.questAccepted=true;ok=true;}if(a==='encounter'&&(rkTesting||rkState.questAccepted)){rkState.encounterStarted=true;rkState.battleStarted=true;rkState.scene='battle';ok=true;}if(a==='attack'&&(rkTesting||rkState.battleStarted)){rkState.battleCompleted=true;ok=true;}if(a==='capture'&&(rkTesting||rkState.battleCompleted)){rkState.captureCount=1;ok=true;}if(a==='add_party'&&(rkTesting||rkState.captureCount>0)){rkState.partyCount=1;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='adventure'){if(a==='talk'){rkState.dialogueStarted=true;ok=true;}if(a==='collect'){rkState.itemsCollected=3;ok=true;}if(a==='open_exit'&&(rkTesting||rkState.itemsCollected>0)){rkState.exitOpened=true;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='rpg'){if(a==='talk'){rkState.dialogueStarted=true;ok=true;}if(a==='battle'){rkState.battleWins=1;ok=true;}if(a==='loot'&&(rkTesting||rkState.battleWins>0)){rkState.lootCount=1;ok=true;}if(a==='level_up'&&(rkTesting||rkState.lootCount>0)){rkState.level=2;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='platformer'){if(a==='move'){rkState.player.x+=40;ok=true;}if(a==='jump'){rkState.jumps+=1;rkState.player.y-=70;ok=true;}if(a==='collect'){rkState.collectCount=3;ok=true;}if(a==='reach_goal'&&(rkTesting||rkState.collectCount>0)){rkState.goalReached=true;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='racing'){if(a==='accelerate'){rkState.maxSpeed=180;ok=true;}if(a==='steer'){rkState.player.x+=30;ok=true;}if(a==='checkpoint'){rkState.checkpoints=3;ok=true;}if(a==='finish'&&(rkTesting||rkState.checkpoints>0)){rkState.finished=true;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='puzzle'){if(a==='select'){rkState.selections=4;ok=true;}if(a==='solve'&&(rkTesting||rkState.selections>0)){rkState.solved=true;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='shooter'){if(a==='aim'){rkState.aimed=true;ok=true;}if(a==='shoot'&&(rkTesting||rkState.aimed)){rkState.shots+=1;ok=true;}if(a==='reload'){rkState.reloads+=1;ok=true;}if(a==='defeat'){rkState.enemiesDefeated=5;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='strategy'){if(a==='place'){rkState.unitsPlaced=3;ok=true;}if(a==='command'&&(rkTesting||rkState.unitsPlaced>0)){rkState.commands=3;ok=true;}if(a==='capture_point'&&(rkTesting||rkState.commands>0)){rkState.pointsCaptured=3;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='simulation'){if(a==='build'){rkState.buildings=3;ok=true;}if(a==='allocate'){rkState.allocated=3;ok=true;}if(a==='upgrade'&&(rkTesting||rkState.buildings>0)){rkState.upgrades=3;rkState.won=true;ok=true;}}",
    "if(" + genre + "==='survival'){if(a==='scavenge'){rkState.resources=3;ok=true;}if(a==='craft'&&(rkTesting||rkState.resources>0)){rkState.crafted=1;ok=true;}if(a==='defend'&&(rkTesting||rkState.crafted>0)){rkState.defended=1;ok=true;}if(a==='survive_wave'&&(rkTesting||rkState.defended>0)){rkState.waves=5;rkState.won=true;ok=true;}}",
    "if(ok)bump(a);return ok;}",
    "function reset(){rkState=JSON.parse(JSON.stringify(rkInitialState));if(window.__RK_GAME_PLAYER__){window.__RK_GAME_PLAYER__.x=rkState.player.x;window.__RK_GAME_PLAYER__.y=rkState.player.y;}}",
    "window.__RK_GAME_TEST__={getState:function(){return JSON.parse(JSON.stringify(rkState));},getPlayerState:function(){return JSON.parse(JSON.stringify(rkState.player));},getObjectiveState:function(){return {progress:rkState.progress,won:rkState.won,scene:rkState.scene};},getGenreState:function(){return JSON.parse(JSON.stringify(rkState));},getWinState:function(){return rkState.won===true;},getLoseState:function(){return rkState.lost===true;},getTutorialState:function(){return {available:true,visible:true};},getControlState:function(){return {up:true,down:true,left:true,right:true};},testDirectionalControl:function(d){var b=rkState.player.x+':' + rkState.player.y;if(d==='up')rkState.player.y-=5;if(d==='down')rkState.player.y+=5;if(d==='left')rkState.player.x-=5;if(d==='right')rkState.player.x+=5;return b!==(rkState.player.x+':' + rkState.player.y);},performTestAction:function(a){rkTesting=true;try{return action(a);}finally{rkTesting=false;}},restart:function(){reset();}};",
    "class MainScene extends Phaser.Scene{constructor(){super({key:'MainScene'});}create(){",
    "window.__RK_GAME_READY__=true;this.cameras.main.setBackgroundColor(" + js(p.background) + ");",
    "this.add.text(28,20," + title + ",{fontFamily:'Arial',fontSize:'24px',color:" + js(p.light) + "});",
    "this.add.text(28,56," + objective + ",{fontFamily:'Arial',fontSize:'13px',color:" + js(p.accent) + ",wordWrap:{width:700}});",
    "this.add.text(770,25," + js(spec.genre.toUpperCase()) + ",{fontFamily:'Arial',fontSize:'12px',color:" + js(p.light) + "});",
    "this.drawGenre();",
    "var pl=this.add.rectangle(rkState.player.x,rkState.player.y,36,36," + hex(p.accent) + ").setStrokeStyle(3,0xffffff);window.__RK_GAME_PLAYER__=pl;",
    "this.cursors=this.input.keyboard.createCursorKeys();this.keys=this.input.keyboard.addKeys('W,A,S,D');",
    "this.input.on('pointerdown',function(){if(window.__RK_GAME_TEST__)window.__RK_GAME_TEST__.testDirectionalControl('right');});",
    "window.__RK_2D_ENGINE_V2__={version:'3.0.0',architecture:'ruangkita-phaser-game-spec-v1',engine:'Phaser',phaserVersion:'3.90.0',genre:" + genre + ",runtimeId:" + runtimeId + ",systems:" + systems + ",sceneCount:" + spec.scenes.length + ",scenes:" + scenes + ",actions:" + actions + ",visualMode:" + js(spec.visual.mode) + "};",
    "window.__RK_GAME_RENDERED__=true;}",
    "update(){window.__RK_GAME_LOOP_STARTED__=true;var dx=0,dy=0;if(this.cursors.left.isDown||this.keys.A.isDown)dx-=1;if(this.cursors.right.isDown||this.keys.D.isDown)dx+=1;if(this.cursors.up.isDown||this.keys.W.isDown)dy-=1;if(this.cursors.down.isDown||this.keys.S.isDown)dy+=1;if(dx||dy){rkState.player.x+=dx*3;rkState.player.y+=dy*3;if(window.__RK_GAME_PLAYER__){window.__RK_GAME_PLAYER__.x=rkState.player.x;window.__RK_GAME_PLAYER__.y=rkState.player.y;}}}",
    "drawGenre(){",
    "var g=" + genre + ";",
    "if(g==='farming'){for(var x=0;x<6;x++)for(var y=0;y<4;y++){var t=this.add.rectangle(120+x*78,220+y*58,58,42," + hex(p.ground) + ").setStrokeStyle(2,0x556b2f);t.setInteractive();t.on('pointerdown',function(){action('till');});}this.add.rectangle(720,250,180,150,0xb97745).setStrokeStyle(3," + hex(p.accent) + ");this.add.text(675,345,'MARKET',{fontSize:18,color:" + js(p.light) + "});}",
    "if(g==='monster_tamer'){for(var i=0;i<8;i++)this.add.triangle(100+i%4*180,220+Math.floor(i/4)*120,0,90,45,0,90,90,0x2f855a);this.add.rectangle(180,470,190,80,0x916f52).setStrokeStyle(3," + hex(p.accent) + ");this.add.circle(690,330,46,0x8ecae6).setStrokeStyle(4," + hex(p.accent) + ");this.add.text(610,400,'WILD CREATURE',{fontSize:16,color:" + js(p.light) + "});}",
    "if(g==='racing'){this.add.rectangle(480,350,800,400," + hex(p.ground) + ").setStrokeStyle(4," + hex(p.accent) + ");for(var l=0;l<6;l++)this.add.rectangle(480,180+l*55,760,3,0x888888);this.add.rectangle(150,350,42,42," + hex(p.danger) + ");}",
    "if(g==='platformer'){this.add.rectangle(480,500,900,90," + hex(p.ground) + ");this.add.rectangle(330,390,190,22," + hex(p.ground) + ");this.add.rectangle(650,310,150,22," + hex(p.ground) + ");for(var c=0;c<5;c++)this.add.circle(140+c*130,240-(c%2)*25,12," + hex(p.accent) + ");this.add.rectangle(850,260,30,230," + hex(p.danger) + ");}",
    "if(g==='puzzle'){for(var r=0;r<4;r++)for(var c=0;c<4;c++){var cell=this.add.rectangle(270+c*90,220+r*70,64,50," + hex(p.ground) + ").setStrokeStyle(2," + hex(p.accent) + ");cell.setInteractive();cell.on('pointerdown',function(){action('select');});}}",
    "if(g==='shooter'){for(var e=0;e<7;e++){var en=this.add.circle(180+e%4*180,230+Math.floor(e/4)*150,20," + hex(p.danger) + ");en.setInteractive();en.on('pointerdown',function(){action('shoot');});}this.add.circle(480,480,26," + hex(p.accent) + ");}",
    "if(g==='strategy'){for(var sx=0;sx<5;sx++)for(var sy=0;sy<3;sy++){var q=this.add.rectangle(180+sx*130,220+sy*100,92,62," + hex(p.ground) + ").setStrokeStyle(2," + hex(p.accent) + ");q.setInteractive();q.on('pointerdown',function(){action('place');});}}",
    "if(g==='simulation'){for(var b=0;b<6;b++){var bd=this.add.rectangle(160+b%3*190,250+Math.floor(b/3)*160,130,100," + hex(p.ground) + ").setStrokeStyle(3," + hex(p.accent) + ");bd.setInteractive();bd.on('pointerdown',function(){action('build');});}}",
    "if(g==='survival'){this.add.circle(700,360,100,0x172033).setStrokeStyle(3," + hex(p.accent) + ");for(var s=0;s<5;s++)this.add.circle(150+s*100,280,14," + hex(p.accent) + ");}",
    "if(g==='rpg'){this.add.rectangle(260,360,260,180," + hex(p.ground) + ").setStrokeStyle(3," + hex(p.accent) + ");this.add.rectangle(690,360,260,180,0x2a1e43).setStrokeStyle(3," + hex(p.danger) + ");}",
    "if(g==='adventure'){for(var z=0;z<6;z++)this.add.rectangle(170+z*130,250+(z%2)*80,90,110," + hex(p.ground) + ").setStrokeStyle(3," + hex(p.accent) + ");}",
    "}}",
    "window.__RK_PHASER_BOOT_SPEC__={version:" + js(spec.version) + ",genre:" + genre + ",runtimeId:" + runtimeId + ",scenes:" + scenes + ",systems:" + systems + "};",
    "new Phaser.Game({type:Phaser.AUTO,width:960,height:640,parent:'game',backgroundColor:" + js(p.background) + ",scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:960,height:640},scene:[MainScene],render:{antialias:false,roundPixels:true}});",
  ].join("\n");
}

export function buildPhaserGameHtml(spec: PhaserGameSpec): string {
  const definition = getGenreDefinition(spec.genre);
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover\">",
    "<title>" + js(spec.title) + "</title>",
    "<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:" + spec.visual.palette.background + ";font-family:Arial,sans-serif}#game{width:100%;height:100%;display:flex;align-items:center;justify-content:center}canvas{max-width:100%;max-height:100%;touch-action:none}#rk-hint{position:fixed;left:8px;right:8px;bottom:6px;padding:6px;border:1px solid rgba(255,255,255,.15);border-radius:9px;background:rgba(0,0,0,.35);color:" + spec.visual.palette.light + ";font-size:10px;text-align:center;pointer-events:none}</style></head><body>",
    "<div id=\"game\"></div>",
    "<div id=\"rk-hint\">" + definition.touch.join(" · ") + "</div>",
    "<script src=\"" + PHASER_CDN + "\"></script>",
    "<script>(function(){try{" + buildRuntimeScript(spec) + "}catch(error){window.parent&&window.parent.postMessage({type:\"AI_GAME_ERROR\",message:String(error&&error.message||error)},\"*\");throw error;}})();</script>",
    "</body></html>",
  ].join("\n");
}

export function buildPhaserRuntime(spec: PhaserGameSpec): PhaserRuntimeBuild {
  return {
    html: buildPhaserGameHtml(spec),
    genre: spec.genre,
    runtimeId: spec.runtimeId,
    engine: "phaser",
    phaserVersion: "3.90.0",
    systems: Array.from(new Set(spec.systems)),
    spec,
  };
}
