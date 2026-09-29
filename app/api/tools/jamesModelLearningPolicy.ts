import type { AIProviderName } from "../../fun-zone/aiProvider";
import { getJamesModelLearningCapabilities } from "./jamesModelLearning";
export type JamesModelLearningDecision={shouldDistill:boolean;shouldAdapt:boolean;teacherProviders:AIProviderName[];targetProvider:"openai"|"groq"|null;baseModel:string|null;confidence:number;evidenceCount:number;reason:string};
const PROVIDERS:AIProviderName[]=["openai","gemini","openrouter","groq"];
export async function decideJamesModelLearning(input:{userId:string;confidence:number;evidenceCount:number;verified:boolean;autonomous:boolean}):Promise<JamesModelLearningDecision>{
 const caps=getJamesModelLearningCapabilities(); const teachers=PROVIDERS.filter(p=>Boolean(caps[p]?.distillation));
 const ready=input.autonomous&&input.verified&&input.evidenceCount>=8;
 return {shouldDistill:ready,shouldAdapt:false,teacherProviders:teachers,targetProvider:null,baseModel:null,confidence:input.confidence,evidenceCount:input.evidenceCount,reason:ready?"Evidence cukup untuk distillation terkontrol.":"Evidence belum cukup atau siklus belum tervalidasi."};
}
