import { NextResponse } from "next/server";
import { enqueueJamesStrategyRevalidation } from "@/app/api/tools/jamesStrategyRevalidationScheduler";

export const runtime="nodejs";

export async function POST(req:Request){
  const secret=process.env.JAMES_LEARNING_SECRET||process.env.CRON_SECRET;
  const auth=req.headers.get("authorization");
  if(secret && auth!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
  const count=await enqueueJamesStrategyRevalidation();
  return NextResponse.json({queued:count});
}