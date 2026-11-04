# Multi-area pilot: data acquisition and request pack

Research checked 4 November 2026. This is an outreach plan for the team: no requests have been sent and no partnership or access is established. See [HEATMAP_DATA_PLAN.md](HEATMAP_DATA_PLAN.md) for the broader source research, source limitations, data dictionary and UNODC file audit.

## Pilot and minimum deliverable

Request one consistent extract from Kerala Police SCRB covering all available Kerala police districts. In parallel request the same dataset from at least five district DCRBs: **Palakkad, Malappuram, Kasaragod, Pathanamthitta and Kollam Rural**. These are provisional candidates selected for geographic variety and identifiable public contacts, not claims of drug activity. Replace an area if another office can supply comparable, better-covered data faster. The five are police reporting units, not automatically five whole revenue districts. Verify jurisdictions and effective boundaries before mapping; do not label Kollam Rural as all of Kollam.

The existing pipeline needs at least five covered entities for its default four-origin calibration setup, plus other training and coverage thresholds. Five responsive offices do not guarantee five usable entities or statistical sufficiency. If one agency supplies five or more consistent subareas within one district, that can also support an exploratory multi-area pilot; coverage and representativeness still need assessment. Do not combine source universes with incompatible definitions merely to reach five.

Ask for **January 2021 to the latest complete available period**, ideally 3–5 years of weekly history. First ask for a 20–50-row de-identified sample, a dictionary and coverage statement, then the full dataset. The sample is for format review, not model training. If event records are not releasable, request agency-produced area/week counts. The minimal package is:

1. Stable area codes and boundaries or a reliable jurisdiction crosswalk, with effective dates.
2. Event date or week, area, distinct documented case/episode count, source agency, and provider-defined trafficking/supply, personal-use/consumption and unknown categories. Event-level alternative: a stable anonymous episode reference.
3. Area/week coverage and the meaning of zero, missing, partial and suppressed counts; the scope of included units and period.
4. First release/availability and revision dates, reporting delays, definitions and permission to train and publish approved aggregates. If historical release dates do not exist, record that limitation; a retrospective test cannot reconstruct actual historical knowledge with certainty.
5. If available: substance and unit, aggregate checks including no-seizure outcomes, and documented origin/transit/destination areas and modes. Do not infer a route from the detection location.

Prefer one source and common definitions for the first experiment. If agencies report the same episode, obtain provider-supported deduplication or analyze them separately. Exact coordinates, names, contact details, personal IDs and live tracking are unnecessary. Keep authorized real records outside Git and the public site.

## Outreach queue: send separately, in parallel

The email addresses below are **published office contacts**, not confirmation that the recipient can release records. Verify the directory before sending. Use one point of contact per thread, mention the common scope, and keep a shared tracker to avoid duplicate requests. Ask each office to redirect the request to its authorized data custodian if appropriate.

| Wave | Organization and recipient | Request | Verified public reference |
| --- | --- | --- | --- |
| A, day 1 | Kerala Police SCRB — `spscrb.pol@kerala.gov.in` | Statewide, consistent historical extract and permission; ask for reporting/coverage dictionary and the responsible unit. | [Police rank-wise directory](https://keralapolice.gov.in/page/rank-wise-details) |
| A, day 1 | Palakkad DCRB — `dyspdcrbpkd.pol@kerala.gov.in` | Same police-unit extract and reporting coverage; ask for approved subareas if available. | [Palakkad contacts](https://palakkad.keralapolice.gov.in/contacts) |
| A, day 1 | Malappuram DCRB — `dyspdcrbmpm.pol@kerala.gov.in` | Same request and unit-to-geography crosswalk. | [Malappuram contacts](https://malappuram.keralapolice.gov.in/contacts) |
| A, day 1 | Kasaragod DCRB — `dyspdcrbksd.pol@kerala.gov.in` | Same request and dated jurisdiction definitions. | [Kasaragod contacts](https://kasaragod.keralapolice.gov.in/contacts/) |
| A, day 1 | Pathanamthitta DCRB — `dyspdcrbpta.pol@kerala.gov.in` | Same request; distinguish police district from revenue district. | [Pathanamthitta contacts](https://pathanamthitta.keralapolice.gov.in/contacts) |
| A, day 1 | Kollam Rural DCRB — `dyspdcrklmrl.pol@kerala.gov.in` | Same request; preserve the rural jurisdiction. | [Kollam Rural contacts](https://kollamrural.keralapolice.gov.in/contacts) |
| A, day 1 | Kerala Excise Commissionerate — `ecoffice.exc@kerala.gov.in` | Forward the statewide request to the authorized Excise data/records office and identify the correct contact. This address is listed for technical assistance; it is a routing lead, not confirmed as the data custodian. | [Commissionerate contact page](https://epay.keralaexcise.gov.in/Contact) |
| A/B | Deputy Excise Commissioners in pilot areas | Equivalent area/week NDPS outcome and coverage extracts; crosswalk for Excise ranges and Police areas. Use district directories to locate each office; for example [Alappuzha's Excise directory](https://alappuzha.nic.in/en/department/excise/). | Availability and office contacts must be verified for each pilot district. |
| B | Narcotic Cells in pilot areas | Reviewed movement relationships and classification/verification guidance; request aggregate area relationships where permitted. Palakkad: `dyspnrctcpkd.pol@kerala.gov.in`; Malappuram: `dyspntctcmpm.pol@kerala.gov.in`; Kasaragod: `dyspnarcoksd.pol@kerala.gov.in`. | [Palakkad](https://palakkad.keralapolice.gov.in/contacts), [Malappuram](https://malappuram.keralapolice.gov.in/contacts), [Kasaragod](https://kasaragod.keralapolice.gov.in/contacts/) |
| B | NCB Cochin — `zdcnzu-ncb@gov.in` | Kerala-linked de-identified historical detections and documented area-level origin/destination, with duplicate and release information. | [NCB official directory](https://ncb.gov.in/) |
| B | DRI Cochin / Customs; Railway Police and RPF | Relevant detection and movement aggregates, coverage and overlap with Police/Excise; ask central offices to identify the appropriate authorized data contact. | [DRI release archive](https://dri.nic.in/main/prelease?mo=2025&ye=2025); [Railways Operation NARCOS](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2188957&lang=2&reg=48). A dedicated data-request contact was not verified. |
| B | Kerala local government / GIS custodians | Area IDs, permitted versioned jurisdiction polygons, change history and crosswalks. | [Kerala GIS portal](https://stategisportal.nic.in/stategisportal/Home/State/32); [LGD](https://lgdirectory.gov.in/) |

If formal information requests are appropriate, the [Kerala RTI portal](https://rtiportal.kerala.gov.in/) provides a route for applications to state departments. The [central RTI portal](https://rtionline.gov.in/) serves participating central authorities; check the relevant authority and current portal instructions. Prefer a concise request for existing aggregate records and descriptions. Access and timelines are not guaranteed, and RTI is not a substitute for permission to use restricted records.

## Public sources that can be collected immediately

- [Kerala Police annual SLL table](https://keralapolice.gov.in/crime-statistics/sll-cases) and [Planning Board district Excise totals](https://spb.kerala.gov.in/sites/default/files/2026-01/ER%202025%20Volume%202%20Eng%20final.pdf): check definitions and coverage against received extracts. Annual data cannot be expanded into weekly labels.
- [IHMCL monthly toll transactions](https://ihmcl.co.in/etc-transaction-reports/): optional area-level transport context, with release dates; transactions are not unique vehicles or drug movements.
- [Geofabrik southern India OSM extracts](https://download.geofabrik.de/asia/india/southern-zone.html): road and rail network context. Keep dated snapshots and comply with attribution/licensing.
- [PIB RSS directory](https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1), [NCB releases](https://ncb.gov.in/pressrelease.php), [DRI releases](https://dri.nic.in/main/prelease?mo=2025&ye=2025): discovery of recent cues for review. These are selective, not a complete historical event series.
- [AIIMS 2019 survey](https://www.aiims.edu/index.php/en/national-drug-use-survey-2019?amp++++%3Bid=1325): aggregate public-health background, not current local consumer-level labels.

The previous research found no verified public Kerala-wide weekly movement training API. [UNODC's public IDS page](https://dmpone.unodc.org/downloadIDS) offers partial significant-seizure exports; our check found no India rows in its 2024 workbook. Do not make it a dependency for the pilot.

## Schedule to 28 November

These are team targets, not agency response promises. Start 4–5 November. A shared tracker should record recipient, source link, owner, date sent, acknowledged, scope, sample/dictionary received, permissions, follow-up date, coverage gaps and next action. Do not put sensitive case data in the tracker.

| Date | Team action and decision |
| --- | --- |
| Nov 4–5 | Obtain mentor/college introduction; send Wave A separately in parallel; assign one owner each for Police, Excise, movement sources and public geography/data. Request a short call and sample/dictionary. |
| Nov 6–9 | Check acknowledgment using the published official numbers or email channels; log contact redirections and definitions. Start public-source and boundary work. |
| Nov 10–12 | Review samples and permissions; identify at least five comparable covered entities or ask a responsive provider for subareas. Request full extract. Send Wave B requests without waiting for all Wave A responses. |
| Nov 13 | Decision gate: if a consistent usable extract is received or has a concrete delivery commitment, proceed with real-data ingestion. Otherwise keep a clearly labeled synthetic demonstration while requests continue; do not claim real training or accuracy. |
| Nov 14–19 | Normalize and audit permitted records, deduplicate, audit missing periods and observation effort, harmonize boundaries, adapt aggregate input, and build 7/28-day targets supported by the data. |
| Nov 20–23 | Run time-ordered baseline and candidate evaluations, calibration and untouched holdout; review errors, abstentions and disclosure. A baseline may win. |
| Nov 24–27 | Connect a supported area forecast to the heatmap, verify cutoff/legend/coverage, and rehearse the demo. |
| Nov 28 | Demonstrate the actual achieved status, source scope, target and evaluation. Do not imply prospective validation or agency deployment. |

If weekly data is unavailable but consistent monthly aggregates are offered, retain them and redesign a monthly target/evaluation; never distribute monthly or annual totals into invented weekly observations. If only one office responds, explore its consistent subareas; do not present a local pilot as statewide. Time for authorization, data cleanup, retraining and integration depends on actual responses.

## Request A: Police SCRB and district DCRBs

**Subject:** Student research request: de-identified area-level NDPS history for a Kerala forecasting pilot

Dear Sir/Madam,

We are a student team preparing a hackathon research prototype for aggregate forecasts of documented drug-related movement and detections in Kerala. We request guidance on obtaining an authorized, de-identified historical extract for research and a possible aggregate heatmap demonstration.

Could your office share the available area-wise weekly records from January 2021 through the latest complete period, or the longest consistent recent period available? We would first appreciate a small de-identified sample, a data dictionary, the reporting-universe description and the correct data custodian.

Our priority fields are event date/week; event area and area code; anonymous case/episode reference or distinct area/week count; recording unit; your existing supply/trafficking, personal-use/consumption and unknown categories; substance/quantity/unit where available; first availability, verification and revision dates. Please also identify reporting gaps, suppressed values and periods with complete reporting. If available, aggregate historical checks including no-seizure outcomes would support interpretation.

If records are only available as aggregates, area/week distinct counts and coverage are useful. Please indicate geographic and temporal resolution available, any joint-agency duplicates, changes to definitions or jurisdictions, typical reporting delay, and permitted uses for research, training and a reviewed aggregate demonstration. We do not seek personal details, precise addresses, live tracking, confidential informant information or ongoing operational plans.

We would welcome a brief discussion and can provide a faculty introduction and a more detailed field list. Thank you for considering our request.

Regards,

[Team member and institution]

[Contact details]

## Request B: Excise and central enforcement

**Subject:** Request for de-identified NDPS detection and documented movement data for a student pilot

Dear Sir/Madam,

Our student team is developing a Kerala-area forecasting research prototype. Could you direct us to the authorized records custodian and advise whether an anonymized event extract or provider-produced area/week distinct counts can be shared for January 2021 to the latest complete period?

We seek detection date/week, detection area and reporting unit, provider-defined case category, substance and quantity/unit when available, and source/availability/verification dates. Where releasable, documented origin, transit and destination areas, mode, aggregate checks and a way to identify overlap with other agencies would help us assess logistics patterns.

Please provide a small sample, field definitions, coverage and jurisdiction description, reporting delays, and the permitted research and aggregate demonstration terms. We do not need person-level identifiers or exact addresses. A short call or referral to the appropriate office would be appreciated.

Regards,

[Team member and institution]

[Contact details]

## Request C: boundaries and geographic crosswalk

**Subject:** Request for Kerala administrative boundary files and reporting-unit crosswalk

Dear Sir/Madam,

For a student aggregate mapping project, could you advise whether Kerala district and subdistrict/local-body polygon files, stable codes, effective dates, historical boundary changes and a crosswalk to police districts/stations and Excise ranges are available? Please identify the source, permitted use, available formats and any coverage limitations. If your office does not hold a crosswalk, a referral to its custodian would be helpful.

Regards,

[Team member and institution]

[Contact details]

## Readiness and current implementation

Before training, confirm the declared target, source universe, area/time resolution, complete periods, deduplication and data-use permission. Test later unseen periods with mature labels and compare recent-history baselines. A seizure-count forecast does not establish an interception probability or the true amount of drug movement.

The current local pipeline accepts de-identified canonical event rows and coverage under the strict schema in [DATA_COLLECTION.md](DATA_COLLECTION.md). It does **not** directly accept provider-produced aggregate outcome rows or render trained heatmap overlays. Implementing and validating an aggregate adapter and supported map integration remains necessary if those data arrive.
