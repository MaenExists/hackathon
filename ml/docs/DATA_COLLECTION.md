# What to ask data providers for

The application is ready to train once a suitable dataset exists. Start with a consistent reporting universe and two to three years of weekly data if possible. A small well-documented dataset is more useful than many copied articles. You can develop the area target first; documented movement endpoints are required for the corridor target.

Ask the provider for the permitted use and retention terms, stable anonymized case references, event dates, first availability/release dates, verification dates, withdrawal/correction dates, seizure districts, substance classification and quantities with units. Request documented origins/destinations/transport modes only where supported by a source; leave unknown fields blank. Ask how multiple agencies and news reports refer to the same case, so you can assign one canonical ID.

Ask separately which areas/weeks have a complete extract, which contain reporting gaps, when each extract became available, and what changed in coverage or enforcement. Where available, request aggregate checks/operations, observation effort and known reporting delays. A list of seizure cases alone does not show whether a week with no rows had zero cases or missing reporting.

Annual totals and public background statistics cannot substitute for dated case records in this pipeline. Do not expand an annual total into invented event rows or infer origins from a seizure district. Keep those sources as context until a separate aggregate-series target is designed for their actual resolution.

For logistics, request aggregate transport-volume indices or authorized route-level context with a measurement period, source, unit and availability date. A road existing on a map does not establish a drug movement. For consumption and services, ask only for authorized aggregate surveys or counts, denominator/sample size, collection period and release date. Keep those measures separate from seizure counts and treatment need. Do not collect consumer names, IDs, locations of individuals, patient/student records or live GPS tracks for this model.

## Files and exact columns

Run `corridor-ml init --out ml/data/department` for blank files. The same headers are committed in `ml/templates/`. CSV columns are strict to prevent accidental extra personal fields. Dates use UTC calendar days `YYYY-MM-DD`; reporting weeks start on Monday. Period ends are exclusive. Readiness errors point to the field that needs fixing.

### dataset.json

Set `schema_version: 1`, `data_mode: "real"`, a nonempty `permitted_use_reference` (your internal approval/agreement reference), and `coverage_description` explaining the agencies, jurisdictions and years represented. This local metadata is not an application for access and does not create authorization. The synthetic generator creates its own separate metadata; do not relabel synthetic events as real.

### entities.csv

`entity_id,target_type,name,origin_id,destination_id,area_id,transport_mode,known_since,distance_km`

- Area: `area-ernakulam,area,Ernakulam,,,ernakulam,Unknown,2024-01-01,`
- Corridor: `corridor-001,corridor,Documented connection,origin-district,ernakulam,,Road,2024-06-01,`

Use stable district/area IDs consistently across files. `known_since` is when the entity/corridor became known to this analysis; do not define an allegedly known historical corridor from future discoveries. `distance_km` is optional aggregate transport context, never an inferred route. Modes: Road, Rail, Maritime, Air, Unknown. Define each area or `(origin,destination,mode)` only once.

### events.csv

`case_id,event_date,available_date,documented_date,withdrawn_date,seizure_area_id,origin_id,destination_id,transport_mode,substance,quantity,unit,source_kind,source_ref,corroboration_ref`

One row per **canonical case**, not per article, suspect or drug item. `documented_date` blank means it has not been verified and cannot train the model. Use `withdrawn_date` when the documentation was withdrawn/disputed; keep the earlier documentation date to preserve historical knowledge. Corrections to fields/endpoints need a reproducible dated source extract; this first version does not reconstruct a full field-by-field revision ledger. Never quietly replace old source extracts in an existing run.

`source_kind` is department or reviewed_news for real data; synthetic is accepted only in a synthetic dataset. `source_ref` is a stable restricted document ID or permitted public URL. Reviewed news needs an independently corroborating `corroboration_ref`, not another article copying the first one. These references remain local, outside the aggregate website report.

Substances: Cannabis, Stimulants, Opioids, Other. For multiple substances, use one agreed primary classification per canonical case in this first version, keep detailed items in the source system, and document your policy. Do not repeat the case to add a substance. Units: g, kg, tablets, unknown; unknown quantities are blank. Different substances and mass/tablets are never added into a single volume target. Both origin and destination are provided only if documented; leave both blank for seizure-only observations.

### coverage.csv

`entity_id,week_start,complete,available_date,source_ref`

Example: `area-ernakulam,2025-01-06,true,2025-01-15,extract-reference`

`true` means the reporting extract for that entity/week is complete within the dataset's described universe, as confirmed by the provider. `false` or a missing week is unknown, not zero. Releases can revise a previous completeness assertion with a later availability date. A week with `true` and no eligible documented cases is a genuine observed zero for this target. Do not generate `true` for every week just to make training run. Corridor completeness needs a provider-defined movement reporting universe, not only a complete list of seizures at the destination.

### covariates.csv (optional)

`entity_id,metric,period_start,period_end,available_date,value,unit,sample_size,source_ref`

| Metric | Unit | Meaning |
| --- | --- | --- |
| enforcement_checks | count | Aggregate observed checks/operations in the period; define the measure consistently. |
| transport_flow_index | index | Aggregate logistics activity; use a consistent definition and scale. |
| consumption_rate | percent | Aggregate survey estimate, 0–100; integer sample_size of at least 30 required. |
| service_contacts | count | Aggregate contacts in a defined service dataset, not a trafficking measure. |
| rainfall_mm | mm | Past measured rainfall over the period, not future realized weather. |

Optional means genuinely optional: leave absent rather than invent values. More variables do not automatically improve forecasting. Availability must be on/after period end. Record every new release/revision separately. Sample sizes below 30 are rejected for consumption data, but this threshold alone does not establish privacy or statistical reliability.

## Routine after data arrives

1. Keep original source extracts in an access-controlled location. Normalize into the ignored `ml/data/` directory; never put departmental records into Git or the website seed dataset.
2. Assign canonical case IDs, review evidence and unknowns, then run `validate`.
3. Pick a realistic reporting-delay window from the agency's historical delays. Train area and corridor targets separately, using a new run directory for each.
4. Open `report.html`, compare all methods on the final holdout, inspect interval coverage and per-area errors, and read `model-card.md`. A baseline winning is a legitimate result.
5. Append newly available data, run `forecast` with the trusted model, and later use `evaluate` when outcomes mature. Retrain into a new run only after reviewing changes in coverage and errors.

## News and frequent updates

Put permitted public RSS/Atom URLs in a local JSON file: `{"feeds": ["https://publisher.example/approved-feed.xml"]}`. The committed `feeds.example.json` is deliberately empty. Use `fetch-news --watch` for ongoing polling. The inbox keeps title/link, publisher date, first-seen time, possible duplicate group and review status; it does not download article bodies or infer facts from a headline.

Export with `news-inbox`, review the original source, and record corroboration with `review-news`. Accepted news still needs a structured, independently supported event row and canonical-case merge. Set actual first-availability and documentation dates; an old article found today does not become information the model knew years ago. An unverified news claim or community tip never becomes a training label automatically.
