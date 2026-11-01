# Corridor · Kerala intelligence lab

An independent hackathon prototype for understanding **documented movements**, inspecting their evidence, challenging forecasts and preparing responsible resource-planning briefs. “Corridor” is a working title. No agency affiliation, access or partnership is implied.

The product vision is in [project.md](project.md), preserved unchanged.

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

1. **Corridor atlas:** filter real district geography by date, geography, substance, evidence and source. Zoom from district context to roads and place names, search a locality, select a schematic connection, inspect its source cards and play the 2026 scenario timeline. Seizure-only points never become inferred routes.
2. **Evidence library:** inspect source and availability dates, district precision, unknown quantities, qualitative confidence and reviewer history. Import the downloadable JSON sample; new records remain unreviewed. Documenting a new connection requires a separate documented source reference and explicit source-independence review.
3. **Forecast lab:** compare a weighted recent-history count estimate with a 90-day monthly-mean baseline. Inspect six chronological held-out windows, errors, top-three capture, missed corridors and coverage limitations. This frozen, synthetic experiment does not change when exercising imports or tip reviews.
4. **Community leads:** submit fictional private leads, inspect possible duplicate clusters and record a review. Reports never enter forecasting or training. No submission is sent to an authority.
5. **Planning briefs:** generate and save an audience-specific draft for enforcement, prevention or recovery planning. Export Markdown. Raw sources, reviewer identities and tips are excluded; corridor groups below five are suppressed.
6. **Switch role:** try the service-planner demonstration. Server responses exclude individual evidence, tips and review identities. Demo role switching is an interface exercise, not an agency authorization system.

Use **Take the guided demo** for a five-stop presentation. Press `/` to focus geographic search. Both map search boxes accept roads, addresses, landmarks and destinations: press Enter or click Search to query the Photon/OpenStreetMap index. Use Kerala/India and feature-type filters; bundled place suggestions still work offline. Evidence IDs and case text are searched separately in the Evidence library. Scroll over the map to zoom toward the pointer, drag to pan, double-click to zoom, or use touch pinch. Search 6,364 Kerala localities, 14 sourced district profiles and 194 catalogued transport features. Open a place profile for district/subdistrict, reported population, elevation provenance, time zone, alternative names and source dates. Nearby transport distances are straight-line and limited to the Kerala catalogue. Toggle Kerala focus, transport/evidence colors, layers and expanded view. Streets, basemap labels and broad feature search load online; bundled boundaries and locality profiles remain available offline. Search follows the public index, so an unnamed/unindexed map object is not guaranteed to be returned.

The Forecast lab now includes a trainable Python pipeline with separate area and documented-corridor targets, chronological model selection, empirical uncertainty ranges and a final holdout. Open its synthetic training reports or inspect a completed local aggregate report without uploading it. See [ML setup](ml/README.md), [what data to collect](ml/docs/DATA_COLLECTION.md) and [model design](ml/docs/DESIGN.md). Real data remains local and must be validated before claims about forecasting accuracy; the atlas's original frozen heuristic remains available separately.

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
