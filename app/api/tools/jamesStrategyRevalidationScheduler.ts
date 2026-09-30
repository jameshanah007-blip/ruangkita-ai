import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export async function enqueueJamesStrategyRevalidation(options?:{limit?:number;staleDays?:number}){
  const supabase=db(); if(!supabase)return 0;
  const {data,error}=await supabase.rpc("enqueue_james_meta_strategy_revalidation",{
    p_limit:options?.limit??10,
    p_stale_days:options?.staleDays??30,
  });
  if(error){
    console.warn("James strategy revalidation scheduler unavailable:",error.message);
    return 0;
  }
  return Number(data??0);
}

export async function claimJamesStrategyRevalidation(limit=5){
  const supabase=db(); if(!supabase)return [];
  const {data,error}=await supabase
    .from("james_meta_strategy_revalidation_queue")
    .select("id,strategy_id,reason,priority")
    .eq("status","pending")
    .order("priority",{ascending:false})
    .order("scheduled_at",{ascending:true})
    .limit(Math.max(1,Math.min(20,limit)));
  if(error)return [];
  return data??[];
}