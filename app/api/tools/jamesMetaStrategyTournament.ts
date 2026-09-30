import { createClient } from "@supabase/supabase-js";

function db() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export async function recordJamesMetaStrategyTrial(input:{
  strategyId:string;
  scenarioKey:string;
  outcome:"success"|"failure"|"partial"|"unknown";
  quality?:number;
  evidence?:unknown;
}) {
  const supabase=db(); if(!supabase)return null;
  const {data,error}=await supabase.from("james_meta_strategy_trials").insert({
    strategy_id:input.strategyId,
    scenario_key:input.scenarioKey,
    outcome:input.outcome,
    quality:Math.max(0,Math.min(1,input.quality??0.5)),
    evidence:input.evidence??{},
  }).select("id").single();
  if(error){console.warn("James meta-strategy trial unavailable:",error.message);return null;}
  return data?.id??null;
}

export async function evaluateJamesMetaStrategyTournament(tournamentId:string){
  const supabase=db(); if(!supabase)return null;
  const {data,error}=await supabase.rpc("evaluate_james_meta_strategy_tournament",{p_tournament_id:tournamentId});
  if(error){console.warn("James meta-strategy tournament unavailable:",error.message);return null;}
  return data;
}
