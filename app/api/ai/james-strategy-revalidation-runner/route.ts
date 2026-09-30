import { NextResponse } from "next/server";
import { claimJamesStrategyRevalidationJob, completeJamesStrategyRevalidationJob } from "@/app/api/tools/jamesStrategyRevalidationWorker";
import { evaluateJamesStrategyRegression } from "@/app/api/tools/jamesStrategyRegressionGuard";

export const runtime="nodejs";

function authorized(req:Request){
  const secret=process.env.JAMES_LEARNING_SECRET||process.env.CRON_SECRET;
  if(!secret)return true;
  return req.headers.get("authorization")===`Bearer ${secret}`;
}

export async function POST(req:Request){
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});

  const workerId=req.headers.get("x-james-worker-id")||"strategy-revalidation-runner";
  const job=await claimJamesStrategyRevalidationJob(workerId);
  if(!job)return NextResponse.json({claimed:false});

  // This runner deliberately performs a deterministic health/revalidation pass
  // over the strategy's accumulated evidence. It does not invent success.
  const regression=await evaluateJamesStrategyRegression(job.strategy_id,{window:8,minSamples:2});
  const action=String(regression?.action||"observe");
  const outcome=action==="continue"?"success":action==="quarantine"?"failure":"unknown";
  const quality=action==="continue"?0.8:action==="quarantine"?0.2:0.5;

  const completion=await completeJamesStrategyRevalidationJob({
    jobId:job.id,
    outcome,
    quality,
    evidence:{
      runner:"strategy-revalidation-runner",
      reason:job.reason,
      regressionGuard:regression,
      deterministic:true,
    },
  });

  return NextResponse.json({claimed:true,job,outcome,quality,regression,completion});
}