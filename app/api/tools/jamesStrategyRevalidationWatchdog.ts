import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export async function recoverStaleJamesStrategyRevalidationJobs(options?:{
  staleMinutes?:number;
  limit?:number;
}){
  const supabase=db(); if(!supabase)return 0;
  const {data,error}=await supabase.rpc("recover_stale_james_strategy_revalidation_jobs",{
    p_stale_minutes:options?.staleMinutes??20,
    p_limit:options?.limit??20,
  });
  if(error){
    console.warn("James strategy revalidation watchdog unavailable:",error.message);
    return 0;
  }
  return Number(data??0);
}