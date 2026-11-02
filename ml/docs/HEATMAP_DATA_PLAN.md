# Kerala forecasting heatmaps: data requirements and sourcing plan

Research checked: **2 November 2026**. Prepared for the team's data collection; no agency has been contacted or access arranged. This is a research and collection proposal, not a change to `project.md` or an implemented heatmap model. The existing training interface is documented in [DATA_COLLECTION.md](DATA_COLLECTION.md).

## Recommendation

Collect a consistent history of **documented supply/movement-related detections by area and week**, together with reporting coverage and, where available, aggregate observation effort. Request **three to five years**, with a two-year pilot as a fallback subject to the evaluation design. Ask for recent updates through the latest complete reporting period.

The display will be a heatmap, so exact seizure coordinates are optional. An agency can provide de-identified records assigned to areas, or an already deduplicated area/week table. Start at the finest geography that the records support reliably; a detailed basemap does not justify detailed predictions.

The most valuable acquisition is a historical Police or Excise extract. Public annual tables, news, transport networks and weather can complement it but cannot substitute for weekly outcome labels. This research did **not verify a public, Kerala-wide, regularly updated case-level or weekly training API**.

## 1. Define what the heat means

For the first real-data experiment, forecast the **expected number of later documented supply/movement-related seizure or detection episodes in each area over the next 7 or 28 days**. The definition must match the agency's classification and reporting universe. If only undifferentiated seizure records are available, label the output accordingly and keep that limitation visible.

Keep trafficking/supply cases, personal-use/consumption cases, manufacture and unknown classifications separate. Do not classify a person or infer trafficking simply from quantity. The official [MHA parliamentary answer published by PIB](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2036398&lang=1&reg=3) reports trafficking-related NDPS cases separately from overall NDPS totals. That distinction matters for this project's logistics objective.

Progress toward the primary movement/interception goal using two additional datasets:

- **Documented movement relationships:** known origin/transit/destination areas, event period, mode, supporting source, and when that relationship became known. These support incoming/outgoing and neighboring-area patterns without requiring an exact journey.
- **Observation/interception outcomes:** aggregate checks or searches, the units checked, detections, and no-seizure outcomes by area/time. These support evaluation under a defined observation regime. A negative check does not prove that an entire area had no activity, and a hit rate under selected checks is not an unconditional probability of trafficking.

Seizure history alone measures a combination of underlying activity and detection/reporting. It cannot identify the total hidden flow or guarantee that an interception will succeed. These are distinctions between targets, not a reason to abandon movement forecasting.

## 2. Heatmap geography and time

| Information supplied | Defensible initial output | Decision |
| --- | --- | --- |
| Revenue-district identifiers and weekly counts | District polygons colored by forecast | Statewide fallback. |
| Consistent taluk/local-body identifiers and sufficient repeated observations | Taluk/local-body heatmap | Preferred finer pilot when coverage supports it. |
| Reviewed locations precise enough for a fixed grid | Equal-area grid, with roughly 5–10 km cells as candidates | Test several resolutions; merge/abstain where sparse. These sizes are proposals, not established accuracy. |
| Only annual district totals | Annual historical comparison | Insufficient for a weekly predictive heatmap. |

Do not turn district totals into small-cell labels by dividing them evenly, assigning them to district centroids, or scattering artificial points. Preserve uncertain locations at their actual precision. Police districts, revenue districts, police stations and Excise ranges require an explicit crosswalk; they are not interchangeable.

Use stable area IDs and versioned polygons with effective dates. Boundary revisions need a documented harmonization method. Prefer a consistent coarse geography when historical records cannot be reassigned accurately. Do not divide station counts among overlapping polygons without evidence.

Recommended refresh: a weekly prediction cycle with 7-day and 28-day horizons, plus reviewed signal updates between cycles. Actual freshness must reflect source arrival and verification delays. A faster news poll does not make departmental outcomes real time.

Each output needs an information cutoff, target period, forecast value, uncertainty, data support and model version. Distinguish **forecast intensity**, **historical observations**, and **coverage/uncertainty**. Unknown areas should be gray or hatched, not shown as low activity. If areas have unequal sizes, state whether color represents expected count or count per square kilometre. Relative scores are not calibrated probabilities. Any visual smoothing must preserve the model's actual resolution and must not invent hotspots across unsupported areas or the state boundary.

## 3. Data to request, in priority order

### A. Required: outcome history

Preferred: de-identified event records. Acceptable alternative: provider-produced counts by area and week with explicit definitions and deduplication.

| Field group | Ask for | Purpose |
| --- | --- | --- |
| Stable references | Anonymous case/episode ID, recording agency/unit, cross-agency duplicate reference where available | Avoid counting one detection several times or one row per arrested person. |
| Dates | Event date/time or event week, registration date, first system availability, verification date, correction/withdrawal dates | Build historical snapshots and measure reporting delay. Preserve timezone for timestamps. |
| Geography | Area code/name, area type, jurisdiction, boundary version; optional reviewed coordinates and accuracy | Assign observations to supported heatmap units. Use event location, not home address or the office registering a case. |
| Case classification | Provider-defined supply/trafficking, possession for personal use, consumption, manufacture, unknown; original category/section if permitted | Keep the target aligned with logistics. Preserve changes to definitions over time. |
| Substance and quantity | Substance name/group, test status, amount, unit and unknown flags | Separate substance patterns and avoid mixing kilograms, tablets, litres and blot counts. |
| Evidence and provenance | Source reference, verification status, extract/version ID, extraction date, permitted-use reference | Review, reproducibility and corrections. |

For multi-substance detections, retain a parent episode table and separate substance items if supplied. Count the episode once for an all-substance target; substance-specific summaries may overlap and must not be summed into a distinct-event total.

### B. Required: coverage and release history

For **every area and period**, including those with no listed event, ask:

- Which agencies/units are included? What kinds of cases are excluded?
- Is the extract complete, partial, unavailable or suppressed? What do blanks, dashes and zeros mean?
- How many units were expected to report, and how many did?
- When was the period first released, finalized or revised?
- Did a jurisdiction, case definition, reporting system or detection campaign change?

Reporting completeness means complete records within that extract's declared scope, not that all trafficking was observed. Preserve suppressed small counts as suppression, not zero. A retrospective finalized spreadsheet with no release history can support a preliminary retrospective study, but cannot establish what a live model would have known at each past cutoff.

### C. High priority: aggregate enforcement/observation effort

Request historical counts of relevant checks/searches/inspections, observation hours or another consistently defined effort measure, by area/week. Include periods and checks with no seizure and descriptions of selection policy or campaign changes. Keep different units of effort separate: vehicle checks and premises searches do not have an interchangeable denominator.

This is essential for interpreting a heatmap intended to identify interception opportunities. Where unavailable, document that gap and evaluate recorded detections without claiming to have corrected for detection bias. Use effort known at prediction time; future realized effort cannot be a predictive feature. Any future planned effort is a separate explicitly known scenario input.

### D. High priority for movement learning: documented logistics

Request origin, destination and transit **area** codes; movement period; transport mode; links between documented episodes; supporting source; and relationship-verification/availability dates. Distinguish a shipment's documented origin from an individual's residence, arrest site or nationality.

Keep partially known endpoints in the collection layer. Do not fill gaps from the nearest road, a timetable or an assumption. These records can support aggregate origin–destination tables if raw records cannot be shared. Ask whether a table counts cases, consignments or journey legs, and whether the provider can identify overlaps with the seizure table.

### E. Optional: public context

- Road/rail connectivity and transport facilities: static logistics context.
- Toll traffic, airport movements/passengers/cargo and port cargo: dated aggregate activity, with release dates and units.
- Holidays and calendar effects: information known in advance.
- Past rainfall or issued weather forecasts: only after testing relevance and historical availability.
- Aggregate consumption surveys or service totals: separate contextual measures with sample size, collection period and uncertainty. Individual consumer data is unnecessary.

Do not delay the core dataset to obtain these extras. Transport volume does not prove drug carriage. State-level prevalence cannot be spread into weekly local consumption labels, and service demand is not a direct trafficking measure.

## 4. Sources the team should prioritize

### Departmental records: highest value, request needed

| Priority/source | What is verified publicly | What the team should request | Access status |
| --- | --- | --- | --- |
| **1. Kerala Police SCRB; district DCRBs** | The [SCRB page](https://keralapolice.gov.in/page/state-crime-records-bureau), [official contact directory](https://keralapolice.gov.in/page/rank-wise-details) and [Police activity report](https://keralapolice.gov.in/storage/pages/custom/ckFiles/file/Kerala_Police_Activity_Report_2019.pdf) identify the records/statistics structure. | A consistent statewide de-identified event or area/week extract, case categories, release dates, coverage and effort. If statewide access is slow, request a consistent district pilot. | Detailed historical extracts require approval; no public bulk API verified. The directory currently lists `spscrb.pol@kerala.gov.in`; check it before sending. |
| **2. Kerala Excise Commissionerate; district Deputy Excise Commissioners** | The [Economic Review 2025 appendix](https://spb.kerala.gov.in/sites/default/files/2026-01/ER%202025%20Volume%202%20Eng%20final.pdf) publishes Excise district case totals. An [official district directory](https://alappuzha.nic.in/en/department/excise/) provides an example of the office hierarchy and contacts. | Range/circle or area/week NDPS outcomes, classifications, seizure substances, documented movements, effort and coverage. Request an area/range crosswalk. | Detailed extracts require approval. Published summaries establish aggregate reporting, not availability of every requested field. |
| **3. District Narcotic Cells / DANSAF** | An [official Kochi unit description](https://kochicity.keralapolice.gov.in/storage-kochicity_keralapolice_gov_in/pages/custom/table/table-fWA85SSIpeGDKtTv1OXsBmy0T.pdf) describes NDPS monitoring and DANSAF supervision. | Reviewed, de-identified movement relationships and help distinguishing event geography from administrative registration. | Approach through authorized district leadership; public notices are selective. |
| **4. NCB Cochin; DRI/Customs offices responsible for Kerala** | [NCB](https://ncb.gov.in/), its [press-release archive](https://ncb.gov.in/pressrelease.php), [a Cochin release](https://narcoticsindia.nic.in/pressrelease/cochin_seizure_08_04_25.pdf), and [DRI's archive](https://dri.nic.in/main/prelease?mo=2025&ye=2025) publish selected detections. | Permitted de-identified Kerala-linked seizure/movement extracts, location precision, known external connections and duplicate references. | Public releases available; comprehensive records and ongoing intelligence are not assumed accessible. |
| **5. Railway Protection Force and Kerala Railway Police** | An [official Ministry of Railways release](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2188957&lang=2&reg=48) describes Operation NARCOS. | Historical rail-linked detections in the relevant Kerala-serving jurisdictions, documented boarding/destination areas where known, and aggregate checks. | Request records through the appropriate offices; the public release is a national summary. Handover between agencies must not create duplicate cases. |

Public information and restricted intelligence are different. [PIB explicitly describes NIDAAN as exclusive to drug law-enforcement agencies](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2112770&lang=2&reg=48). NIDAAN/CCTNS access is not an open-data acquisition route for the hackathon, and this model does not require offender profiles.

### Public sources: useful now, with limits

| Source | Available material / format | Appropriate role and limits |
| --- | --- | --- |
| [Kerala Police SLL statistics](https://keralapolice.gov.in/crime-statistics/sll-cases) | Public web table of statewide annual NDPS totals, plus an explicitly partial current year. | Background and definition-matched reconciliation. Not weekly or local training labels. |
| [Kerala State Planning Board, Economic Review 2025 Vol. II](https://spb.kerala.gov.in/sites/default/files/2026-01/ER%202025%20Volume%202%20Eng%20final.pdf) and [2024 Vol. II](https://spb.kerala.gov.in/sites/default/files/2025-02/ER_2024%20Eng_Vol%202_Press.pdf) | Appendix 5.5.9: district Excise case counts; nearby tables include other enforcement summaries. PDF. | Cross-check district history and identify the reporting department. Partial-year columns must retain their dates. No invented weekly allocation. |
| [NCRB Crime in India](https://www.ncrb.mha.gov.in/crime-in-india-year-wise.html?year=2024), [OGD NDPS listings](https://www.data.gov.in/keywords/NDPS), [MHA/PIB trafficking table](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2036398&lang=1&reg=3) | Annual statistical publications, catalog entries and parliamentary annexures. | Definition checks, historical comparisons and context. The OGD Kerala [personal-use versus trafficking resource](https://www.data.gov.in/resource/year-wise-number-cases-registered-under-ndps-possession-drugs-personal-useconsumption-and) was indexed, but its downloadable payload/API was not verified here. Do not assume all catalog pages expose usable CSV/API records. |
| [NCB state seizure summaries](https://www.narcoticsindia.nic.in/ImportantSeizure/seizure2024.pdf) | Annual state/substance summaries, with explicit quantity units. PDF. | Substance context and reconciliation after checking agency scope and counting definitions. These are not case trajectories. |
| [UNODC public Individual Drug Seizures download](https://dmpone.unodc.org/downloadIDS) | Excel exports for significant seizures; the page currently describes 2011–2024 and warns of incomplete reporting. | Possible supplementary international context after a coverage audit. The checked public 2024 workbook contained no India rows; see audit below. Restricted DMP access is separate. |
| [Official Police district news example](https://kannurrural.keralapolice.gov.in/news-and-events/13), [NCB releases](https://ncb.gov.in/pressrelease.php), [DRI releases](https://dri.nic.in/main/prelease?mo=2025&ye=2025), [PIB RSS directory](https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1) | Dated notices, PDFs and a documented PIB RSS feed. | Reviewed recent cues and source discovery. Selective publication and copied reports prevent treating news as complete outcome coverage. |
| [Geofabrik Southern Zone](https://download.geofabrik.de/asia/india/southern-zone.html) | OSM PBF, Shapefile and GeoPackage extracts; older snapshots are listed. | Road/rail/facility context, clipped to Kerala and permitted neighboring context. Network completeness varies; retain snapshot dates and [OSM attribution/license](https://www.openstreetmap.org/copyright). |
| [Local Government Directory](https://lgdirectory.gov.in/), [Ministry of Panchayati Raj LGD material](https://panchayat.gov.in/en/document/local-government-directory-demo/), [Kerala NIC GIS portal](https://stategisportal.nic.in/stategisportal/Home/State/32), [KSMART K-Map](https://maptile.ksmart.lsgkerala.gov.in/) | Administrative identifiers/directories and mapping portals. | Build stable area codes and seek approved boundary files with effective dates. A public viewer does not establish a downloadable, openly licensed historical polygon API. Confirm export and reuse terms. |
| [IHMCL ETC transaction reports](https://ihmcl.co.in/etc-transaction-reports/) | Monthly plaza-level reports and older annual archives; checked [January 2025 PDF](https://ihmcl.co.in/wp-content/uploads/2025/07/Jan-2025.pdf) contains vehicle-class counts and amounts, including Kerala plazas. | A useful aggregate road-activity proxy. Counts are transactions, not unique vehicles or origin–destination journeys; PIU/RO labels are not geographic district codes. Retain release/revision dates and verify plaza locations. |
| [AAI Traffic News](https://www.aai.aero/en/business-opportunities/aai-traffic-news), [Cochin Port cargo history](https://cochinport.gov.in/sites/default/files/inline-files/Statistics%20Cargo%2012%20Years%20-%20Up%20to%202024-25.pdf) | AAI lists monthly airport annexures; the checked port publication is annual commodity/cargo history. | Optional airport/port context. Confirm each file's temporal coverage, release date and location. Port annual totals are not weekly shipping flows. |
| [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api) | Documented historical weather API with several underlying datasets/resolutions and delays. | Optional past weather context. Check hosted-service use terms and retain dataset/release availability. Reanalysis is not automatically the weather information that was available to a live forecast at that date. |
| [AIIMS national substance-use survey](https://www.aiims.edu/index.php/en/national-drug-use-survey-2019?amp++++%3Bid=1325) | National/state survey findings published in 2019. | Background or carefully justified aggregate context, not current local weekly consumption or movement labels. |
| [GDELT DOC API documentation](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts//) | Recent-news discovery API; documentation describes a rolling three-month search window. | Optional discovery supplement. No guarantee of complete Kerala/Malayalam reporting; publisher rights still apply. Historical news archives need a separate acquisition/coverage plan. |

## 5. Checks performed and unresolved access

Research included official Police statistics and directories, Excise/Planning Board publications, NCRB/OGD, MHA/PIB answers, NCB/NCORD, DRI, rail enforcement, UNODC, administrative GIS, transport statistics, weather and news documentation. Only source-supported availability is claimed above.

Specific checks:

- Opened the Kerala Police statewide SLL table: it is annual and statewide. The current displayed year is explicitly partial.
- Opened a [station statistics page](https://ps.keralapolice.gov.in/kannurtown-ps/crime-statistics): this example contains old annual IPC/SLL totals, not the recent weekly NDPS extract needed here. Station pages need individual audits.
- Opened IHMCL's January 2025 PDF and inspected the header and Kerala rows: monthly plaza vehicle-class counts are present. The page warns that ETC records can be revised.
- Downloaded [UNODC's linked 2024 workbook](https://dmpone.unodc.org/sites/default/files/2025-03/IDS-data-2024-Feb25_0.xlsx), **8,394,010 bytes**, and parsed its worksheet. Country/territory and ISO3 columns contained **zero India/IND rows**, and no cell contained Kerala. This is a check of that public file only, not of all UNODC holdings or earlier years. Its public headers include seizure date, country, city/administrative region, substance, unit, quantity, location, mode and source; no stable case-ID column was present in that file. Do not assume the public export supplies the full restricted schema.
- UNODC 2024 workbook SHA-256: `09cdc4af71f99f9589e73291ad89e68fa13ad8044db7a138a291c0981ba5f3c6`. The downloaded workbook stays outside the repository.
- The UNODC 2018–2023 file download timed out before completion; its India/Kerala coverage was **not** established. The download page has stale update wording, so check actual files rather than assuming current coverage.
- Some official pages timed out or required dynamic rendering. AAI annexures and the OGD Kerala resource were located through indexed official listings; successful bulk/API extraction was not established. The NCRB year-filter page returned no listing rows in the research client despite links to 2024 publications. These access limits do not establish that a dataset is absent.

No fee-free API for comprehensive local drug movements was verified. Avoid planning around an assumed public FIR, NIDAAN, live vehicle, mobile-phone or agency-intelligence API.

## 6. Collection package and proposed tables

Ask first for **20–50 de-identified sample rows plus a data dictionary and coverage description**. This checks meaning/structure, not model sufficiency. Then request the full permitted history, preferably from January 2021 through the latest complete period, accepting a shorter consistent three-year series if necessary.

Two collection routes are useful:

1. **Event route:** de-identified episodes, substance items, documented movement links, reporting coverage and optional effort/context. Aggregate into the selected area/week panel after canonical deduplication.
2. **Aggregate route:** the agency produces distinct area/week outcomes and optional movement counts, with coverage and release metadata. This can train an area forecast without receiving exact points or person-level records. Cross-agency overlap must already be resolved or the targets must remain separate by source.

Suggested deliverables:

| File | Grain and essential contents |
| --- | --- |
| `source_manifest` | Provider, scope, time coverage, extract/revision date, definitions, permissions, exclusions and deduplication policy. |
| `area_registry` + polygons | Stable area ID/type, parent ID, official/source codes, aliases, boundary version, effective dates and geometry. |
| `episodes` (event route) | Anonymous episode ID, event date/area/precision, category, source, availability/verification and correction history. |
| `substance_items` (event route) | Episode ID, substance, test status, quantity and explicit unit. |
| `area_week_outcomes` (aggregate route or derived) | Area ID/version, week start, source scope, case category, distinct episode count, completeness/suppression, release/revision date. Substance-specific counts are separate. |
| `area_week_coverage_effort` | Area/week/source, complete/partial/unavailable/suppressed, expected/reporting units, optional checks/hours with definitions, release date. |
| `movement_links` (if available) | Episode/link ID or defined aggregate period, origin/transit/destination areas, mode, count definition, source and knowledge dates. |
| `context` / `reviewed_signals` (optional) | Area/transport node, measurement/event period, metric/value/unit or canonical event link, publication/first-seen/verification and availability times. |

These are **proposed collection tables**, not new accepted CLI headers. Current `corridor-ml` input remains the strict canonical-case schema in [DATA_COLLECTION.md](DATA_COLLECTION.md). It does not directly accept aggregate count rows, richer category/item tables or a geospatial heatmap registry. Those require an adapter/schema extension and validation. Never manufacture individual event rows to satisfy the current interface.

For weekly aggregation, agree on Monday-start weeks, an explicit timezone policy and period endpoints. Do not split monthly outcomes into weeks. If only monthly data is available, change the target to a supported monthly forecast and redesign validation.

## 7. Amount of history and acceptance criteria

- **Preferred:** 36–60 consecutive months of consistent outcomes and coverage, through the latest mature period. This is a project planning recommendation, not a guarantee of accuracy.
- **Fallback:** roughly 24 months with a narrower pilot/geography and a feasible time-based evaluation design. Twelve months may support an exploratory baseline but does not demonstrate recurring annual patterns robustly.
- **Geographic breadth:** statewide data at a consistent coarse scale is valuable; a smaller multi-area pilot with reliable records is also useful. Do not imply statewide validation from one district.
- **Event volume:** there is no universal required case count. Examine supply-related events per area/horizon, zero rates, reporting gaps and independent evaluation periods. A huge number of sparse cells does not create useful evidence.
- **Panel size:** 14 districts × 156 weeks is about 2,184 area/week rows, but those rows are correlated and are not 2,184 independent cases or guaranteed adequate evidence.

Before training, confirm that usable labels exist after accounting for reporting delay; episode duplication and category definitions are understood; geography is consistent; unknown and suppressed counts are preserved; and the recent period is sufficiently mature. Do not set arbitrary completeness flags to force a run.

Hold out a later period, preferably several months where the data allows, and use earlier time blocks for model selection and uncertainty calibration. Account for overlapping 28-day horizons and label maturity. Compare against recent-history and seasonal baselines. Evaluate the selected hottest areas by both captured documented events and **area selected**; a large selected area can inflate apparent capture. Report false alarms, misses, lead time, per-area errors and uncertainty coverage.

Reserve a prospective shadow period: freeze forecasts before outcomes arrive, record source/observation coverage and later score them. This is needed to establish usefulness beyond a retrospectively reconstructed heatmap. Any prospective agency participation remains to be arranged.

## 8. Suggested request for the team to send

> We are a student hackathon team developing an aggregate forecasting model for drug movement and seizure patterns in Kerala. Outputs will be area-level heatmaps for future time windows, intended for authorized analyst review. We are seeking permission to use historical de-identified records or provider-produced area-by-week aggregates for research and evaluation.
>
> Please indicate whether you can share records from January 2021 to the latest complete reporting period, or the longest consistent recent period available. We would first appreciate a small de-identified sample, field dictionary, reporting-scope description and your permitted-use conditions.
>
> Our priority fields are anonymous case/episode reference; event date/week; event area and geographic precision; provider-defined trafficking/supply versus personal-use/consumption/unknown category; substance and quantity with unit; recording agency; and record availability, verification and revision dates. Exact coordinates and personal information are unnecessary for the heatmap.
>
> If event records cannot be shared, please consider distinct area/week case counts with classification, area identifiers/boundaries, completeness and suppression indicators, release dates and a deduplication description. Where releasable, aggregate historical checks/searches including no-seizure outcomes, and documented origin/transit/destination area relationships, would improve evaluation.
>
> Please specify excluded units/periods, duplicate or joint-agency cases, changes in definitions/reporting/enforcement, normal reporting delays, and which materials may be used for private training, aggregate demonstration or publication. We do not seek names, addresses, phone numbers, person identifiers, live tracking, confidential informant details or ongoing operational plans.

Use current official department contacts and a college/mentor introduction where available. The [Kerala RTI portal](https://rtiportal.kerala.gov.in/) also provides an official route for requests to state departments; follow its current guidance. A request does not guarantee that a particular extract exists or can be disclosed. Keep correspondence and agreements outside public project materials. This document drafts a request only; nothing has been sent.

## 9. Team work plan

| Workstream | First task | Deliverable |
| --- | --- | --- |
| Department liaison | Approach Police SCRB/DCRB and Excise in parallel; request sample/dictionary and a named data contact. | Approved scope, sample and permissions; fallback geography/period if needed. |
| Outcome data | Inventory extracts, categories, duplicates, coverage and release delays. | Reviewed event or area/week history plus a gap register. |
| Geography/logistics | Obtain versioned area codes/polygons; audit jurisdiction crosswalk; download appropriate OSM context. | Consistent area registry and dated transport context. |
| Recent-source review | Start with official releases and documented PIB RSS; assess permitted publisher feeds and Malayalam place aliases. | Reviewed, deduplicated signal history with timestamps and canonical links. |
| Model/evaluation | Audit density by candidate resolution; define target, horizon and chronological holdout before fitting. | A justified heatmap resolution, baseline and evaluation plan. |

If only one acquisition effort can succeed, prioritize **a consistent area/week history of relevant detections, with reporting coverage and classification**. Seek aggregate observation effort next. Documented movement relationships then bring the model closer to the primary logistics goal; optional public context should follow demonstrated predictive value.
