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
