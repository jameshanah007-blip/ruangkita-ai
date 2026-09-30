import { createClient } from "@supabase/supabase-js";
import { retrieveJamesValidatedStrategies, type JamesValidatedStrategy } from "./jamesValidatedStrategyRetrieval";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export type JamesStrategyExecution = {
  strategy: JamesValidatedStrategy;
  task: string;
  instruction: string;
};

export async function prepareJamesStrategyExecution(taskClass:string, task:string, limit=3):Promise<JamesStrategyExecution[]>{
  const strategies=await retrieveJamesValidatedStrategies(taskClass,limit);
  return strategies.map(strategy=>({
    strategy,
    task,
    instruction:[
      "Use this validated strategy as decision guidance, not as an absolute command.",
      "Preserve the strategy's task context and evidence constraints.",
      "If the strategy conflicts with stronger current evidence, do not force it.",
      "Return the execution outcome so it can be evaluated by the learning loop.",
      "",
      `Task class: ${taskClass}`,
      `Task: ${task}`,
      `Validated strategy: ${strategy.strategy}`,
    ].join("\n"),
  }));
}

export async function recordJamesStrategyExecution(input:{
  strategyId:string;
  task:string;
  outcome:"success"|"failure"|"partial"|"unknown";
  quality?:number;
  evidence?:unknown;
}){
  const supabase=db(); if(!supabase)return null;
  const {data,error}=await supabase.from("james_meta_strategy_trials").insert({
    strategy_id:input.strategyId,
    scenario_key:input.task.slice(0,180),
    outcome:input.outcome,
    quality:Math.max(0,Math.min(1,input.quality??0.5)),
    evidence:input.evidence??{},
  }).select("id").single();
  if(error){
    console.warn("James strategy execution evidence unavailable:",error.message);
    return null;
  }
  return data?.id??null;
}