import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export async function promoteOrRetireJamesMetaStrategy(strategyId:string, options?:{
  minSamples?:number;
  promoteScore?:number;
  retireScore?:number;
}){
  const supabase=db(); if(!supabase)return null;
  const {data,error}=await supabase.rpc("promote_retire_james_meta_strategy",{
    p_strategy_id:strategyId,
    p_min_samples:options?.minSamples??4,
    p_promote_score:options?.promoteScore??0.75,
    p_retire_score:options?.retireScore??0.35,
  });
  if(error){
    console.warn("James meta-strategy lifecycle unavailable:",error.message);
    return null;
  }
  return data;
}