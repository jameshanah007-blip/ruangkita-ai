import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export async function createJamesStrategySandboxExperiment(input:{
  strategyId:string;
  jobId:string;
  taskClass?:string;
  strategy:string;
}){
  const supabase=db(); if(!supabase)return null;
  const prompt=[
    "Autonomous strategy revalidation.",
    `Strategy ID: ${input.strategyId}`,
    `Task class: ${input.taskClass??"strategy-revalidation"}`,
    `Validated strategy under test: ${input.strategy}`,
    "Run this strategy in an isolated Fun Zone experiment and return structured evidence.",
  ].join("\n");
  const {data,error}=await supabase.from("james_game_experiments").insert({
    user_id:"system:james-strategy",
    capability_key:"meta-strategy-revalidation",
    capability_name:"Meta Strategy Revalidation",
    prompt,
    status:"pending_verification",
    attempt:0,
    source:"autonomous-strategy-revalidation",
    learning_result:{
      strategyId:input.strategyId,
      revalidationJobId:input.jobId,
      taskClass:input.taskClass??null,
    },
  }).select("id,status").single();
  if(error){
    console.warn("James strategy sandbox bridge unavailable:",error.message);
    return null;
  }
  return data;
}

export function extractJamesSandboxOutcome(report:unknown){
  const r=report as Record<string,unknown>|null;
  if(!r)return {outcome:"unknown" as const,quality:0.5,evidence:{}};
  const passed=r.passed===true;
  const hardFailures=Array.isArray(r.hardFailures)?r.hardFailures:[];
  const softWarnings=Array.isArray(r.softWarnings)?r.softWarnings:[];
  const quality=Math.max(0,Math.min(1,
    passed ? 0.85 : Math.max(0.1,0.5-(hardFailures.length*0.12)-(softWarnings.length*0.03))
  ));
  return {
    outcome:passed?"success":"failure" as const,
    quality,
    evidence:{passed,hardFailures:hardFailures.slice(0,10),softWarnings:softWarnings.slice(0,10)},
  };
}