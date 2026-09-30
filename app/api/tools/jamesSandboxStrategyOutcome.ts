import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}

export async function applyJamesSandboxExperimentToStrategy(input:{
  experimentId:string;
  jobId:string;
  strategyId:string;
}){
  const supabase=db(); if(!supabase)return null;
  const {data:experiment,error}=await supabase
    .from("james_game_experiments")
    .select("id,status,test_report,learning_result,attempt")
    .eq("id",input.experimentId)
    .maybeSingle();
  if(error||!experiment)return null;

  const report=(experiment.test_report??{}) as Record<string,unknown>;
  const hardFailures=Array.isArray(report.hardFailures)?report.hardFailures:[];
  const softWarnings=Array.isArray(report.softWarnings)?report.softWarnings:[];
  const passed=report.passed===true || experiment.status==="completed";
  const outcome=passed?"success":hardFailures.length>0?"failure":"partial";
  const quality=Math.max(0,Math.min(1,
    passed?0.9:Math.max(0.1,0.6-hardFailures.length*0.12-softWarnings.length*0.03)
  ));
  const evidence={
    source:"fun-zone-sandbox",
    experimentId:input.experimentId,
    jobId:input.jobId,
    status:experiment.status,
    attempt:experiment.attempt,
    hardFailures:hardFailures.slice(0,10),
    softWarnings:softWarnings.slice(0,10),
    learningResult:experiment.learning_result??null,
  };

  const {data,error:insertError}=await supabase
    .from("james_meta_strategy_trials")
    .insert({
      strategy_id:input.strategyId,
      scenario_key:"fun-zone-sandbox:"+input.experimentId,
      outcome,
      quality,
      evidence,
    })
    .select("id")
    .single();
  if(insertError)return null;

  const {error:jobError}=await supabase
    .from("james_meta_strategy_revalidation_queue")
    .update({
      status:"completed",
      completed_at:new Date().toISOString(),
      evidence:{...evidence,outcome,quality},
    })
    .eq("id",input.jobId)
    .eq("status","running");

  if(jobError)console.warn("James strategy revalidation job completion unavailable:",jobError.message);
  return {trialId:data?.id??null,outcome,quality,evidence};
}