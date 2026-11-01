import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import seed from '../data/cases.json';
import { seedTips } from '../data/tips';
import type { CaseRecord, Tip, Review, Role } from './types';
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export async function access(analyst=false){
 const user=await getChatGPTUser();if(!user)throw new HttpError(401,'Sign in to open the private demonstration workspace.');
 const role:Role=(await cookies()).get('corridor-demo-role')?.value==='planner'?'planner':'analyst';
 if(analyst&&role!=='analyst')throw new HttpError(403,'Case records and private leads are restricted to the analyst demonstration role.');
 return {...user,role};
}
export function db(){if(!env.DB)throw new HttpError(503,'Database unavailable. Apply the documented local migrations and restart.');return env.DB;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function failure(e:unknown){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('Workspace request failed',e instanceof Error?e.message:'Unknown error');return json({error:'The request could not be completed. Check the database connection and try again.'},500);}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new HttpError(403,'Cross-origin writes are not allowed.');}
export async function body(req:Request){if(Number(req.headers.get('content-length')??0)>500_000)throw new HttpError(413,'Upload must be under 500 KB.');const raw=await req.text();if(raw.length>500_000)throw new HttpError(413,'Upload must be under 500 KB.');try{return JSON.parse(raw);}catch{throw new HttpError(400,'Provide valid JSON.');}}
export async function records(owner:string):Promise<CaseRecord[]>{
 const [uploaded,audit]=await Promise.all([db().prepare('SELECT payload FROM imports WHERE owner_id = ?').bind(owner).all<{payload:string}>(),reviewHistory(owner)]);
 const map=new Map<string,CaseRecord>((seed as CaseRecord[]).map(r=>[r.id,{...r}]));
 for(const x of uploaded.results){const r=JSON.parse(x.payload);map.set(r.id,r);}
 for(const r of audit.filter(r=>r.entityType==='case')){const row=map.get(r.entityId);if(row){row.status=r.status as CaseRecord['status'];row.reviewer=r.actor;row.reviewedAt=r.createdAt;row.confidence=r.status==='documented'?'supported':r.status==='disputed'?'limited':'unknown';row.confidenceBasis=r.note;}}
 return [...map.values()];
}
export async function reviewHistory(owner:string):Promise<Review[]>{const result=await db().prepare('SELECT id, entity_id AS entityId, entity_type AS entityType, status, note, evidence_id AS evidenceId, actor, created_at AS createdAt FROM reviews WHERE owner_id = ? ORDER BY created_at ASC, rowid ASC').bind(owner).all<Review>();return result.results;}
export async function tipList(owner:string):Promise<Tip[]>{
 const [stored,audit]=await Promise.all([db().prepare('SELECT id,district,narrative,contact,created_at AS createdAt,duplicate_group AS duplicateGroup,synthetic FROM tips ORDER BY created_at DESC').all<Omit<Tip,'status'>>(),reviewHistory(owner)]);
 const list:Tip[]=[...stored.results.map(t=>({...t,synthetic:true,status:'unreviewed' as const})),...seedTips.map(t=>({...t}))];
 for(const r of audit.filter(r=>r.entityType==='tip')){const tip=list.find(t=>t.id===r.entityId);if(tip)tip.status=r.status as Tip['status'];}return list;
}
export const frozenRecords=seed as CaseRecord[];
