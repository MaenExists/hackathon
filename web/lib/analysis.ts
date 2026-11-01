import type { CaseRecord, ForecastRow, Fold } from './types.ts';
const DAY = 86_400_000;
export const DEMO_AS_OF = '2026-11-01';
export function eligible(records: CaseRecord[], cutoff: string): CaseRecord[] {
 const time = Date.parse(cutoff);
 return records.filter(r => r.status === 'documented' && r.corridorId !== null && (!r.reviewedAt || Date.parse(r.reviewedAt) <= time) && Date.parse(r.availableDate) <= time && Date.parse(r.eventDate) < time);
}
// Expected documented case count over 30 days. Not a probability of trafficking.
export function forecast(records: CaseRecord[], corridorIds: string[], cutoff = DEMO_AS_OF): ForecastRow[] {
 const time = Date.parse(cutoff), data = eligible(records, cutoff);
 return corridorIds.map(corridorId => {
  const rows = data.filter(r => r.corridorId === corridorId);
  const count = (from:number,to:number) => rows.filter(r => {const age=(time-Date.parse(r.eventDate))/DAY;return age > from && age <= to;}).length;
  const recent=count(0,30),previous=count(30,60),older=count(60,90);
  return {corridorId,estimate: +(recent*.6+previous*.3+older*.1).toFixed(2),baseline:+((recent+previous+older)/3).toFixed(2),recent,previous,support:rows.length};
 }).sort((a,b)=>b.estimate-a.estimate || a.corridorId.localeCompare(b.corridorId));
}
export function backtest(records:CaseRecord[], ids:string[]): Fold[] {
 return ['2026-05-01','2026-06-01','2026-07-01','2026-08-01','2026-09-01','2026-10-01'].map(cutoff=>{
  const start=Date.parse(cutoff),end=start+30*DAY;
  const rows=forecast(records,ids,cutoff);
  // Labels must have been available by the frozen evaluation date as well.
  const actual=records.filter(r=>r.status==='documented' && r.corridorId && Date.parse(r.eventDate)>=start && Date.parse(r.eventDate)<end && r.availableDate <= DEMO_AS_OF);
  const top=rows.slice(0,3).map(r=>r.corridorId);
  const errors=rows.map(r=>{const n=actual.filter(x=>x.corridorId===r.corridorId).length;return {model:Math.abs(n-r.estimate),baseline:Math.abs(n-r.baseline),n,id:r.corridorId};});
  return {cutoff,end:new Date(end).toISOString().slice(0,10),modelMae: +(errors.reduce((s,x)=>s+x.model,0)/ids.length).toFixed(3),baselineMae:+(errors.reduce((s,x)=>s+x.baseline,0)/ids.length).toFixed(3),captured:actual.filter(r=>top.includes(r.corridorId!)).length,total:actual.length,misses:errors.filter(x=>x.n>0&&!top.includes(x.id)).length};
 });
}
export function tokenSimilarity(a:string,b:string):number {
 const tokens=(s:string)=>new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(w=>w.length>2));
 const x=tokens(a),y=tokens(b); const union=new Set([...x,...y]);
 return union.size ? [...x].filter(w=>y.has(w)).length/union.size : 0;
}
export const limitations = [
 'All movement records are synthetic. These results do not describe actual trafficking in Kerala.',
 'The target is the number of future documented cases in 30 days, not underlying trafficking or individual risk.',
 'Reporting and enforcement effort affect observed counts. Coverage is unknown; differences are not population risk.',
 'District connections are schematic. They establish neither a road taken nor activity at a school or other nearby place.',
 'Six synthetic evaluation windows are a workflow test, not evidence of real-world validity or calibrated uncertainty.',
 'Community leads never enter the forecasting dataset. Independent review does not make repeated allegations independent evidence.',
 'Treatment and outreach planning require separate, current evidence on need, capacity and access. Human review is required.'
];
