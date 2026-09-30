import { NextResponse } from "next/server";
import { recoverStaleJamesStrategyRevalidationJobs } from "@/app/api/tools/jamesStrategyRevalidationWatchdog";

export const runtime="nodejs";

export async function GET(req:Request){
  const secret=process.env.CRON_SECRET||process.env.JAMES_AUTONOMY_CRON_SECRET||process.env.JAMES_LEARNING_SECRET;
  if(!secret || req.headers.get("authorization")!==`Bearer ${secret}`)
    return NextResponse.json({error:"Unauthorized"},{status:401});

  const recovered=await recoverStaleJamesStrategyRevalidationJobs({staleMinutes:20,limit:20});
  return NextResponse.json({
    success:true,
    watchdog:"james-strategy-revalidation-watchdog-v1",
    recovered,
    leaseMinutes:20,
  });
}