"""Build the offline Kerala gazetteer from the GeoNames India country dump.

Usage: python scripts/prepare-places.py /path/to/IN.zip
GeoNames (https://www.geonames.org/), CC BY 4.0. Geographic context only.
"""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

archive = Path(sys.argv[1])
places = []
with zipfile.ZipFile(archive) as source:
    for raw in source.open('IN.txt'):
        fields = raw.decode('utf-8').rstrip('\n').split('\t')
        if len(fields) < 19 or fields[8] != 'IN' or fields[10] != '13' or fields[6] != 'P':
            continue
        if fields[7] in ('PPLH', 'PPLQ', 'PPLW'):
            continue  # Historical, abandoned and destroyed settlements.
        aliases = list(dict.fromkeys([fields[2], *fields[3].split(',')]))
        local = next((name for name in aliases if re.search('[\u0d00-\u0d7f]', name)), '')
        places.append(dict(id=f'geonames-{fields[0]}', name=fields[1], localName=local,
                           aliases=' '.join(aliases), kind='populated place',
                           lat=float(fields[4]), lon=float(fields[5])))
places.sort(key=lambda p: (p['name'].casefold(), p['id']))
result = dict(source='GeoNames India country dump, Kerala admin1 code 13',
              url='https://download.geonames.org/export/dump/IN.zip',
              licence='CC BY 4.0', retrieved='2026-11-01',
              sourceSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
              note='Representative locality coordinates; not exhaustive or verified addresses. No case evidence.',
              places=places)
target = Path(__file__).resolve().parents[1] / 'public/data/kerala-places.json'
target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Prepared {len(places)} Kerala populated places ({target.stat().st_size:,} bytes)')
