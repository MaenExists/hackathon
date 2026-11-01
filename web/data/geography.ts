import type { Place, Corridor } from '../lib/types';
// Representative district locations, not seizure coordinates or verified street journeys.
export const places: Place[] = [
 {id:'kasaragod',name:'Kasaragod',state:'Kerala',lat:12.50,lon:75.00},
 {id:'kannur',name:'Kannur',state:'Kerala',lat:11.87,lon:75.44},
 {id:'wayanad',name:'Wayanad',state:'Kerala',lat:11.67,lon:76.10},
 {id:'kozhikode',name:'Kozhikode',state:'Kerala',lat:11.35,lon:75.85},
 {id:'malappuram',name:'Malappuram',state:'Kerala',lat:11.05,lon:76.12},
 {id:'palakkad',name:'Palakkad',state:'Kerala',lat:10.78,lon:76.65},
 {id:'thrissur',name:'Thrissur',state:'Kerala',lat:10.53,lon:76.22},
 {id:'ernakulam',name:'Ernakulam',state:'Kerala',lat:10.02,lon:76.42},
 {id:'idukki',name:'Idukki',state:'Kerala',lat:9.88,lon:77.02},
 {id:'kottayam',name:'Kottayam',state:'Kerala',lat:9.65,lon:76.62},
 {id:'alappuzha',name:'Alappuzha',state:'Kerala',lat:9.43,lon:76.46},
 {id:'pathanamthitta',name:'Pathanamthitta',state:'Kerala',lat:9.28,lon:76.83},
 {id:'kollam',name:'Kollam',state:'Kerala',lat:8.97,lon:76.75},
 {id:'thiruvananthapuram',name:'Thiruvananthapuram',state:'Kerala',lat:8.50,lon:76.98},
 {id:'bengaluru',name:'Bengaluru Urban',state:'Karnataka',lat:12.97,lon:77.59},
 {id:'mysuru',name:'Mysuru',state:'Karnataka',lat:12.29,lon:76.64},
 {id:'dakshina-kannada',name:'Dakshina Kannada',state:'Karnataka',lat:12.91,lon:75.00},
 {id:'coimbatore',name:'Coimbatore',state:'Tamil Nadu',lat:11.02,lon:76.97},
 {id:'madurai',name:'Madurai',state:'Tamil Nadu',lat:9.92,lon:78.12},
];
export const corridors: Corridor[] = [
 {id:'c01',origin:'bengaluru',destination:'ernakulam',transit:['palakkad','thrissur'],mode:'Road'},
 {id:'c02',origin:'mysuru',destination:'kozhikode',transit:['wayanad'],mode:'Road'},
 {id:'c03',origin:'dakshina-kannada',destination:'kannur',transit:['kasaragod'],mode:'Road'},
 {id:'c04',origin:'coimbatore',destination:'thrissur',transit:['palakkad'],mode:'Rail'},
 {id:'c05',origin:'bengaluru',destination:'kozhikode',transit:['mysuru','wayanad'],mode:'Road'},
 {id:'c06',origin:'madurai',destination:'idukki',transit:[],mode:'Road'},
 {id:'c07',origin:'ernakulam',destination:'thiruvananthapuram',transit:['kottayam','kollam'],mode:'Rail'},
 {id:'c08',origin:'kozhikode',destination:'ernakulam',transit:['malappuram','thrissur'],mode:'Road'},
 {id:'c09',origin:'coimbatore',destination:'kottayam',transit:['palakkad','ernakulam'],mode:'Unknown'},
 {id:'c10',origin:'kannur',destination:'malappuram',transit:['kozhikode'],mode:'Road'},
];
export const placeName = (id: string) => places.find(p => p.id === id)?.name ?? id;
export const corridorName = (id: string) => { const c = corridors.find(c => c.id === id); return c ? `${placeName(c.origin)} → ${placeName(c.destination)}` : 'Seizure only · movement unknown'; };
