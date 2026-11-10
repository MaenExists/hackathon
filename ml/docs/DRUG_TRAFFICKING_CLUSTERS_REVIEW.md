# Review: drug-trafficking-clusters

Reviewed 10 November 2026 for the Kerala forecasting project. Repository: [leehuihui13/drug-trafficking-clusters](https://github.com/leehuihui13/drug-trafficking-clusters), revision [`26d522778330583460742631c2704c4c731537c5`](https://github.com/leehuihui13/drug-trafficking-clusters/commit/26d522778330583460742631c2704c4c731537c5), last commit 26 April 2024.

## Assessment in plain language

This is an exploratory analysis prototype for historical international drug seizures. Its useful contributions are a ready-made global data example, a substance classification table, and the idea of comparing groups of seizures by drug, transport and setting. It does **not** demonstrate prediction of future Kerala hotspots or a measured forecasting accuracy. Its clustering entry point is broken, and its map represents country-level totals rather than genuine within-country locations.

Use it as a reference for data exploration and mistakes to avoid. Keep our existing time-ordered forecasting pipeline. The data audit below does not establish that a Kerala model will or will not find useful predictive patterns.

## Scope of the inspection

- Read every repository source/configuration file: README, requirements, Git attributes and all five scripts.
- Downloaded all three Git LFS data objects, verified their declared SHA-256 values and byte lengths, and scanned the entire processed CSV.
- Inspected the original workbook's 12 yearly sheets, column headers and declared dimensions; their total declared data rows agree with the processed CSV count. The raw spreadsheet was not independently reparsed row by row to reproduce every preprocessing transformation.
- Inspected the drug dictionary and reproduced two clustering failures with synthetic inputs using the declared `kmodes==0.12.2` dependency. The temporary dependency install did not alter this project's ML environment.
- Did not send Google geocoding requests, supply an API key, fit the global regression, or claim a successful end-to-end reproduction. The hosted demo could not be verified through the web tool.
- No upstream code or raw records were integrated into the application or training dataset. Research downloads are outside the project, under `~/.cache/codex-research/`.

## What each component actually does

| Component | Observed behavior | Relevance to our project |
| --- | --- | --- |
| [Data preprocessing](https://github.com/leehuihui13/drug-trafficking-clusters/blob/26d522778330583460742631c2704c4c731537c5/scripts/process_data.py) | Combines yearly spreadsheets, parses dates, geocodes country names through Google, maps drugs to groups and encodes categories. | Useful staging example, but geography and record provenance need substantial changes. |
| [Clustering](https://github.com/leehuihui13/drug-trafficking-clusters/blob/26d522778330583460742631c2704c4c731537c5/scripts/cluster_model.py) | Attempts to group historical records with K-prototypes, which combines numeric and categorical features. | A possible exploratory method, not a future-event forecast. The committed entry point does not run. |
| [Regression](https://github.com/leehuihui13/drug-trafficking-clusters/blob/26d522778330583460742631c2704c4c731537c5/scripts/regression_model.py) | Fits linear, Ridge and Lasso models to drug quantity, using a random 80/20 split, and prints mean squared error. | Different target from future area case counts. Its scores cannot establish hotspot prediction accuracy. |
| [Dashboard](https://github.com/leehuihui13/drug-trafficking-clusters/blob/26d522778330583460742631c2704c4c731537c5/scripts/create_dash.py) | Filters past records by year/drug group and plots counts grouped by country and its assigned coordinate. | Basic historical exploration. It does not load clustering results or show future forecasts. |
| [Shell pipeline](https://github.com/leehuihui13/drug-trafficking-clusters/blob/26d522778330583460742631c2704c4c731537c5/scripts/run.sh) | Starts preprocessing and the blocking Dash server, then references two scripts absent from the repository. | Not a reproducible training pipeline as committed. |

## What is in the data

These are our measurements of the pinned processed CSV, not claims of complete agency reporting or unique seizure events.

| Measurement | Result |
| --- | ---: |
| Total processed rows | 1,261,725 |
| Countries represented | 126 |
| Source years | 2011–2022 |
| Indian rows | 3,685 |
| Distinct complete Indian rows | 3,310 |
| Indian rows mentioning Kerala-related place names in city/admin fields | 21 |
| Distinct complete rows within those Kerala-name matches | 19 |
| Years containing those Kerala-name matches | 2014–2021 |
| Explicit case-ID column | None |
| Coordinate pairs assigned to all Indian rows | One |
| Drug dictionary names/groups used by preprocessing | 160 names in 13 groups |
| Rows mapped to Unspecified drug group | 8,313 |
| Rows retained by the regression's complete-detail filter | 92,078, approximately 7.30% |

The 21 Kerala-name matches are 19 rows mentioning Cochin and two mentioning Idukki. This is a text-based screening result, **not 21 independently verified Kerala cases**. Some administrative values identify agencies/offices rather than a clean state or province. Identical rows also do not prove identical underlying cases; without event identifiers, independent case counting and deduplication remain unresolved.

The 12 yearly raw sheets have 14 columns: date, country, ISO code, subregion, region, drug, quantity, unit, city/place, administrative region, seizure setting, transport, source type and reporting channel. The processed CSV adds country coordinates, a drug group and indicator columns. It provides neither complete office/week reporting declarations nor historical first-availability dates, verified movement endpoints, or observation effort.

Indian row counts are notably uneven: 56 in 2011, one in 2012, seven in 2013, 523 in 2014, and 448 in 2022. These are observations about this public extract. They cannot be interpreted as India's true annual NDPS case counts or as proof of a change in underlying activity.

UNODC states that its public IDS data cover significant reported seizures, may contain duplicates and depend on voluntary national contributions; they do not present a complete picture of seizures or trafficking. The official page also offers newer exports than this repository's 2022-ending snapshot. [Official IDS download and coverage notes](https://dmpone.unodc.org/downloadIDS).

### Verified data objects

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `IDS-data-2011_2022-Nov23.xlsx` | 75,441,699 | `0d5a3b289e57521a8b7cdd8bd70c7ec442c1a3a89149fabadd8bd01c28d475ed` |
| `drug_list.xlsx` | 25,113 | `ec2be56bf61d9b19df6334ccb0d29fcaae16659828a110567323d4213edcdf96` |
| `processed_data.csv` | 407,232,319 | `6624dbeda9e645559ac6ce5988b5fe24cdb1ea06875d09e827a701d2e89bdb00` |

The repository uses Git LFS. An ordinary clone without LFS content initially contains small pointer files, not these spreadsheets/CSV. Our review retrieved the public objects and verified them against those pointers before auditing.

## Important limitations and reproduced failures

### Country coordinates cannot establish local hotspots

Preprocessing geocodes each country once and assigns that result to every record from the country. All 3,685 Indian rows have latitude `20.593684`, longitude `78.96288`. Every represented country has exactly one coordinate pair in the processed data.

That is a representation of the country, not the location of each seizure. A large map marker there does not show a real cluster of incidents. Although city/place fields exist in the source, the geocoding function ignores them. For our project, source-confirmed event geography and its precision must govern placement. An office name or broad country coordinate must never become a fictitious exact event point.

### Clustering fails before producing a useful result

At line 76, the entry point calls `perform_clustering(filtered_data)`, while the function requires an additional `variables` argument. Reproduced result:

```text
TypeError: perform_clustering() missing 1 required positional argument: 'variables'
```

Supplying a suitable synthetic feature table and the missing argument exposes the next problem: `n_clusters` receives `range(2, 11)` rather than one integer. Reproduced result:

```text
TypeError: '<=' not supported between instances of 'range' and 'int'
```

Additional inspection finds fixed categorical positions that are not derived from the selected feature names, no implemented comparison across cluster counts, an unused silhouette-score import, and no persistence of record labels for the dashboard. Correcting the two errors alone would not establish a valid or stable geographic clustering method.

### Quantity regression mixes measurement units

The target is the unconverted `Drugquantity` number. `Drugunit` is not used to normalize it or separate tasks. The 92,078 rows retained by its filter contain 50,407 kg entries, 31,833 g entries, 7,670 unit entries, 1,521 tablet/pill entries, 345 plant entries, 155 litre entries, four ampoule entries, 57 other entries and 86 entries without a unit.

A kilogram, gram, tablet count and litre cannot be treated as one interchangeable target. Compatible mass units should be normalized; incompatible units and substance categories need separate handling. Count forecasting can preserve item quantities as separate features without making this quantity-regression mistake.

The regression also discards approximately 92.7% of rows because selected details are missing. That creates a much narrower sample; a complete-detail subset is not automatically representative. For our area model, missing transport or setting should usually remain explicitly unknown rather than cause an otherwise usable dated/location record to disappear.

A random train/test split can investigate a cross-sectional quantity task. It is not evidence that a model predicts later hotspot periods. The repository supplies no time-ordered hotspot test, future target window, baseline comparison, geographic selection budget or uncertainty for that task. No demonstrated 50% forecasting result was found.

### The advertised pipeline is incomplete

`run.sh` references `scripts/train_model.py` and `scripts/visualize_model.py`, neither of which exists. Its Dash process also blocks normal sequential progression while the server runs. There are no committed test cases or fitted-model evaluation artifacts establishing an end-to-end result. These are limitations of the inspected revision, not claims about unpublished work by its author.

## Useful ideas to adapt

1. **Keep a standard substance dictionary.** Preserve the source drug name and map it to a stable group, with an explicit unknown category. The 160-name dictionary is a starting example, not a current complete catalogue of every relevant substance or local synonym.
2. **Explore profiles before forecasting.** Compare cases by drug group, transport and seizure setting, and check whether patterns repeat across later months. This can guide feature development. A cluster by itself does not prove future predictability or identify a trafficking organization.
3. **Use already structured public data for engineering practice.** This global dataset can exercise importers, unit checks, missingness reports and exploratory charts without manually downloading PDF after PDF. Keep it separate from Kerala training labels and from any claim of complete local coverage.
4. **Retain raw and normalized records separately.** Extend this idea with case identifiers, page/source provenance, revisions, evidence status, geographic precision and availability dates.
5. **Treat geography and missingness as first-class data quality questions.** The map and regression demonstrate how reasonable-looking output can conceal coarse coordinates or substantial record loss.

## Recommended next work for our project

- Build and audit the Malayalam/English case-report extractor using representative local files.
- Produce a quality report for dates, actual event locations, units, duplicate references and optional missing fields.
- Add an exploratory view of historical area/substance/transport patterns, clearly marked as historical observations.
- Keep the existing Poisson count model and recent-history baselines for the first forecasting experiment. Evaluate on later time periods with an agreed geographic/horizon budget and reporting coverage.
- Experiment with clustering only after location quality is established, and retain it only if it helps interpretation or demonstrably improves later forecasts.
- Use local/agency outcome history to establish Kerala performance. The 21 historical Kerala-name rows here do not support a credible local hotspot training/evaluation claim.

No change to `project.md`, the accepted ML input contract, the application, or the current model was made by this review.
