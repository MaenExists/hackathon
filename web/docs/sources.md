# Source register

Researched 1 November 2026. Public facts are contextual; **none establish a demonstration corridor**. All case records, reviews, tips and service-planning scenarios are fictional. No live agency connection exists.

| Source | Use and limitations |
| --- | --- |
| [Kerala Police SLL case statistics](https://keralapolice.gov.in/crime-statistics/sll-cases) | Official statewide NDPS counts: 2020 4,968; 2021 5,695; 2022 26,619; 2023 30,697; 2024 27,530; 2025 36,314. Snapshot, subject to revision. These are registered cases, not drug prevalence, unique people, routes or total trafficking. 2026 is partial and excluded from annual comparisons. |
| [Kerala Police Yodhav](https://ps.keralapolice.gov.in/kothamangalam-ps/notifications/Yodhav--War-against-Narcotics-3332) | Official reporting channel reference; WhatsApp 9995966666, independently confirmed on the Police statistics page. The prototype does not forward reports to it. |
| [UNODC IDS dataset and interpretation](https://dmpone.unodc.org/downloadIDS) | Significant seizure events submitted by member states; incomplete reporting and possible duplicates. Researched for methodology only; no IDS records downloaded or repurposed as Kerala routes. |
| [UNODC seizure guidance](https://www.unodc.org/documents/data-and-analysis/statistics/Drugs/Seizure_Cases_Guidance_Note_English.pdf) | Case-level seizure reporting differs from annual aggregates. |
| [Open Data Kerala district boundaries](https://github.com/opendatakerala/kl_district) | OpenStreetMap-derived polygons, ODbL 1.0. Snapshot downloaded from the repository, simplified at 0.005° and rounded to four decimals for display. Attribution must remain visible. Not an authoritative administrative boundary product. |
| [GeoNames country dump](https://download.geonames.org/export/dump/IN.zip) | 6,364 populated-place references in Kerala (country IN, admin1 13), excluding historical, abandoned and destroyed settlement codes. Bundled locality search and context points; CC BY 4.0. Names, administrative hierarchy, coordinates, feature codes, population, elevation/DEM provenance, time zones and source modification dates retained; not exhaustive, authoritative or street addresses. Also includes 14 district profiles and 194 transport features. |
| [Photon / OpenStreetMap search](https://github.com/komoot/photon) | Public OSM geocoding index for roads, addresses, landmarks and destinations. User-initiated queries only, with cached results, a conservative shared request limit, application identification and visible OSM attribution. Public demo service is best-effort, not guaranteed complete. Returned source points and extents are geographic context, never case routes. |
| [OpenStreetMap standard tiles](https://operations.osmfoundation.org/policies/tiles/) | Online standard raster tiles, rendered in inverted grayscale. Roads and place names emerge by zoom. Visible attribution, default browser identification/referrer and HTTP caching are preserved. No bulk download or offline street-detail feature. Automated browser tests intercept tile requests rather than fetching public tiles. |
| [Kerala state boundary / Nominatim](https://www.openstreetmap.org/relation/2018151) | OpenStreetMap relation 2018151, retrieved once through the Nominatim search API with polygon geometry and simplification threshold 0.001 degrees. Bundled for the Kerala focus mask and state outline; ODbL 1.0, illustrative rather than an authoritative legal boundary. No runtime Nominatim calls or online autocomplete. |
| [Natural Earth countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson) | India and Sri Lanka selected from 1:110m admin-0 map. Public domain. Simplified display context, not authoritative boundaries. |
| [Operation Toofan context](https://thazhekkodepanchayat.lsgkerala.gov.in/en/page/operation-toofan) | Context-file reference. Direct retrieval timed out during research; no facts extracted from the unavailable page. |

## Geographic dataset licence

District boundary geometry is adapted from © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), via Open Data Kerala. The adapted database in `public/data/kerala.geojson` is offered under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). This database licence does not change the application code licence. Natural Earth is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).

`python scripts/prepare-demo.py` regenerates the synthetic scenario deterministically (seed 28112026). Geographic regeneration additionally requires the original downloads at the two `/tmp` paths documented in that script. Bundled boundaries and locality search work offline; detailed street tiles require an internet connection. OpenStreetMap receives ordinary visible tile requests (map extent and zoom), never case records or lead narratives. The UI displays a fallback message when tile requests fail.

## Locality dataset

Locality references are from [GeoNames](https://www.geonames.org/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Retrieved 1 November 2026 from its India country dump. `python scripts/prepare-places.py /path/to/IN.zip /path/to/admin2Codes.txt /path/to/featureCodes_en.txt` reproduces the enriched subset; `public/data/kerala-places.json` records the source archive checksum. Bundled suggestions do not call a geocoder. Pressing Enter or Search now submits the explicit geographic query through the server to Photon/OpenStreetMap; typing alone and evidence-library search do not. The gazetteer is geographic context and never generates case evidence.

OpenStreetMap Overpass was investigated as an alternative locality source, but requests failed or timed out; no Overpass records are included.

CARTO was also investigated: higher-zoom responses contained API-key-required placeholder images despite HTTP 200. It is not used by the deployed map. A visual inspection, beyond HTTP status checks, identified this limitation.

## Enriched place facts and transport context

The GeoNames [dump field documentation](https://download.geonames.org/export/dump/readme.txt), [administrative code table](https://download.geonames.org/export/dump/admin2Codes.txt) and [feature-code definitions](https://www.geonames.org/export/codes.html) define the fields. District labels join source administrative codes; subdistrict labels come from ADM3 records in the same India dump. No administrative assignments are inferred from synthetic corridors.

Only 525 of the 6,364 locality records report a nonzero population, and 6,328 have a named subdistrict. Zero or absent population is shown as not reported; the reference year is not supplied and the record-modified date does not date each field. Elevation distinguishes a reported value from a DEM terrain estimate.

Transport records retain only AIRP, RSTN, RSTP, PRT and HBR feature codes. The catalogue has 194 Kerala features, not a complete or current operational inventory. Air facilities can include non-civil facilities. Nearby results show at most two railway features, one air facility and one port/harbour within 120 km, by great-circle distance. They do not establish a usable journey, current service, case connection, enforcement priority or treatment need.

`python scripts/prepare-state.py /path/to/nominatim-response.json` reproduces the state boundary. Its original cached API query was `https://nominatim.openstreetmap.org/search?q=Kerala%2CIndia&format=jsonv2&polygon_geojson=1&polygon_threshold=0.001&limit=1`. The geometry database is adapted under ODbL 1.0 with visible OpenStreetMap attribution.

## Search provider and fixtures

The [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md) supplies feature names, OSM identity, category, address fields, representative points and optional extents. Public results are © OpenStreetMap contributors, ODbL 1.0. Case records and tips are not sent. The public demo permits reasonable project use without availability guarantees; source configuration can switch to a compatible hosted instance.

Road and mall response fixtures under `tests/fixtures/` were retrieved on 1 November 2026 using explicit Banerji Road and LuLu Mall searches. They retain public source identity for reproducible tests; no credentials or personal case data are included. Searches may miss unnamed/unindexed objects, abbreviations, or newly changed map features.

Nominatim was evaluated during research but is not used for runtime map search. Photon is the production search provider; the earlier cached Nominatim state-boundary download remains unchanged.
