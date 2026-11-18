# Corridor · Kerala intelligence lab

An independent hackathon prototype for understanding **documented movements**, inspecting their evidence, challenging forecasts and preparing responsible resource-planning briefs. “Corridor” is a working title. No agency affiliation, access or partnership is implied.

The product vision is in [project.md](project.md), preserved unchanged.

For a new session, start with [CONTEXT.md](CONTEXT.md) and [AGENTS.md](AGENTS.md). The context explains the current implementation, the separate sibling data collector, training readiness and where to continue. Cross-project context is in the [workspace handoff](../CONTEXT.md) when that folder is available.

## Run it

Requires Node.js 22.13+ (Node 26 used in development) and npm. No API keys, agency data or paid services are needed. Street detail loads online from OpenStreetMap; bundled district boundaries, locality search and evidence work without street tiles.

```sh
cd web
npm ci
npm run setup:local
npm run dev
```

Open **http://127.0.0.1:5173**, then use **Sign in to the private demo**. Local sign-in simulates `seedy@sites.test`; production uses the Sites authentication boundary. `setup:local` builds the Worker and applies SQLite/D1 migrations; subsequent migrations are tracked and applied once.

The hosted version is owner-private, with ChatGPT sign-in. The intake page inherits that private gate; the local `/report` exercise works without an account. See the final delivery link or `web/.openai/hosting.json` for the selected Site identity.

## Walk through the project

1. **Corridor atlas:** explore 1,137 real documented drug seizures geocoded across all 14 Kerala districts and checkposts. Filter by substance category (MDMA/Stimulants, Ganja/Cannabis, Heroin/Opioids), transit mode, date and district. Inspect dynamic transit corridors connecting interstate supply hubs (Bengaluru, Odisha/Andhra, Mangalore, Delhi, International Air) through key border checkpoints (Muthanga, Walayar, Thalappady, CIAL) into Kerala.
2. **Evidence library:** inspect verified source links, exact quantities, enforcement agencies (Kerala Police, Excise), and dates for every seizure. Click through directly to original news publications (Manorama, Mathrubhumi, The Hindu, etc.).
3. **Forecast lab:** replay five held-out months of the Kerala news model and 30-day corridor movement projections. Compare predicted and observed counts by district and inspect accuracy, precision, recall and count error across three methods.
4. **Community leads:** submit anonymous community leads, inspect possible duplicate clusters and record an analyst review. Reports remain partitioned from training labels to avoid bias.
5. **Planning briefs:** generate and save an audience-specific draft for enforcement, prevention or recovery planning. Export Markdown. Raw reviewer identities and unverified tips are excluded.
6. **Switch role:** try the service-planner demonstration. Server responses exclude individual evidence, tips and review identities. Demo role switching is an interface exercise, not an agency authorization system.

Use **Take the guided demo** for a five-stop presentation. Press `/` to focus geographic search. Both map search boxes accept roads, addresses, landmarks and destinations: press Enter or click Search to query the Photon/OpenStreetMap index. Use Kerala/India and feature-type filters; bundled place suggestions still work offline. Evidence IDs and case text are searched separately in the Evidence library. Scroll over the map to zoom toward the pointer, drag to pan, double-click to zoom, or use touch pinch. Search 6,364 Kerala localities, 14 sourced district profiles and 194 catalogued transport features. Open a place profile for district/subdistrict, reported population, elevation provenance, time zone, alternative names and source dates. Nearby transport distances are straight-line and limited to the Kerala catalogue. Toggle Kerala focus, transport/evidence colors, layers and expanded view. Streets, basemap labels and broad feature search load online; bundled boundaries and locality profiles remain available offline. Search follows the public index, so an unnamed/unindexed map object is not guaranteed to be returned.

The guided hackathon demo starts with the news model results. The selected method scored 70.0% accuracy, 71.4% precision and 69.4% recall on 70 held-out district-months. These results use collected news and a retrospective publication-date proxy. The website bundles only district-month aggregates. [Walkthrough](web/docs/demo.md) · [Full evaluation](ml/docs/NEWS_SNAPSHOT_V1.md)

For public source acquisition, the independent [Excise report collector](tools/excise-collector/README.md) queues 2025–2026 NDPS report searches and saves original PDFs, provenance and resumable progress in the ignored `raw data/` folder. Its local workbench automates downloads around human-entered portal security codes. Portable Windows, macOS and Linux launchers are included; source documents do not enter training automatically.

## Verify

```sh
cd web
npm run typecheck
npm test
npm run build
npm run db:local
npx playwright install chromium
npm run test:e2e
```

The browser suite checks the complete persistence and review workflow, duplicate intake, cross-origin rejection, invalid calendar dates, duplicate import IDs, anonymous restrictions, planner API restrictions, the frozen forecast, brief content, evidence dialogs, filters and phone-width overflow. It saves desktop and phone screenshots in ignored `web/outputs/`. To use an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

GitHub Actions repeats these checks with an isolated local D1 database.

## Data and limits

- **761 synthetic seed records**, reproducible with `python scripts/prepare-demo.py` from `web/`. January 2025–October 2026, ten fictional corridors, and seizure-only observations. No real people or case data.
- Real Kerala polygons from Open Data Kerala / © OpenStreetMap contributors, adapted under ODbL 1.0; regional country geometry from public-domain Natural Earth. Attribution is visible on the map. Geometry sources and adaptation details are in [the source register](web/docs/sources.md).
- Public Kerala Police aggregate statistics appear only as background context; they never establish a corridor or train the experiment.
- Forecast estimates concern **future documented cases**, not the probability of trafficking, individual wrongdoing or treatment demand. No calibrated uncertainty interval or real-world validation is claimed.
- The five-record suppression rule is a demonstration choice, not an assurance of anonymity. Production needs agency-approved privacy rules and protection against differencing attacks.
- Fictional intake only. Optional contact is stored as entered; hosting infrastructure can retain access logs. No anonymity, emergency response or official reporting integration is promised.

## Architecture

React 19 + TypeScript, Vinext/Vite and a Cloudflare Worker API; SQLite locally and Cloudflare D1 when hosted. Drizzle maintains schema migrations. The geographic display uses Leaflet with monochrome OpenStreetMap street tiles, bundled district GeoJSON and a GeoNames gazetteer. Mouse, keyboard and touch navigation support zoom levels 6–19. A separate OpenStreetMap state boundary dims surroundings while preserving cross-border evidence. Road/rail/maritime colors and violet forecast hypotheses have explicit legends; evidence remains at district resolution. Deterministic analysis functions run on the server. No LLM key or opaque scoring service is required.

See [architecture and security boundaries](web/docs/architecture.md), [API notes](web/docs/api.md), [source provenance](web/docs/sources.md), and [demo presentation](web/docs/demo.md).
