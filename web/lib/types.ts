export type EvidenceStatus = 'documented' | 'unreviewed' | 'disputed';
export type Role = 'analyst' | 'planner';
export type Substance = 'Cannabis' | 'Stimulants' | 'Opioids' | 'Other';
export interface Place { id: string; name: string; state: string; lat: number; lon: number }
export interface Corridor { id: string; origin: string; destination: string; transit: string[]; mode: 'Road' | 'Rail' | 'Maritime' | 'Unknown' }
export interface CaseRecord {
  id: string; corridorId: string | null; seizurePlace: string;
  eventDate: string; availableDate: string; sourceDate: string;
  substance: Substance; quantity: number | null; unit: 'kg' | 'g' | 'unknown';
  status: EvidenceStatus; precision: 'district'; source: string;
  excerpt: string; reviewer: string | null; reviewedAt: string | null;
  confidence: 'supported' | 'limited' | 'unknown'; confidenceBasis: string;
  synthetic: true;
}
export interface Tip {
  id: string; district: string; narrative: string; contact?: string | null;
  createdAt: string; status: 'unreviewed' | 'triaged' | 'dismissed' | 'corroborated';
  duplicateGroup: string | null; synthetic: boolean;
}
export interface Review { id: string; entityId: string; entityType: 'case' | 'tip'; status: string; note: string; evidenceId: string | null; actor: string; createdAt: string }
export interface ForecastRow { corridorId: string; estimate: number; baseline: number; recent: number; previous: number; support: number }
export interface Fold { cutoff: string; end: string; modelMae: number; baselineMae: number; captured: number; total: number; misses: number }
