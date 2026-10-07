import type { GameSpecification2D, GenreRuntimePlan } from "../types";
import { build2DRuntimeHtml } from "../sharedRuntime";

export function buildFarmingRuntime(spec:GameSpecification2D):string{
  const s=[
"var state={x:150,y:430,money:30,tilled:0,planted:0,watered:0,harvested:0,sold:0};",
"function restartGame(){state={x:150,y:430,money:30,tilled:0,planted:0,watered:0,harvested:0,sold:0};won=false;lost=false;hideMessage()}",
"function onStart(){}",
"function getGenreStats(){return'FARM · SOIL '+state.tilled+' · CROP '+state.planted+' · WATER '+state.watered+' · HARVEST '+state.harvested+' · $'+state.money}",
"function getObjectiveState(){return{progress:state.sold?1:state.harvested/3,status:state.won?'won':'playing'}}",
"function getGenreState(){return{tilled:state.tilled,planted:state.planted,watered:state.watered,harvested:state.harvested,sold:state.sold}}",
"function testDirection(d){var bx=state.x,by=state.y;input[d]=true;commonMove(135,.12);input[d]=false;return d==='left'?state.x<bx:d==='right'?state.x>bx:d==='up'?state.y<by:state.y>by}",
"function performGameAction(a){started=true;if(a==='move'){testDirection('right');return true}if(a==='till'){state.tilled=Math.min(3,state.tilled+1);return true}if(a==='plant'){if(state.tilled>state.planted){state.planted++;return true}return false}if(a==='water'){if(state.planted>state.watered){state.watered++;return true}return false}if(a==='harvest'){if(state.watered>state.harvested){state.harvested++;state.money+=8;return true}return false}if(a==='sell'){if(state.harvested>=3){state.sold=1;state.money+=30;finish(true,'PANEN BERHASIL','Semua hasil panen terjual.');return true}return false}if(a==='action'){if(state.tilled<3)return performGameAction('till');if(state.planted<3)return performGameAction('plant');if(state.watered<3)return performGameAction('water');if(state.harvested<3)return performGameAction('harvest');return performGameAction('sell')}return false}",
"function updateGame(dt){commonMove(135,dt)}",
"function renderGame(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#76a951';ctx.fillRect(0,0,W,H);ctx.fillStyle='#d8ba76';ctx.fillRect(0,70,W,34);for(var i=0;i<6;i++){var px=45+(i%2)*150,py=150+Math.floor(i/2)*85;ctx.fillStyle=i<state.harvested?'#9c6b48':'#6e8f4c';ctx.fillRect(px,py,110,52);for(var c=0;c<3;c++){ctx.fillStyle=i<state.planted?'#e8c76a':'#5da24e';ctx.fillRect(px+14+c*32,py+12,16,28)}}ctx.fillStyle='#b97b4b';ctx.fillRect(W-185,150,135,105);text('FARM MARKET',W-178,140,13);circle(state.x,state.y,17,'#8b5cf6');ctx.fillStyle='#f0d0b1';ctx.fillRect(state.x-8,state.y-24,16,8)}"
].join("\n");
  const plan:GenreRuntimePlan={genre:"farming",runtimeId:"farming-v1",label:"Cozy Farming Valley",palette:{background:"#17351f",panel:"#26452b",ground:"#6f9e50",accent:"#e8c76a",danger:"#a85d3d",light:"#f5f1d0"},tutorial:{title:"Farming 2D",body:"Olah lahan, tanam bibit, siram, panen, lalu jual hasil kebun untuk mengembangkan modal."},testActions:["move","till","plant","water","harvest","sell"],sourceVersion:"genre-runtime-v1",script:s};
  return build2DRuntimeHtml(spec,plan)
}
