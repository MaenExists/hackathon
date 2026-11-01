# Source register

Researched 1 November 2026. Public facts are contextual; **none establish a demonstration corridor**. All case records, reviews, tips and service-planning scenarios are fictional. No live agency connection exists.

| Source | Use and limitations |
| --- | --- |
| [Kerala Police SLL case statistics](https://keralapolice.gov.in/crime-statistics/sll-cases) | Official statewide NDPS counts: 2020 4,968; 2021 5,695; 2022 26,619; 2023 30,697; 2024 27,530; 2025 36,314. Snapshot, subject to revision. These are registered cases, not drug prevalence, unique people, routes or total trafficking. 2026 is partial and excluded from annual comparisons. |
| [Kerala Police Yodhav](https://ps.keralapolice.gov.in/kothamangalam-ps/notifications/Yodhav--War-against-Narcotics-3332) | Official reporting channel reference; WhatsApp 9995966666, independently confirmed on the Police statistics page. The prototype does not forward reports to it. |
| [UNODC IDS dataset and interpretation](https://dmpone.unodc.org/downloadIDS) | Significant seizure events submitted by member states; incomplete reporting and possible duplicates. Researched for methodology only; no IDS records downloaded or repurposed as Kerala routes. |
| [UNODC seizure guidance](https://www.unodc.org/documents/data-and-analysis/statistics/Drugs/Seizure_Cases_Guidance_Note_English.pdf) | Case-level seizure reporting differs from annual aggregates. |
| [Open Data Kerala district boundaries](https://github.com/opendatakerala/kl_district) | OpenStreetMap-derived polygons, ODbL 1.0. Snapshot downloaded from the repository, simplified at 0.005° and rounded to four decimals for display. Attribution must remain visible. Not an authoritative administrative boundary product. |
| [GeoNames country dump](https://download.geonames.org/export/dump/IN.zip) | 6,364 populated-place references in Kerala (country IN, admin1 13), excluding historical, abandoned and destroyed settlement codes. Bundled locality search and context points; CC BY 4.0. Names, alternative names and coordinates retained; not exhaustive, authoritative or street addresses. |
| [CARTO basemap](https://github.com/CartoDB/basemap-styles) | Online Dark Matter raster tiles, rendered in grayscale. OpenStreetMap roads and place names emerge by zoom. Attribution to CARTO and OpenStreetMap contributors remains visible; no tile cache, bulk download or offline street-detail claim. |
| [Natural Earth countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson) | India and Sri Lanka selected from 1:110m admin-0 map. Public domain. Simplified display context, not authoritative boundaries. |
| [Operation Toofan context](https://thazhekkodepanchayat.lsgkerala.gov.in/en/page/operation-toofan) | Context-file reference. Direct retrieval timed out during research; no facts extracted from the unavailable page. |

## Geographic dataset licence

District boundary geometry is adapted from © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), via Open Data Kerala. The adapted database in `public/data/kerala.geojson` is offered under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). This database licence does not change the application code licence. Natural Earth is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).

`python scripts/prepare-demo.py` regenerates the synthetic scenario deterministically (seed 28112026). Geographic regeneration additionally requires the original downloads at the two `/tmp` paths documented in that script. Bundled boundaries and locality search work offline; detailed street tiles require an internet connection. CARTO receives ordinary visible tile requests (map extent and zoom), never case records or lead narratives. The UI displays a fallback message when tile requests fail.

## Locality dataset

Locality references are from [GeoNames](https://www.geonames.org/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Retrieved 1 November 2026 from its India country dump. `python scripts/prepare-places.py /path/to/IN.zip` reproduces the subset; `public/data/kerala-places.json` records the source archive checksum. The local search never calls a geocoder or sends typed place searches to a third party. The gazetteer is geographic context and never generates case evidence.

OpenStreetMap Overpass was investigated as an alternative locality source, but requests failed or timed out; no Overpass records are included.
