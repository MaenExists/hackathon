"""Normalize one cached Nominatim state-boundary response; no runtime geocoding.
Usage: python scripts/prepare-state.py /path/to/nominatim-response.json
"""
import json
import sys
from pathlib import Path
source = json.loads(Path(sys.argv[1]).read_text())
state = next(p for p in source if p.get('osm_type') == 'relation' and p.get('osm_id') == 2018151)
assert state['geojson']['type'] in ('Polygon', 'MultiPolygon')
feature = dict(type='Feature', properties=dict(name='Kerala', source='OpenStreetMap via Nominatim', sourceUrl='https://www.openstreetmap.org/relation/2018151', licence='ODbL 1.0', retrievedAt='2026-11-01', simplificationDegrees=0.001), geometry=state['geojson'])
target = Path(__file__).resolve().parents[1] / 'public/data/kerala-state.geojson'
target.write_text(json.dumps(feature, ensure_ascii=False, separators=(',', ':'))+'\n')
print(f'Prepared state boundary: {target.stat().st_size:,} bytes')
