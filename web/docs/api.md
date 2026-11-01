# API

All responses are uncached JSON. Write requests with a foreign Origin are rejected. Errors have an `error` string and meaningful HTTP status. Hosting remains owner-private.

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /api/map-search?q=...&scope=kerala&category=roads` | Signed in | Explicit public-feature search. Scope `kerala`/`india`; category `all`/`roads`/`addresses`/`places`; query 2–180 chars. Photon/OpenStreetMap results include source identity, address and optional extent. D1 cache and shared request pacing; 429 with Retry-After when busy. No automatic calls while typing. |
| `GET /api/workspace` | Signed in | Current role, permitted records, aggregate summaries, frozen forecasts/evaluation, saved briefs. Planner returns empty records, leads and reviews. |
| `POST /api/session` | Signed in | `{role: "analyst" or "planner"}` selects a demonstration role. |
| `POST /api/records` | Analyst | JSON array, 1–100 synthetic unreviewed records. Strict schema, valid calendar dates, unique IDs, under 500 KB. 409 on existing ID. See `public/sample-import.json`. |
| `POST /api/tips` | Anonymous-compatible behind hosting access policy | `{district,narrative,contact?,synthetic:true}`. Fictional exercise; narrative 30–3000 chars. 201 returns receipt and unreviewed status. Hourly global cap 30. Similar recent same-district submissions share a possible duplicate cluster. |
| `POST /api/reviews` | Analyst | `{entityType,entityId,status,note,evidenceId?,independent?}`. Note 20–2000 chars. Corroboration/documentation requires a separate documented, geographically related record and explicit independence assertion. Appends audit event. Never trains on tips. |
| `POST /api/briefs` | Signed in | `{title,audience,note}`. Audience `enforcement`, `prevention`, `health`; planner cannot request enforcement. Saves generated aggregate draft and returns Markdown content. |

No route accesses an agency system, third-party case feed or LLM. Only the explicit public map-search endpoint uses an external geocoder. Production authorization must be replaced with real membership roles before sensitive-data use.
