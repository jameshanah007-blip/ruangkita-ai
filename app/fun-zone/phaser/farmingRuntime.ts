import type { PhaserGameSpec } from "./types";

const PHASER_VERSION = "4.2.1";
const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@" + PHASER_VERSION + "/dist/phaser.min.js";

export function buildFarmingGameHtml(spec: PhaserGameSpec): string {
  const config = JSON.stringify({
    title: spec.title,
  const farmerSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"128\" height=\"32\"><g stroke=\"#fff\" stroke-width=\"2\" fill=\"#f6bd60\"><rect x=\"4\" y=\"6\" width=\"22\" height=\"22\" rx=\"8\"/><circle cx=\"15\" cy=\"13\" r=\"2\" fill=\"#365314\"/><rect x=\"36\" y=\"4\" width=\"22\" height=\"24\" rx=\"8\"/><circle cx=\"47\" cy=\"12\" r=\"2\" fill=\"#365314\"/><rect x=\"68\" y=\"7\" width=\"22\" height=\"21\" rx=\"8\"/><circle cx=\"79\" cy=\"13\" r=\"2\" fill=\"#365314\"/><rect x=\"100\" y=\"4\" width=\"22\" height=\"24\" rx=\"8\"/><circle cx=\"111\" cy=\"12\" r=\"2\" fill=\"#365314\"/></g></svg>";
  const farmerSvgLiteral = JSON.stringify(farmerSvg).replace(/"/g, "\\\"");
    objective: spec.objective,
    winCondition: spec.winCondition,
    palette: spec.visual.palette,
  }).replace(/</g, "\\u003c");

  const script = [
    '"use strict";',
    "const CFG=" + config + ";",
    "let farm={money:50,wheat:0,tool:'till',harvested:0,day:1,plots:Array.from({length:12},()=>({state:'empty'}))};",
    "window.__RK_GAME_READY__=false;window.__RK_GAME_RENDERED__=false;window.__RK_GAME_LOOP_STARTED__=false;",
    "function resetFarm(){farm={money:50,wheat:0,tool:'till',harvested:0,day:1,plots:Array.from({length:12},()=>({state:'empty'}))};}",
    "class FarmScene extends Phaser.Scene{constructor(){super({key:'FarmScene'});}preload(){this.load.spritesheet('farmer','data:image/svg+xml;charset=utf-8,'+encodeURIComponent(\"<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"128\\" height=\\"32\\"><g stroke=\\"#fff\\" stroke-width=\\"2\\" fill=\\"#f6bd60\\"><rect x=\\"4\\" y=\\"6\\" width=\\"22\\" height=\\"22\\" rx=\\"8\\"/><circle cx=\\"15\\" cy=\\"13\\" r=\\"2\\" fill=\\"#365314\\"/><rect x=\\"36\\" y=\\"4\\" width=\\"22\\" height=\\"24\\" rx=\\"8\\"/><circle cx=\\"47\\" cy=\\"12\\" r=\\"2\\" fill=\\"#365314\\"/><rect x=\\"68\\" y=\\"7\\" width=\\"22\\" height=\\"21\\" rx=\\"8\\"/><circle cx=\\"79\\" cy=\\"13\\" r=\\"2\\" fill=\\"#365314\\"/><rect x=\\"100\\" y=\\"4\\" width=\\"22\\" height=\\"24\\" rx=\\"8\\"/><circle cx=\\"111\\" cy=\\"12\\" r=\\"2\\" fill=\\"#365314\\"/></g></svg>\"),{frameWidth:32,frameHeight:32});}create(){",
    "class FarmScene extends Phaser.Scene{constructor(){super({key:'FarmScene'});}preload(){this.load.spritesheet('farmer','data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="32"><g stroke="#fff" stroke-width="2" fill="#f6bd60"><rect x="4" y="6" width="22" height="22" rx="8"/><circle cx="15" cy="13" r="2" fill="#365314"/><rect x="36" y="4" width="22" height="24" rx="8"/><circle cx="47" cy="12" r="2" fill="#365314"/><rect x="68" y="7" width="22" height="21" rx="8"/><circle cx="79" cy="13" r="2" fill="#365314"/><rect x="100" y="4" width="22" height="24" rx="8"/><circle cx="111" cy="12" r="2" fill="#365314"/></g></svg>'),{frameWidth:32,frameHeight:32});}create(){",
    "this.anims.create({key:'farmer-idle',frames:this.anims.generateFrameNumbers('farmer',{start:0,end:3}),frameRate:5,repeat:-1});",
    "this.cameras.main.setBackgroundColor(0x9bcf7b);",
    "this.add.rectangle(480,320,960,640,0x9bcf7b);",
    "this.add.rectangle(120,150,190,105,0xd6b06e).setStrokeStyle(4,0x8b5a2b);this.add.rectangle(820,180,170,135,0xe8d9b5).setStrokeStyle(5,0x7a5534);",
    "this.add.text(32,24,CFG.title,{fontSize:'24px',fontFamily:'Arial',color:'#fff8e7',fontStyle:'bold'});this.add.text(32,58,CFG.objective,{fontSize:'12px',fontFamily:'Arial',color:'#365314',wordWrap:{width:700}});",
    "const hud=this.add.text(32,92,'Money: $50 · Wheat: 0 · Harvested: 0',{fontSize:'14px',fontFamily:'Arial',color:'#fff8e7',backgroundColor:'#365314',padding:{x:8,y:5}});",
    "const info=this.add.text(32,555,'Choose Till → Plant → Water → Harvest. Sell wheat at the market.',{fontSize:'13px',fontFamily:'Arial',color:'#365314'});",
    "const player=this.add.sprite(120,470,'farmer').setScale(2.2);player.play('farmer-idle');window.__RK_FARM_PLAYER__=player;",
    "['till','plant','water','harvest','sell'].forEach((tool,i)=>{const b=this.add.rectangle(120+i*180,620,150,42,0x365314).setInteractive({useHandCursor:true});this.add.text(80+i*180,612,tool.toUpperCase(),{fontSize:'13px',fontFamily:'Arial',color:'#fff8e7',fontStyle:'bold'});b.on('pointerdown',()=>{farm.tool=tool;info.setText('Selected '+tool+'. Click a plot.');});});",
    "farm.plots.forEach((plot,i)=>{const x=330+(i%4)*115,y=245+Math.floor(i/4)*95;plot.sprite=this.add.rectangle(x,y,92,68,0x8b5a2b).setStrokeStyle(3,0x6b4423).setInteractive({useHandCursor:true});plot.sprite.setData('index',i);plot.sprite.on('pointerdown',()=>{const a=farm.tool;if(a==='till'&&plot.state==='empty'){plot.state='tilled';plot.sprite.setFillStyle(0x6b4423);}else if(a==='plant'&&plot.state==='tilled'){plot.state='seed';plot.sprite.setFillStyle(0x8fbc5a);}else if(a==='water'&&(plot.state==='seed'||plot.state==='growing')){plot.state='ready';plot.sprite.setFillStyle(0xf6bd60);}else if(a==='harvest'&&plot.state==='ready'){plot.state='empty';farm.wheat++;farm.harvested++;plot.sprite.setFillStyle(0x8b5a2b);}else if(a==='sell'&&farm.wheat>0){farm.money+=farm.wheat*15;farm.wheat=0;}hud.setText('Money: $'+farm.money+' · Wheat: '+farm.wheat+' · Harvested: '+farm.harvested);info.setText(a.toUpperCase()+' · '+plot.state);});});",
    "window.__RK_GAME_READY__=true;window.__RK_GAME_RENDERED__=true;}update(){window.__RK_GAME_LOOP_STARTED__=true;}}",
    "new Phaser.Game({type:Phaser.AUTO,width:960,height:640,parent:'game',backgroundColor:'#9bcf7b',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:960,height:640},scene:[FarmScene]});",
  ].join("\n");

  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>' +
    spec.title.replace(/</g, "&lt;") +
    '</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:' +
    spec.visual.palette.background +
    '}#game{width:100%;height:100%;display:flex;align-items:center;justify-content:center}canvas{max-width:100%;max-height:100%;touch-action:none}</style></head><body><div id="game"></div><script src="' +
    PHASER_CDN +
    '"></script><script>' +
    script +
    '</script></body></html>';
}
