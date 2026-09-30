import { NextResponse } from "next/server";
import { claimJamesStrategyRevalidationJob, completeJamesStrategyRevalidationJob } from "@/app/api/tools/jamesStrategyRevalidationWorker";

export const runtime="nodejs";

export async function POST(req:Request){
  const secret=process.env.JAMES_LEARNING_SECRET||process.env.CRON_SECRET;
  const auth=req.headers.get("authorization");
  if(secret && auth!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});

  const workerId=req.headers.get("x-james-worker-id")||"strategy-revalidation-worker";
  const job=await claimJamesStrategyRevalidationJob(workerId);
  if(!job) return NextResponse.json({claimed:false});

  // The worker claims exactly one durable job. Execution is deliberately separated
  // from the database claim so a future sandbox/provider runner can perform the
  // actual revalidation and then submit its evidence through the completion RPC.
  return NextResponse.json({
    claimed:true,
    job,
    nextAction:"run_revalidation_and_submit_outcome",
  });
}