import { Sandbox } from "@vercel/sandbox";
import type { GameBlueprint, TestReport, SandboxTestEvidence } from "./types";
import { testGame } from "./tester";

const BROWSER_WAIT_MS = 2500;

function credentials() {
  if (process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID) {
    return { token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_TEAM_ID, projectId: process.env.VERCEL_PROJECT_ID };
  }
  return {};
}

async function command(sandbox: InstanceType<typeof Sandbox>, cmd: string, args: string[]) {
  const result = await sandbox.runCommand({ cmd, args });
  return result.stdout();
}

function buildVerifierHtml(gameHtml: string, actions: string[]) {
  const prelude = \`<script>
(() => {
  window.__RK_AUTONOMOUS = {startedAt:Date.now(),errors:[],inputEvents:0,inputListeners:0,frames:0};
  const s=window.__RK_AUTONOMOUS;
  window.addEventListener("error",e=>s.errors.push({message:String(e.message||"runtime error"),source:e.filename||undefined,line:e.lineno||null,column:e.colno||null}));
  window.addEventListener("unhandledrejection",e=>s.errors.push({message:String(e.reason?.message||e.reason||"unhandled rejection")}));
  const add=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(t,l,o){if(["keydown","keyup","pointerdown","pointerup","mousedown","mouseup","touchstart","touchend","click"].includes(String(t).toLowerCase()))s.inputListeners++;return add.call(this,t,l,o)};
  const raf=window.requestAnimationFrame;
  window.requestAnimationFrame=function(cb){return raf.call(window,t=>{s.frames++;cb(t)})};
  window.__RK_AUTONOMOUS_ACTIONS__=__ACTION_PLACEHOLDER__;
})();
</script>\`.replace("__ACTION_PLACEHOLDER__", JSON.stringify(actions));

  const epilogue = \`<script>
(() => {
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const stable=v=>{try{return JSON.stringify(v)}catch(_){return String(v)}};
  const diff=(a,b)=>stable(a)!==stable(b);
  const snap=()=>{
    const p=window.__RK_GAME_TEST__;
    if(!p||typeof p!=="object")return{protocol:null,state:{},error:"Game Test Protocol __RK_GAME_TEST__ tidak tersedia."};
    try{return{protocol:p,state:typeof p.getState==="function"?p.getState():undefined,player:typeof p.getPlayerState==="function"?p.getPlayerState():undefined,objective:typeof p.getObjectiveState==="function"?p.getObjectiveState():undefined,won:typeof p.getWinState==="function"&&p.getWinState()===true,lost:typeof p.getLoseState==="function"&&p.getLoseState()===true}}catch(e){return{protocol:null,state:{},error:String(e?.message||e)}}
  };
  const canvas=()=>{
    const c=document.querySelector("canvas");
    if(!c)return{valid:false,width:0,height:0,nonBlankPixels:0};
    try{const x=c.getContext("2d"),w=c.width,h=c.height;if(!x||!w||!h)return{valid:false,width:w,height:h,nonBlankPixels:0};const sw=Math.min(w,160),sh=Math.min(h,120),d=x.getImageData(0,0,sw,sh).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>8)n++;return{valid:true,width:w,height:h,nonBlankPixels:n}}catch(_){return{valid:false,width:c.width||0,height:c.height||0,nonBlankPixels:0}}
  };
  window.__RK_AUTONOMOUS_FINISH__=async()=>{
    await sleep(700);
    const before=snap(),beforeCanvas=canvas(),p=before.protocol;
    let actionExecuted=false;
    if(p&&typeof p.performTestAction==="function"){
      for(const a of (window.__RK_AUTONOMOUS_ACTIONS__.length?window.__RK_AUTONOMOUS_ACTIONS__:["move","interact","jump","attack","collect","dodge","shoot","open_door","use_item","talk","solve"])){
        try{await Promise.resolve(p.performTestAction(a));actionExecuted=true;break}catch(_){}
      }
    }else{
      const b=document.querySelector("button");if(b){b.click();actionExecuted=true}
      const c=document.querySelector("canvas");if(c){try{c.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))}catch(_){}}
    }
    await sleep(1000);
    const after=snap(),afterCanvas=canvas();
    let restartVerified=false;
    if(p&&typeof p.restart==="function"){try{await Promise.resolve(p.restart());await sleep(350);restartVerified=!!snap().protocol}catch(_){}}
    else{try{location.reload();await sleep(700);restartVerified=true}catch(_){}}
    const s=window.__RK_AUTONOMOUS,elapsed=Date.now()-s.startedAt;
    return JSON.stringify({
      runtimeErrors:s.errors.slice(0,10),runtimeOk:s.errors.length===0,
      rendered:afterCanvas.nonBlankPixels>=10,loopStarted:s.frames>=5,frameAdvanced:s.frames>=5,
      canvasValid:afterCanvas.valid&&afterCanvas.width>=100&&afterCanvas.height>=100,
      inputTest:actionExecuted||s.inputEvents>0,gameplayTest:actionExecuted,performanceTest:elapsed<=15000,
      frameCount:s.frames,gameAnimationFrames:s.frames,inputEvents:s.inputEvents,inputListeners:s.inputListeners,
      canvasWidth:afterCanvas.width,canvasHeight:afterCanvas.height,nonBlankPixels:afterCanvas.nonBlankPixels,
      renderChanged:beforeCanvas.nonBlankPixels!==afterCanvas.nonBlankPixels,elapsedMs:elapsed,
      gameTestProtocol:!!p,stateChanged:diff(before.state,after.state),objectiveChanged:diff(before.objective,after.objective),
      playerChanged:diff(before.player,after.player),winStateDetected:after.won===true,loseStateDetected:after.lost===true,
      restartVerified,gameTestError:before.error
    })
  };
})();
</script>\`;

  return prelude + gameHtml + epilogue;
}

async function createSandbox() {
  const snapshotId = process.env.AGENT_BROWSER_SNAPSHOT_ID;
  return snapshotId
    ? Sandbox.create({...credentials(),source:{type:"snapshot",snapshotId},timeout:120_000})
    : Sandbox.create({...credentials(),runtime:"node24",timeout:120_000});
}

export async function verifyGameInBrowser(gameHtml:string, blueprint:GameBlueprint, attempt:number):Promise<TestReport>{
  const sandbox=await createSandbox();
  try{
    if(!process.env.AGENT_BROWSER_SNAPSHOT_ID){
      await command(sandbox,"npm",["install","-g","agent-browser"]);
      await command(sandbox,"npx",["agent-browser","install"]);
    }
    const html=buildVerifierHtml(gameHtml,blueprint.playerActions??[]);
    const encoded=Buffer.from(html,"utf8").toString("base64");
    await command(sandbox,"sh",["-lc",\`echo \${encoded} | base64 -d > /tmp/james-game.html\`]);
    await command(sandbox,"agent-browser",["open","file:///tmp/james-game.html"]);
    await command(sandbox,"agent-browser",["wait",String(BROWSER_WAIT_MS)]);
    const raw=await command(sandbox,"agent-browser",["eval","window.__RK_AUTONOMOUS_FINISH__()"]);
    const evidence=JSON.parse(raw.trim()) as SandboxTestEvidence;
    return testGame({blueprint,attempt,evidence});
  }finally{
    try{await command(sandbox,"agent-browser",["close"])}catch(_){}
    await sandbox.stop();
  }
}
