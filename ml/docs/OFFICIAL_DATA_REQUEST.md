# Data request for a Kerala drug-movement forecasting pilot

Prepared 8 November 2026 · Independent student research/hackathon project

**Purpose:** Develop and evaluate an aggregate model that forecasts where documented drug movements or supply-related detections may occur in Kerala over the next 7 or 28 days. Outputs would identify areas and supported origin–destination connections for authorized analyst review. Agency participation, data access and operational accuracy have not yet been established.

**Our main request:** A consistent, de-identified historical extract, preferably **January 2021 through the latest complete reporting period**, covering Kerala and documented connections into, out of and through the state. We can clean existing spreadsheets or records; a newly built API or a perfectly formatted dataset is unnecessary.

## 1. What we need, in priority order

| Priority | Requested records | Why they matter |
| --- | --- | --- |
| Essential | Dated seizure/detection episodes, with geographic area, stable anonymous episode reference, recording agency and provider-defined case category. | Establish what happened, where, when and how often without counting the same episode repeatedly. |
| Essential for logistics | Separately documented origin, destination, transit areas and transport mode, linked to the episode, with evidence status and the dates those facts became known. | Learn directed movements. A seizure location alone does not identify where a consignment came from or was going. |
| Essential | Reporting coverage by area and week; included/excluded units; missing, partial and suppressed periods; release dates and revisions. | Distinguish an observed zero from an absent or incomplete report and reconstruct information available before a forecast. |
| Essential | Stable area codes, geographic precision, jurisdiction/boundary descriptions and changes. | Map records correctly; police districts, revenue districts, station jurisdictions and Excise ranges are different geographies. |
| High value | Historical aggregate enforcement/checking effort, including checks with no seizure, with area, period and definitions. | Assess how changing observation effort affects detected counts and evaluate outcomes under a defined checking regime. |
| High value | Substance, test/identification status, quantity with unit, transport category and relevant historical logistics context. | Learn differences in documented patterns without combining incompatible quantities. |
| Needed for improvement | An agreed periodic update, correction process and contact for field definitions. | Refresh forecasts and score them against later outcomes. |

If historical movement details cannot be released, please still share suitable detection history and coverage. This supports a narrower area-detection forecast while the movement component is developed.

## 2. Essential fields to preserve in an event extract

Existing field names are acceptable. A dictionary explaining their meaning is more important than matching our names.

| Group | Requested fields |
| --- | --- |
| Identity and source | Stable anonymous episode ID; anonymous source-record ID if several reports concern one episode; agency and reporting unit; joint-operation/duplicate linkage where available. The agency retains any re-identification key. |
| Event | Event date, or start/end date and precision if uncertain; seizure/detection area and stable code; geographic precision; provider-defined supply/trafficking, personal-use/consumption, manufacture, mixed or unknown classification. Please retain definitions and changes. |
| Substance | Episode-linked substance rows; identification/test status; quantity; explicit unit such as grams, kilograms or tablets; unknowns left unknown. |
| Movement | Episode/link ID; origin, intended or observed destination, ordered transit areas if documented, transport mode; whether the link is an intended journey or independently observed movement; evidence basis/status and unknown endpoints. |
| Information timing | Registration/first recording, first availability, verification, correction and withdrawal dates where retained; **separate dates for later-discovered movement facts**. Extraction date alone cannot replace these. |
| Observation and coverage | Area/week/source scope; complete, partial, unavailable or suppressed; release/revision dates; expected and reporting units where known. Historical aggregate checks, hours or units checked are useful additional tables. |

Please preserve external origin/destination area codes for Kerala-linked episodes when shareable. Exact coordinates and street addresses are unnecessary for the initial area-level pilot. Month-only records should stay month-only; dates or routes should not be estimated to fill blanks.

## 3. How much history and data?

These are **collection planning targets, not a formula guaranteeing accuracy**. Please share all eligible records in the agreed scope rather than selecting only major or successful cases.

| Package | Requested scale |
| --- | --- |
| Initial format review | **20–50 de-identified rows**, field dictionary, coverage description and permitted-use conditions. Include examples of unknowns, revisions, multiple substances and movement records if available. This is not a training dataset. |
| Preferred area model | **36–60 consecutive months**, preferably statewide at a consistent area resolution; aim to obtain **3,000–10,000 or more unique relevant episodes** if available, plus coverage. A smaller consistent extract is still valuable. |
| Preferred movement model | The same history with linked movement evidence; aim for **1,000–3,000 or more unique episodes with usable documented endpoints**, spread across recurring connections and time. Movement records can be a subset of the detection extract, not additional cases to count twice. |
| Smaller feasibility pilot | **24–36 months** across at least **five comparable covered areas**, ideally **500–1,000 relevant unique episodes**. This may support only coarse baselines; usefulness depends on density, delays and later evaluation. |
| Evaluation and updates | Reserve later unseen months; seek **hundreds of eligible later outcomes across multiple time windows** where feasible. Agree on weekly or monthly updates, with revisions and reporting delays visible. |

Do not withhold a smaller available extract because it misses these targets. The team will assess what it can support. Counts alone are insufficient: 10,000 consumption-only cases do not replace documented logistics records. Annual totals alone cannot train the proposed weekly forecast.

## 4. If individual event rows cannot be released

Please consider provider-produced **area × week** tables containing distinct episode counts, category, source scope, stable area ID/boundary version, completeness/suppression, first release and revision dates. Supply substance-specific counts separately because one episode may involve several substances.

For logistics, an **origin area × destination area × week × transport mode** table of distinct documented movement episodes, with endpoint/evidence definitions, availability and coverage, would be valuable. Specify how multi-leg journeys and unknown endpoints are counted. If movement reporting completeness cannot be established, state that limitation explicitly.

Monthly aggregates are also useful if that is all that exists; we would redesign the forecast to the supported monthly resolution. We will not invent individual cases or weekly observations from aggregates. Aggregate-input support requires an extension to our present software.

## 5. Format, transfer and permitted use

CSV/XLSX exports are preferred. Existing database exports, JSON or redacted documents can also be assessed. Please provide the codebook, category definitions, source scope, extraction date, geographic reference files, missing-value conventions and duplicate policy. A small sample should be reviewed before a large transfer. Scanned documents require additional extraction and source verification.

Please specify permission for private cleaning/training, retention, access, approved hosting, sharing with team members, aggregate demonstration/publication and later deletion or return. The transfer method should be agreed with the custodian. If records must stay inside the department, we can discuss an agency-run extract or training process instead.

We do **not** request names, phone numbers, Aadhaar or other personal IDs, suspect profiles, vehicle plates, individual phone/GPS records, informant identities, exact residential addresses or current operational plans. Stable anonymous episode references support deduplication without identifying people. Please remove personal details from free text before sharing.

## 6. What we will measure and return

We will compare forecasts with later documented outcomes and simple recent-history baselines, reporting captured events within a fixed shortlist, false alarms, missed outcomes, count errors, uncertainty, coverage and abstentions. A goal such as capturing **50% or more of later documented events within a pre-agreed limited set of areas/connections** is a research objective, not an assurance of 50% interception success. We cannot promise an accuracy percentage before real-data evaluation.

The pilot can return a data-quality/gap report, a documented model evaluation and reviewed aggregate map outputs. Operational usefulness requires subsequent agency-led evaluation; forecasts are hypotheses for human review.

## 7. Decisions requested at the meeting

1. Which office can authorize the extract, and who can explain the fields?
2. What years, categories, geographic units and movement fields exist?
3. Can we receive a small sample and dictionary first, then the agreed full extract?
4. What does zero mean, which periods/units are incomplete, and how long do reports and movement verification take?
5. How are joint operations, duplicate reports, corrections and boundary changes represented?
6. Which uses, transfers and demonstrations are permitted, and can updates and later evaluation be arranged?

**Team/institution:** ____________________

**Team contact:** ____________________

**Requested custodian/contact:** ____________________

Technical companion: [Model, data and application plan](MODEL_DATA_TRAINING_PLAN.md). Earlier contact routing and draft letters: [pilot acquisition plan](PILOT_ACQUISITION_PLAN.md).
