import { NextResponse } from "next/server";
import { enqueueJamesStrategyRevalidation } from "@/app/api/tools/jamesStrategyRevalidationScheduler";

export const runtime="nodejs";

function authorized(req:Request){
  const secret=process.env.JAMES_LEARNING_SECRET||process.env.CRON_SECRET;
  if(!secret)return true;
  return req.headers.get("authorization")===`Bearer ${secret}`;
}

export async function POST(req:Request){
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});

  const queued=await enqueueJamesStrategyRevalidation({limit:10,staleDays:30});
  return NextResponse.json({
    ok:true,
    queued,
    workerEndpoint:"/api/ai/james-strategy-revalidation-runner",
    note:"Scheduling is autonomous; execution remains bounded by the protected worker runner."
  });
}