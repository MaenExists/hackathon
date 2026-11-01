"""Build sourced Kerala place profiles and public transport context.

Usage: python scripts/prepare-places.py /path/to/IN.zip /path/to/admin2Codes.txt /path/to/featureCodes_en.txt
GeoNames (https://www.geonames.org/), CC BY 4.0. Geographic context only.
"""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

archive, admin_file, feature_file = map(Path, sys.argv[1:4])
admin2 = {}
for line in admin_file.read_text().splitlines():
    f = line.split('\t')
    if f[0].startswith('IN.13.'):
        admin2[f[0].split('.')[-1]] = f[2] or f[1]
features = {f[0]: f[1] for line in feature_file.read_text().splitlines() if len(f := line.split('\t')) > 1}
rows = []
with zipfile.ZipFile(archive) as source:
    for raw in source.open('IN.txt'):
        f = raw.decode('utf-8').rstrip('\n').split('\t')
        if len(f) >= 19 and f[8] == 'IN' and f[10] == '13':
            rows.append(f)
admin3 = {(f[11], f[12]): f[2] or f[1] for f in rows if f[7] == 'ADM3'}
references = dict(zip(['588','589','590','591','592','593','594','595','596','597','598','599','600','601'], ['kasaragod','kannur','wayanad','kozhikode','malappuram','palakkad','thrissur','ernakulam','idukki','kottayam','alappuzha','pathanamthitta','kollam','thiruvananthapuram']))

def number(text):
    try: return int(text)
    except ValueError: return None

def profile(f, kind):
    aliases = list(dict.fromkeys([f[2], *f[3].split(',')]))
    local = next((name for name in aliases if re.search('[\u0d00-\u0d7f]', name)), '')
    reported, dem = number(f[15]), number(f[16])
    return dict(id=f'geonames-{f[0]}', geonamesId=int(f[0]), name=f[1], localName=local,
                aliases=' '.join(aliases), alternativeNames=[n for n in aliases if n and n != f[1]][:12],
                kind=kind, featureCode=f[7], featureLabel=features.get(f'{f[6]}.{f[7]}', 'Geographic feature'),
                lat=float(f[4]), lon=float(f[5]), country='India', state='Kerala',
                district=admin2.get(f[11]), districtCode=f[11] or None,
                subdistrict=admin3.get((f[11], f[12])),
                population=number(f[14]) or None, populationYear=None,
                elevationM=reported if reported is not None else dem,
                elevationKind='reported' if reported is not None else 'DEM estimate' if dem is not None else None,
                timezone=f[17] or None, sourceModified=f[18],
                sourceUrl=f'https://www.geonames.org/{f[0]}/', retrievedAt='2026-11-01')

places, districts, transport = [], [], []
transport_types = {'AIRP':'Air facility','RSTN':'Railway station','RSTP':'Railway stop','PRT':'Port','HBR':'Harbour'}
for f in rows:
    if f[6] == 'P' and f[7] not in ('PPLH','PPLQ','PPLW'):
        places.append(profile(f, 'populated place'))
    elif f[7] == 'ADM2':
        p = profile(f, 'district'); p['referenceId'] = references.get(f[11]); districts.append(p)
    elif f[7] in transport_types:
        p = profile(f, 'transport'); p['transportType'] = transport_types[f[7]]; transport.append(p)
for group in (places, districts, transport):
    group.sort(key=lambda p: (p['name'].casefold(), p['id']))
result = dict(source='GeoNames India country dump, Kerala admin1 code 13',
              url='https://download.geonames.org/export/dump/IN.zip',
              licence='CC BY 4.0', retrieved='2026-11-01',
              sourceSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
              adminSourceSha256=hashlib.sha256(admin_file.read_bytes()).hexdigest(),
              featureSourceSha256=hashlib.sha256(feature_file.read_bytes()).hexdigest(),
              note='Representative locality coordinates. Population reference year is not supplied; zero or missing population remains unknown. DEM elevation is an estimate. Transport operation and completeness are not verified. No case evidence.',
              places=places, districts=districts, transport=transport)
target = Path(__file__).resolve().parents[1] / 'public/data/kerala-places.json'
target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Prepared {len(places)} places, {len(districts)} districts, {len(transport)} transport features ({target.stat().st_size:,} bytes)')
