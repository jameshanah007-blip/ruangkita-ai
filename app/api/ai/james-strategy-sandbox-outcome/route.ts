import { NextResponse } from "next/server";
import { applyJamesSandboxExperimentToStrategy } from "@/app/api/tools/jamesSandboxStrategyOutcome";

export const runtime="nodejs";

function authorized(req:Request){
  const secret=process.env.CRON_SECRET||process.env.JAMES_AUTONOMY_CRON_SECRET||process.env.JAMES_LEARNING_SECRET;
  return Boolean(secret)&&req.headers.get("authorization")===`Bearer ${secret}`;
}

export async function POST(req:Request){
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>({}));
  if(typeof body.experimentId!=="string"||typeof body.jobId!=="string"||typeof body.strategyId!=="string")
    return NextResponse.json({error:"experimentId, jobId and strategyId are required."},{status:400});
  const result=await applyJamesSandboxExperimentToStrategy(body);
  if(!result)return NextResponse.json({error:"Sandbox result could not be converted into strategy evidence."},{status:404});
  return NextResponse.json({success:true,...result});
}