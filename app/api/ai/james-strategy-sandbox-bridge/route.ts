import { NextResponse } from "next/server";
import { createJamesStrategySandboxExperiment } from "@/app/api/tools/jamesStrategySandboxBridge";
import { claimJamesStrategyRevalidationJob } from "@/app/api/tools/jamesStrategyRevalidationWorker";

export const runtime="nodejs";

function authorized(req:Request){
  const secret=process.env.JAMES_LEARNING_SECRET||process.env.CRON_SECRET;
  return !secret || req.headers.get("authorization")===`Bearer ${secret}`;
}

export async function POST(req:Request){
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});
  const workerId=req.headers.get("x-james-worker-id")||"strategy-sandbox-bridge";
  const job=await claimJamesStrategyRevalidationJob(workerId);
  if(!job)return NextResponse.json({claimed:false});

  // The actual browser verifier remains the source of gameplay evidence.
  // This endpoint only creates the durable experiment consumed by that pipeline.
  const body=await req.json().catch(()=>({}));
  const experiment=await createJamesStrategySandboxExperiment({
    strategyId:job.strategy_id,
    jobId:job.id,
    taskClass:typeof body.taskClass==="string"?body.taskClass:undefined,
    strategy:typeof body.strategy==="string"?body.strategy:"Revalidate the strategy using the existing Fun Zone sandbox.",
  });

  if(!experiment)return NextResponse.json({claimed:true,job,created:false},{status:503});
  return NextResponse.json({claimed:true,job,experiment});
}