import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export async function claimJamesStrategyRevalidationJob(workerId:string){
  const supabase=db(); if(!supabase)return null;
  const {data,error}=await supabase.rpc("claim_james_meta_strategy_revalidation_job",{p_worker_id:workerId});
  if(error){console.warn("James strategy worker claim unavailable:",error.message);return null;}
  return data?.[0]??null;
}

export async function completeJamesStrategyRevalidationJob(input:{
  jobId:string;
  outcome:"success"|"failure"|"partial"|"unknown";
  quality?:number;
  evidence?:unknown;
}){
  const supabase=db(); if(!supabase)return null;
  const {data,error}=await supabase.rpc("complete_james_meta_strategy_revalidation_job",{
    p_job_id:input.jobId,
    p_outcome:input.outcome,
    p_quality:Math.max(0,Math.min(1,input.quality??0.5)),
    p_evidence:input.evidence??{},
  });
  if(error){console.warn("James strategy worker completion unavailable:",error.message);return null;}
  return data;
}