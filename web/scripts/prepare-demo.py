"""Reproducible synthetic scenario and simplified, attributed geographic assets."""
import json, random, math
from pathlib import Path
random.seed(28112026)
from datetime import date,timedelta
records=[]
substances=['Cannabis','Stimulants','Opioids','Other']
destinations=['ernakulam','kozhikode','kannur','thrissur','kozhikode','idukki','thiruvananthapuram','ernakulam','kottayam','malappuram']
for month in range(22):
    year=2025+month//12; m=month%12+1
    for route in range(10):
        count=max(0,round([5,4,3,4,2,2,3,3,1,2][route]+random.gauss(0,1.6)+(month/7 if route in [0,1,4] else -month/16 if route==3 else 0)))
        for n in range(count):
            event=date(year,m,random.randint(1,28));available=event+timedelta(days=random.randint(1,12))
            status=random.choices(['documented','unreviewed','disputed'],[.83,.12,.05])[0]
            ident=f'SYN-{len(records)+1:04d}'
            records.append(dict(id=ident,corridorId=f'c{route+1:02d}',seizurePlace=destinations[route],eventDate=str(event),availableDate=str(available),sourceDate=str(available),substance=random.choices(substances,[4,4,1,1])[0],quantity=None,unit='unknown',status=status,precision='district',source=f'Fictional movement register / {ident}',excerpt=f'Synthetic scenario {ident}: a district-level origin and destination with supporting fictional transport and recovery notes. Intermediate connections are schematic; no road, person or institution is identified.',reviewer='Demo reviewer 01' if status!='unreviewed' else None,reviewedAt=str(available+timedelta(days=1)) if status!='unreviewed' else None,confidence='supported' if status=='documented' else 'limited' if status=='disputed' else 'unknown',confidenceBasis='Two independent fictional source records agree on district endpoints. No street-level trace.' if status=='documented' else 'Conflicting fictional accounts; connection excluded from forecasting.' if status=='disputed' else 'No review or corroboration has been recorded.',synthetic=True))
# Seizures with unknown movements remain point records, never inferred routes.
for i,district in enumerate(['kollam','alappuzha','pathanamthitta','malappuram','kasaragod','palakkad']):
    r=dict(records[i]);r.update(id=f'SYN-P{i+1:03d}',corridorId=None,seizurePlace=district,eventDate='2026-10-16',availableDate='2026-10-19',sourceDate='2026-10-19',status='unreviewed',confidence='unknown',reviewer=None,reviewedAt=None,source=f'Fictional seizure register / SYN-P{i+1:03d}',excerpt='Fictional seizure location only. Origin, destination and transport mode are unknown.',confidenceBasis='Movement endpoints are unknown. A seizure does not establish a corridor.');records.append(r)
Path('data/cases.json').write_text(json.dumps(records,separators=(',',':'))+'\n')
Path('public/sample-import.json').write_text(json.dumps([dict(records[0],id='SYN-IMPORT-001',eventDate='2026-10-22',availableDate='2026-10-25',sourceDate='2026-10-25',reviewedAt=None,reviewer=None,status='unreviewed',confidence='unknown',confidenceBasis='Imported synthetic record pending analyst review.')],indent=2)+'\n')
def simplify(points,epsilon=.005):
    if len(points)<4:return points
    a,b=points[0],points[-1]
    def distance(p):
        dx,dy=b[0]-a[0],b[1]-a[1]
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx or dy else 0
        return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
    distances=[distance(p) for p in points];k=max(range(len(points)),key=lambda i:distances[i])
    if distances[k]>epsilon:return simplify(points[:k+1],epsilon)[:-1]+simplify(points[k:],epsilon)
    return [a,b]
def geometry(g):
    polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    return {'type':'MultiPolygon','coordinates':[[[[round(v,4) for v in p[:2]] for p in simplify(ring)] for ring in poly] for poly in polys]}
if Path('/tmp/kerala-districts.geojson').exists():
    d=json.loads(Path('/tmp/kerala-districts.geojson').read_text())
    fs=[]
    for f in d['features']:
        if f['geometry']['type'] not in ['Polygon','MultiPolygon'] or f['properties'].get('admin_level') != '5':continue
        fs.append({'type':'Feature','properties':{'name':f['properties'].get('name','District')},'geometry':geometry(f['geometry'])})
    Path('public/data/kerala.geojson').write_text(json.dumps({'type':'FeatureCollection','features':fs},separators=(',',':')))
if Path('/tmp/countries.geojson').exists():
    d=json.loads(Path('/tmp/countries.geojson').read_text())
    fs=[{'type':'Feature','properties':{'name':f['properties']['NAME']},'geometry':geometry(f['geometry'])} for f in d['features'] if f['properties']['ADM0_A3'] in ['IND','LKA']]
    Path('public/data/land.geojson').write_text(json.dumps({'type':'FeatureCollection','features':fs},separators=(',',':')))
print(f'Generated {len(records)} synthetic records')
