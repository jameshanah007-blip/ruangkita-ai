import { createClient } from "@supabase/supabase-js";
import { generateWithJamesResourceManager } from "./jamesResourceManager";

type MetaInput = { pattern: string; strategy: string; capabilities: string[]; verified: boolean; };

export type JamesMetaStrategy = {
  id?: string; taskClass: string; strategy: string; capabilities: string[];
  evidenceCount: number; successCount: number; failureCount: number; confidence: number;
  status: "candidate" | "active" | "retired";
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false} });
}
function clean(value: unknown,max=500){return typeof value==="string"?value.trim().slice(0,max):"";}
function clamp(value: unknown){const n=typeof value==="number"?value:Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9áéíóúàèìòùâêîôûäëïöüñ\s]/gi," ").replace(/\s+/g," ").trim();}
function overlap(a:string,b:string){const l=new Set(normalize(a).split(" ").filter(x=>x.length>2));const r=new Set(normalize(b).split(" ").filter(x=>x.length>2));if(!l.size||!r.size)return 0;let h=0;for(const t of l)if(r.has(t))h++;return h/Math.max(3,Math.min(l.size,r.size));}

export async function learnJamesMetaStrategy(input:MetaInput){
  if(!input.verified)return null;
  const supabase=db();if(!supabase||!input.pattern||!input.strategy)return null;
  try{
    const classification=await generateWithJamesResourceManager("learning",{prompt:[
      "Ubah pengalaman James berikut menjadi pengetahuan strategi tingkat meta.","Task class harus generik.",
      "Strategi harus generik dan tidak boleh berisi identitas, data pribadi, credential, token, API key, password, email, nomor telepon, atau kode verifikasi.",
      "PATTERN:",clean(input.pattern,350),"STRATEGY:",clean(input.strategy,700),"CAPABILITIES:",input.capabilities.slice(0,8).join(", "),
      'Output JSON saja: {"taskClass":"...","strategy":"...","confidence":0.0}'
    ].join("\n"),systemInstruction:"Kamu adalah James Meta-Learning Engine. Ekstrak hanya strategi generik yang dapat dipakai lintas task dan lintas pengguna.",temperature:.1,maxOutputTokens:650});
    const start=classification.text.indexOf("{"),end=classification.text.lastIndexOf("}");
    if(start<0||end<=start)return null;
    const parsed=JSON.parse(classification.text.slice(start,end+1)) as Record<string,unknown>;
    const taskClass=normalize(clean(parsed.taskClass,120)).slice(0,120);
    const strategy=clean(parsed.strategy,700);const confidence=clamp(parsed.confidence);
    if(!taskClass||!strategy||confidence<.75)return null;
    const capabilities=[...new Set(input.capabilities)].slice(0,8);

    const creationKey="creation:"+taskClass+":"+strategy;
    const {data:guard,error:guardError}=await supabase.rpc("guard_james_meta_strategy_creation",{
      p_task_class:taskClass,p_strategy:strategy,p_confidence:confidence,p_source_event_key:creationKey
    });
    if(guardError||guard?.allowed!==true)return null;

    const {data}=await supabase.from("james_meta_strategies").select("id,task_class,strategy,capabilities,evidence_count,success_count,failure_count,confidence,status").eq("task_class",taskClass).eq("status","candidate").limit(12);
    const similar=(data||[]).find(item=>overlap(strategy,String(item.strategy||""))>=.45);

    if(similar?.id){
      const {data:guardResult,error}=await supabase.rpc("guard_james_meta_strategy_mutation",{
        p_strategy_id:similar.id,p_mutation_type:"mutate",p_source_event_key:"mutate:"+similar.id+":"+creationKey
      });
      if(error||guardResult?.allowed!==true)return null;
      const evidence=Number(similar.evidence_count||0)+1;
      const success=Number(similar.success_count||0)+1;
      const empirical=success/Math.max(1,evidence+Number(similar.failure_count||0));
      const nextConfidence=Math.min(.99,Number(similar.confidence||.5)*.4+Math.max(empirical,confidence)*.6);
      const {data:updated,error:updateError}=await supabase.from("james_meta_strategies").update({
        evidence_count:evidence,success_count:success,confidence:nextConfidence,capabilities,updated_at:new Date().toISOString()
      }).eq("id",similar.id).eq("status","candidate").select("id,task_class,strategy,capabilities,evidence_count,success_count,failure_count,confidence,status").maybeSingle();
      if (updateError) throw new Error("Meta-strategy mutation persistence failed: " + updateError.message);
      if (!updated) throw new Error("Meta-strategy mutation was not applied.");
      return updated;
    }

    const {data:inserted,error:insertError}=await supabase.from("james_meta_strategies").insert({
      task_class:taskClass,strategy,capabilities,evidence_count:1,success_count:1,confidence,status:"candidate"
    }).select("id,task_class,strategy,capabilities,evidence_count,success_count,failure_count,confidence,status").maybeSingle();
    if (insertError) throw new Error("Meta-strategy creation persistence failed: " + insertError.message);
    if (inserted?.id) {
      // The creation guard runs before the strategy row exists, so attach the
      // durable creation event to the new strategy after persistence.
      const { error:lineageError } = await supabase
        .from("james_meta_strategy_mutation_events")
        .update({ source_strategy_id: inserted.id })
        .eq("source_event_key", creationKey)
        .is("source_strategy_id", null);
      if (lineageError) {
        throw new Error("Strategy creation lineage could not be linked: " + lineageError.message);
      }
    }
    return inserted||null;
  }catch(error){console.warn("James meta-learning unavailable:",error);return null;}
}


export async function processJamesStrategyRevalidationQueue(limit=3){
  const supabase=db();
  if(!supabase) return {status:"skipped",reason:"Supabase secret configuration is missing.",processed:0,completed:0,blocked:0};

  const {data:jobs,error:claimError}=await supabase.rpc("claim_james_meta_strategy_revalidation",{
    p_limit:Math.min(Math.max(limit,1),10)
  });
  if(claimError) throw new Error("Strategy revalidation claim failed: "+claimError.message);

  let completed=0;
  let blocked=0;
  const results: unknown[]=[];

  for(const job of jobs||[]){
    try{
      if(!job.strategy_id){
        await supabase.rpc("complete_james_meta_strategy_revalidation",{
          p_id:job.id,p_state:"blocked",
          p_result_snapshot:{reason:"creation_revalidation_requires_verified_evidence",sourceEventKey:job.source_event_key}
        });
        blocked++;
        results.push({id:job.id,state:"blocked",reason:"creation_revalidation_requires_verified_evidence"});
        continue;
      }

      const {data:strategy,error:strategyError}=await supabase
        .from("james_meta_strategies")
        .select("id,task_class,strategy,capabilities,status,confidence,evidence_count")
        .eq("id",job.strategy_id)
        .maybeSingle();

      if(strategyError) throw new Error("Strategy lookup failed: "+strategyError.message);
      if(!strategy){
        await supabase.rpc("complete_james_meta_strategy_revalidation",{
          p_id:job.id,p_state:"blocked",p_result_snapshot:{reason:"strategy_not_found"}
        });
        blocked++;
        continue;
      }
      if(strategy.status==="retired"){
        await supabase.rpc("complete_james_meta_strategy_revalidation",{
          p_id:job.id,p_state:"blocked",p_result_snapshot:{reason:"retired_strategy_is_immutable"}
        });
        blocked++;
        continue;
      }

      const {data:evidence,error:evidenceError}=await supabase
        .from("james_meta_strategy_evidence")
        .select("*")
        .eq("strategy_id",job.strategy_id)
        .maybeSingle();

      if(evidenceError) throw new Error("Strategy evidence lookup failed: "+evidenceError.message);

      const trust=clamp((evidence as Record<string,unknown>|null)?.trust_score);
      const conflicts=Number((evidence as Record<string,unknown>|null)?.conflict_count||0);
      const resolved=Number((evidence as Record<string,unknown>|null)?.resolved_conflict_count||0);
      const openConflicts=Math.max(0,conflicts-resolved);
      const samples=Number((evidence as Record<string,unknown>|null)?.evidence_count||0);

      if(!evidence || openConflicts>0 || trust<.60 || samples<2){
        const reason=!evidence?"evidence_not_available":openConflicts>0?"open_evidence_conflict":trust<.60?"insufficient_evidence_trust":"insufficient_revalidation_samples";
        const exhausted=Number(job.attempts||0)>=Number(job.max_attempts||3);
        await supabase.rpc("complete_james_meta_strategy_revalidation",{
          p_id:job.id,p_state:exhausted?"blocked":"pending",
          p_result_snapshot:{reason,trustScore:trust,openConflictCount:openConflicts,evidenceCount:samples,retryable:!exhausted}
        });
        if(exhausted) blocked++;
        results.push({id:job.id,state:exhausted?"blocked":"pending",reason,trustScore:trust,openConflictCount:openConflicts,evidenceCount:samples});
        continue;
      }

      const evidenceSummary=JSON.stringify({
        taskClass:strategy.task_class,
        strategy:strategy.strategy,
        capabilities:Array.isArray(strategy.capabilities)?strategy.capabilities.slice(0,8):[],
        evidenceCount:samples,
        confidence:Number((evidence as Record<string,unknown>).confidence||0),
        outcomeRate:Number((evidence as Record<string,unknown>).outcome_rate||0),
        avgQuality:Number((evidence as Record<string,unknown>).avg_quality||0),
        executionRate:Number((evidence as Record<string,unknown>).execution_rate||0),
        verificationRate:Number((evidence as Record<string,unknown>).verification_rate||0),
        trustScore:trust,
        conflictRate:Number((evidence as Record<string,unknown>).conflict_rate||0)
      });

      const synthesis=await generateWithJamesResourceManager("learning",{
        prompt:[
          "Revalidate one James meta-strategy using only the durable evidence below.",
          "Create a NEW generic candidate strategy only if the evidence supports a useful improvement or clarification.",
          "Never resurrect or modify a retired strategy. Do not include personal data, credentials, tokens, secrets, emails, phone numbers, or verification codes.",
          "The output confidence must reflect the evidence and must be >= 0.75 to create a candidate.",
          "Return JSON only: {\\"taskClass\\":\\"...\\",\\"strategy\\":\\"...\\",\\"capabilities\\":[],\\"confidence\\":0.0,\\"reason\\":\\"...\\"}",
          "DURABLE EVIDENCE:",evidenceSummary
        ].join("\n"),
        systemInstruction:"You are James Strategy Revalidation and Synthesis Engine. Evidence is authoritative; do not invent results.",
        temperature:.1,
        maxOutputTokens:750
      });

      const start=synthesis.text.indexOf("{");
      const end=synthesis.text.lastIndexOf("}");
      if(start<0||end<=start) throw new Error("Revalidation synthesis returned no JSON.");
      const parsed=JSON.parse(synthesis.text.slice(start,end+1)) as Record<string,unknown>;
      const taskClass=normalize(clean(parsed.taskClass,120)).slice(0,120);
      const candidateStrategy=clean(parsed.strategy,700);
      const candidateConfidence=clamp(parsed.confidence);
      const capabilities=Array.isArray(parsed.capabilities)
        ? [...new Set(parsed.capabilities.filter((x):x is string=>typeof x==="string").map(x=>clean(x,80)).filter(Boolean))].slice(0,8)
        : (Array.isArray(strategy.capabilities)?strategy.capabilities.slice(0,8):[]);

      if(!taskClass||!candidateStrategy||candidateConfidence<.75){
        await supabase.rpc("complete_james_meta_strategy_revalidation",{
          p_id:job.id,p_state:"blocked",
          p_result_snapshot:{reason:"synthesis_below_creation_threshold",confidence:candidateConfidence}
        });
        blocked++;
        continue;
      }

      const creationKey="revalidation-create:"+job.id;
      const {data:creationGuard,error:creationGuardError}=await supabase.rpc("guard_james_meta_strategy_creation",{
        p_task_class:taskClass,p_strategy:candidateStrategy,p_confidence:candidateConfidence,p_source_event_key:creationKey
      });
      if(creationGuardError) throw new Error("Revalidation creation guard failed: "+creationGuardError.message);
      if(creationGuard?.allowed!==true){
        await supabase.rpc("complete_james_meta_strategy_revalidation",{
          p_id:job.id,p_state:"blocked",
          p_result_snapshot:{reason:creationGuard?.reason||"creation_guard_blocked",decision:creationGuard?.decision||null}
        });
        blocked++;
        continue;
      }

      const {data:existing,error:existingError}=await supabase
        .from("james_meta_strategies")
        .select("id,task_class,strategy,status")
        .eq("task_class",taskClass)
        .eq("strategy",candidateStrategy)
        .neq("status","retired")
        .limit(1)
        .maybeSingle();
      if(existingError) throw new Error("Candidate duplicate check failed: "+existingError.message);

      let candidate=existing;
      if(!candidate){
        const {data:inserted,error:insertError}=await supabase.rpc("create_james_meta_strategy_candidate",{
          p_task_class:taskClass,
          p_strategy:candidateStrategy,
          p_capabilities:capabilities,
          p_confidence:candidateConfidence
        });
        if(insertError) throw new Error("Revalidation candidate persistence failed: "+insertError.message);
        candidate=inserted;
      }

      if(!candidate?.id) throw new Error("Revalidation candidate was not persisted.");

      const {error:lineageError}=await supabase
        .from("james_meta_strategy_mutation_events")
        .update({source_strategy_id:candidate.id})
        .eq("source_event_key",creationKey)
        .is("source_strategy_id",null);
      if(lineageError) throw new Error("Revalidation creation lineage could not be linked: "+lineageError.message);

      const synthesisReason=clean(parsed.reason,1000);
      const synthesisRecord=await supabase.rpc("record_james_meta_strategy_synthesis",{
        p_revalidation_id:job.id,
        p_source_strategy_id:strategy.id,
        p_candidate_strategy_id:candidate.id,
        p_source_event_key:"synthesis:"+job.id,
        p_task_class:taskClass,
        p_source_strategy:strategy.strategy,
        p_synthesized_strategy:candidateStrategy,
        p_capabilities:capabilities,
        p_source_evidence_snapshot:evidence,
        p_synthesis_reason:synthesisReason,
        p_model_confidence:candidateConfidence,
        p_decision:candidate.id===existing?.id?"duplicate_reused":"candidate_created"
      });
      if(synthesisRecord.error) throw new Error("Strategy synthesis memory persistence failed: "+synthesisRecord.error.message);

      await supabase.rpc("complete_james_meta_strategy_revalidation",{
        p_id:job.id,p_state:"completed",
        p_result_snapshot:{
          reason:"candidate_synthesized",
          candidateStrategyId:candidate.id,
          sourceStrategyId:strategy.id,
          evidenceCount:samples,
          trustScore:trust,
          synthesisMemoryId:synthesisRecord.data?.id||null
        }
      });
      completed++;
      results.push({id:job.id,state:"completed",candidateStrategyId:candidate.id,sourceStrategyId:strategy.id});
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      const {data:retry}=await supabase.rpc("complete_james_meta_strategy_revalidation",{
        p_id:job.id,
        p_state:Number(job.attempts||0)<Number(job.max_attempts||3)?"pending":"blocked",
        p_result_snapshot:{reason:"processor_error",error:message.slice(0,2000)}
      });
      if(Number(job.attempts||0)>=Number(job.max_attempts||3)) blocked++;
      results.push({id:job.id,state:retry?.state||"pending",error:message.slice(0,2000)});
    }
  }

  return {status:"completed",processed:(jobs||[]).length,completed,blocked,results};
}

export async function retrieveJamesMetaStrategies(taskClass:string,limit=4){
  const supabase=db();if(!supabase||!taskClass)return [];
  const {data,error}=await supabase.from("james_meta_strategies").select("id,task_class,strategy,capabilities,evidence_count,success_count,failure_count,confidence,status").eq("task_class",normalize(taskClass)).eq("status","active").order("confidence",{ascending:false}).limit(Math.min(Math.max(limit,1),8));
  if(error)return [];return data||[];
}

export async function retrieveJamesMetaStrategiesByCapabilities(capabilities:string[],limit=4){
  const supabase=db();if(!supabase||!capabilities.length)return [];
  const {data,error}=await supabase.from("james_meta_strategies").select("id,task_class,strategy,capabilities,evidence_count,success_count,failure_count,confidence,status").eq("status","active").order("confidence",{ascending:false}).limit(20);
  if(error||!data?.length)return [];
  const requested=new Set(capabilities);
  return data.map(item=>{const caps=Array.isArray(item.capabilities)?item.capabilities:[];const matches=caps.filter(c=>requested.has(c)).length;const score=matches/Math.max(1,Math.min(requested.size,caps.length||1));return {...item,relevance:score*.7+Number(item.confidence||0)*.3};}).filter(item=>item.relevance>=.35).sort((a,b)=>b.relevance-a.relevance).slice(0,Math.min(Math.max(limit,1),8));
}

export async function evaluateJamesMetaStrategies(input:{request:string;answer:string;capabilities:string[];verified:boolean;outcome?:"success"|"failure"|"partial"}){
  const supabase=db();if(!supabase||!input.answer)return [];
  const {data,error}=await supabase.from("james_meta_strategies").select("id,task_class,strategy,capabilities,evidence_count,success_count,failure_count,confidence,status").eq("status","active").order("confidence",{ascending:false}).limit(20);
  if(error||!data?.length)return [];
  const candidates=data.map(item=>({...item,capabilityMatch:Array.isArray(item.capabilities)?item.capabilities.filter(c=>input.capabilities.includes(c)).length:0})).filter(item=>item.capabilityMatch>0).slice(0,8);
  if(!candidates.length)return [];
  try{
    const evaluation=await generateWithJamesResourceManager("verification",{prompt:["Tentukan meta-strategy mana yang benar-benar relevan dan tampak digunakan dalam task James.","Jika tidak yakin, kembalikan selected_ids kosong.","REQUEST:",clean(input.request,1800),"ANSWER:",clean(input.answer,3500),"CAPABILITIES:",input.capabilities.slice(0,8).join(", "),"CANDIDATE META STRATEGIES:",JSON.stringify(candidates.map(item=>({id:item.id,taskClass:item.task_class,strategy:item.strategy,capabilities:item.capabilities}))), 'Output JSON saja: {"selected_ids":[],"reason":"..."}'].join("\n"),systemInstruction:"Kamu adalah James Meta-Strategy Evaluator. Pilih hanya strategi yang didukung evidence task.",temperature:.1,maxOutputTokens:650});
    const start=evaluation.text.indexOf("{"),end=evaluation.text.lastIndexOf("}");if(start<0||end<=start)return [];
    const parsed=JSON.parse(evaluation.text.slice(start,end+1)) as Record<string,unknown>;
    const ids=Array.isArray(parsed.selected_ids)?parsed.selected_ids.filter((id):id is string=>typeof id==="string"&&candidates.some(item=>item.id===id)).slice(0,4):[];
    if(!ids.length)return [];
    const updated=[];
    for(const id of ids){
      const item=candidates.find(candidate=>candidate.id===id);if(!item)continue;
      const guardResult=await supabase.rpc("guard_james_meta_strategy_mutation",{p_strategy_id:id,p_mutation_type:"mutate",p_source_event_key:"evaluate:"+id+":"+normalize(input.request).slice(0,120)});
      if(guardResult.error||guardResult.data?.allowed!==true)continue;
      const evidence=Number(item.evidence_count||0)+1;const success=Number(item.success_count||0)+(input.verified?1:0);const failure=Number(item.failure_count||0)+(input.verified?0:1);const total=Math.max(1,success+failure);const empirical=success/total;const previous=clamp(item.confidence);const next=Math.max(.05,Math.min(.99,previous*.35+empirical*.65));
      const {data:saved}=await supabase.from("james_meta_strategies").update({evidence_count:evidence,success_count:success,failure_count:failure,confidence:next,updated_at:new Date().toISOString()}).eq("id",id).eq("status","active").select("id,task_class,strategy,evidence_count,success_count,failure_count,confidence,status").maybeSingle();
      if(saved)updated.push(saved);
    }
    return updated;
  }catch(error){console.warn("James meta-strategy evaluation unavailable:",error);return [];}
}
