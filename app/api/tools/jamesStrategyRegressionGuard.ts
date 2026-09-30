import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export async function evaluateJamesStrategyRegression(strategyId:string, options?:{
  window?:number;
  minSamples?:number;
  failureThreshold?:number;
}){
  const supabase=db(); if(!supabase)return null;
  const {data,error}=await supabase.rpc("evaluate_james_meta_strategy_regression",{
    p_strategy_id:strategyId,
    p_window:options?.window??8,
    p_min_samples:options?.minSamples??4,
    p_failure_threshold:options?.failureThreshold??0.35,
  });
  if(error){
    console.warn("James strategy regression guard unavailable:",error.message);
    return null;
  }
  return data;
}