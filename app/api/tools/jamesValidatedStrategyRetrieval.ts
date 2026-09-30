import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export type JamesValidatedStrategy = {
  strategy_id:string;
  strategy:string;
  confidence:number;
  evidence_count:number;
  success_count:number;
  failure_count:number;
  relevance_score:number;
};

export async function retrieveJamesValidatedStrategies(taskClass?:string,limit=5){
  const supabase=db(); if(!supabase)return [];
  const {data,error}=await supabase.rpc("retrieve_james_validated_meta_strategies",{
    p_task_class:taskClass??null,
    p_limit:limit,
  });
  if(error){
    console.warn("James validated strategy retrieval unavailable:",error.message);
    return [];
  }
  return (data??[]) as JamesValidatedStrategy[];
}