import type { AIProviderName } from "../../fun-zone/aiProvider";
import { generateWithJamesProviderCollaboration, type JamesResourceTask } from "./jamesResourceManager";
import { createClient } from "@supabase/supabase-js";

export type JamesModelLearningMode = "distillation" | "fine_tuning" | "lora_registration";

function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});}

const PROVIDERS: AIProviderName[]=["openai","gemini","openrouter","groq"];

export function getJamesModelLearningCapabilities(){return Object.fromEntries(PROVIDERS.map(provider=>[provider,{provider,distillation:true,fineTuning:false,directModelCopying:false,notes:"James belajar dari output final provider; bobot proprietary tidak disalin."}]));}

export async function distillJamesKnowledge(input:{userId:string;prompts:string[];teacherProviders:AIProviderName[];systemInstruction?:string;task?:JamesResourceTask}){
 const teachers=[...new Set(input.teacherProviders)].filter(p=>PROVIDERS.includes(p));
 if(!teachers.length) throw new Error("Minimal satu teacher provider diperlukan.");
 const dataset:Array<{prompt:string;response:string;teacherProvider:string;teacherModel:string}>=[];
 for(const prompt of input.prompts.slice(0,20)){
   const results=await generateWithJamesProviderCollaboration(input.task||"learning",{systemInstruction:[input.systemInstruction||"Berikan jawaban final yang akurat.", "Jangan tampilkan chain-of-thought atau reasoning internal."].join("\n"),prompt,temperature:0.15,maxOutputTokens:2500},teachers);
   for(const result of results) if(result.text.trim()) dataset.push({prompt:prompt.slice(0,4000),response:result.text.slice(0,7000),teacherProvider:result.provider,teacherModel:result.model});
 }
 const client=db(); let jobId:string|null=null;
 if(client){const {data}=await client.from("james_model_learning_jobs").insert({user_id:input.userId,mode:"distillation",teacher_providers:teachers,dataset,status:dataset.length?"dataset_ready":"failed",evidence:{sampleCount:dataset.length,source:"provider_final_outputs",reasoningExcluded:true}}).select("id").maybeSingle();jobId=data?.id||null;}
 return {jobId,mode:"distillation" as const,teachers,dataset,sampleCount:dataset.length,trainingJsonl:dataset.map(x=>JSON.stringify({messages:[{role:"user",content:x.prompt},{role:"assistant",content:x.response}]})).join("\n")};
}

export async function syncJamesModelLearningJobs(userId:string){return [] as Array<Record<string,unknown>>;}

export async function startJamesModelAdaptation(){
 throw new Error("James model adaptation dinonaktifkan pada jalur autonomous-safe; James menggunakan distillation dan verifikasi output.");
}
