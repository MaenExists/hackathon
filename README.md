# Corridor · Kerala intelligence lab

An independent hackathon prototype for understanding **documented movements**, inspecting their evidence, challenging forecasts and preparing responsible resource-planning briefs. “Corridor” is a working title. No agency affiliation, access or partnership is implied.

The product vision is in [project.md](project.md), preserved unchanged.

## Run it

Requires Node.js 22.13+ (Node 26 used in development) and npm. No API keys, agency data, paid services or external map tiles are needed for local use.

```sh
cd web
npm ci
npm run setup:local
npm run dev
```

Open **http://127.0.0.1:5173**, then use **Sign in to the private demo**. Local sign-in simulates `seedy@sites.test`; production uses the Sites authentication boundary. `setup:local` builds the Worker and applies SQLite/D1 migrations; subsequent migrations are tracked and applied once.

The hosted version is owner-private, with ChatGPT sign-in. The intake page inherits that private gate; the local `/report` exercise works without an account. See the final delivery link or `web/.openai/hosting.json` for the selected Site identity.

## Walk through the project

1. **Corridor atlas:** filter real district geography by date, geography, substance, evidence and source. Select a schematic connection, inspect the source cards and play the 2026 scenario timeline. Seizure-only points never become inferred routes.
2. **Evidence library:** inspect source and availability dates, district precision, unknown quantities, qualitative confidence and reviewer history. Import the downloadable JSON sample; new records remain unreviewed. Documenting a new connection requires a separate documented source reference and explicit source-independence review.
3. **Forecast lab:** compare a weighted recent-history count estimate with a 90-day monthly-mean baseline. Inspect six chronological held-out windows, errors, top-three capture, missed corridors and coverage limitations. This frozen, synthetic experiment does not change when exercising imports or tip reviews.
4. **Community leads:** submit fictional private leads, inspect possible duplicate clusters and record a review. Reports never enter forecasting or training. No submission is sent to an authority.
5. **Planning briefs:** generate and save an audience-specific draft for enforcement, prevention or recovery planning. Export Markdown. Raw sources, reviewer identities and tips are excluded; corridor groups below five are suppressed.
6. **Switch role:** try the service-planner demonstration. Server responses exclude individual evidence, tips and review identities. Demo role switching is an interface exercise, not an agency authorization system.

Use **Take the guided demo** for a five-stop presentation. Press `/` to focus atlas search. All map assets are bundled; the atlas needs no tile-server connection.

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

React 19 + TypeScript, Vinext/Vite and a Cloudflare Worker API; SQLite locally and Cloudflare D1 when hosted. Drizzle maintains schema migrations. The geographic display is a custom accessible SVG atlas with local GeoJSON, zoom and pan. Deterministic analysis functions run on the server. No LLM key or opaque scoring service is required.

See [architecture and security boundaries](web/docs/architecture.md), [API notes](web/docs/api.md), [source provenance](web/docs/sources.md), and [demo presentation](web/docs/demo.md).
