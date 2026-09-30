import { createClient } from "@supabase/supabase-js";
function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});}
export async function applyJamesKnowledgeRevalidation(input:{knowledgeId:string;knowledgeSource:"consolidation"|"experience";outcome:"success"|"failure"|"partial";quality?:number;evidence?:unknown;}){
 const supabase=db(); if(!supabase)return null;
 const {data,error}=await supabase.rpc("apply_james_knowledge_revalidation",{p_knowledge_id:input.knowledgeId,p_knowledge_source:input.knowledgeSource,p_outcome:input.outcome,p_quality:input.quality??0.5,p_evidence:input.evidence??{}});
 if(error){console.warn("James knowledge revalidation outcome unavailable:",error.message);return null;} return data;
}