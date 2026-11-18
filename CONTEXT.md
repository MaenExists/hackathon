# Main project continuation context

Updated 18 November 2026. Read [AGENTS.md](AGENTS.md) and the preserved [project.md](project.md) first. The [workspace handoff](../CONTEXT.md) connects this repository to the sibling collector; this file remains the Main entry point when only this repository is available.

## Product intent and implementation boundaries

**Corridor** is an undecided working title for a Kerala-focused hackathon project, due 28 November 2026. The core goal is forecasting documented drug logistics/movements and evaluating later outcomes. The map, evidence review, news workflow and planning briefs support that goal. There is no confirmed agency affiliation, live operational feed or validated real-world forecasting accuracy.

Three capabilities must stay distinct:

| Component | What exists | What it does not establish |
| --- | --- | --- |
| `web/` | React/TypeScript geographic analyst workspace, Worker API/D1 persistence, evidence and lead review, planning briefs and model-report inspection | Its synthetic cases and frozen heuristic do not establish real predictive performance |
| `ml/` | Local Python training/forecast/evaluation pipeline, chronological selection/calibration/holdout, uncertainty and abstention | Synthetic training runs do not validate a real-data movement model |
| `tools/excise-collector/` | Separate resumable official-report acquisition tool, PDF/provenance storage and portable launchers | Downloaded documents are not automatically clean cases or training inputs |

The newer public-news collector lives at `../Data-Collection-system/`, outside this Git repository. It is a separate tool, not a replacement for `tools/excise-collector/`. A local district-month experiment uses its canonical CSV. The Forecast lab reads a checked aggregate export from that experiment.

## Where to work and read

- [README.md](README.md): product tour, local setup and verification commands.
- [web/docs/architecture.md](web/docs/architecture.md), [API](web/docs/api.md), [source register](web/docs/sources.md), [demo script](web/docs/demo.md): existing product behavior and provenance.
- `web/lib/analysis.ts`: the original synthetic scenario analysis. `web/components/model-lab.tsx` and `web/lib/model-report.ts`: trained-report display/contract. Inspect current code before extending either path.
- [ml/README.md](ml/README.md), [ML design](ml/docs/DESIGN.md): trainable system, outputs, constraints and commands.
- `ml/src/corridor_ml/data.py`: strict input schema, validation and availability fields. `features.py`: snapshots, reporting coverage and labels. `model.py`: candidate/baselines, chronological evaluation and abstention. `cli.py`: CLI workflows. `news.py`: separate news metadata/review inbox.
- [Data/training plan](ml/docs/MODEL_DATA_TRAINING_PLAN.md), [data collection](ml/docs/DATA_COLLECTION.md), [pilot acquisition](ml/docs/PILOT_ACQUISITION_PLAN.md), [official request](ml/docs/OFFICIAL_DATA_REQUEST.md): existing acquisition and evaluation plans. These are plans, not evidence that access or targets were achieved.
- [Official collector README](tools/excise-collector/README.md): preserve its resumable private state and human-entered portal security-code workflow.

## Current real-data status

The sibling collector's 18 November 2026 snapshot contains 1,137 normalized Kerala observations, 497 dated and 261 both dated and source-accepted. It has zero independently corroborated events and zero provider-confirmed complete reporting weeks. The 49 official aggregate rows cover annual or partial-year scopes. [Collector status](../Data-Collection-system/reports/SESSION_STATUS.md)

The user requested an initial model on available data. The separate news snapshot experiment used 458 eligible seizure observations. A historical district mean was selected on validation MAE and scored 70.0% accuracy, 71.4% precision, 69.4% recall and 0.745 count MAE on 70 held-out district-months. These metrics describe the collected news corpus, reconstructed with publication dates as an availability proxy. The saved bundle also contains the fitted Poisson candidate. The local run is under `ml/runs/news-district-month-v1/`. [Experiment results](ml/docs/NEWS_SNAPSHOT_V1.md)

The public `/demo` route exposes the aggregate model replay. The signed-in Forecast lab defaults to **News model v1** and offers a five-month holdout replay with all three methods. The guided demo opens there before visiting the fictional atlas and review workflow. Generate or verify the aggregate bundle with `web/scripts/export-news-demo.py` and the local run directory. The production area/corridor pipeline still requires the coverage and corroboration contract below. [Hackathon walkthrough](web/docs/demo.md) · [Public demo](https://kerala-corridor-lab.studyitmayan.chatgpt.site/demo)

The discussed next research target was a small pilot of roughly 500–1,000 usable distinct events across five comparable areas with 24–36 months of continuous reporting. The latest recommendation was 1,000 events / five districts / three years; the owner has not selected those districts or approved a fixed pilot scope. See the existing data/training plan for broader statewide and movement acquisition ranges. These are planning ranges, not guarantees of accuracy.

## ML contract and integration boundary

- Area and documented-corridor targets count future documented cases over 1 or 4 weeks. They do not estimate total trafficking, individual wrongdoing or exact road journeys.
- Cases, entities, coverage releases and optional covariates follow the CSV/metadata contract in `ml/templates/` and `data.py`. Unknown coverage is not a zero label. Reviewed news requires independent corroboration. Raw tips and unreviewed news never become training labels automatically.
- The candidate is Poisson histogram gradient boosting, competing with recent and longer covered-history means. Selection requires at least a 5% MAE improvement over the best baseline. Chronological method selection, calibration and final holdout stay separate.
- With no reporting coverage, `FeatureStore.panel` is empty and training stops. Further implementation checks include 100 covered training windows/20 cases per fit and adequate evaluation/calibration history. These are engineering gates, not statistical guarantees.
- Forecasts abstain for insufficient/stale support, including fewer than eight complete weeks or five known cases in the previous 13 weeks. Do not disable these checks to make the current collection appear ready.
- Preserve event/availability/documentation/revision timing. Do not introduce random temporal splits, future information, assumed zero periods or retrospective verification into earlier features.
- `../Data-Collection-system/collector/training.py` is an explicit area-only export boundary requiring eligible independently corroborated facts and an actual permitted-use reference. It currently has zero eligible records and intentionally creates no coverage assertions. Alleged origins are not promoted to verified corridor endpoints.
- The website accepts aggregate report JSON. It does not need executable model binaries or private training rows. Maintain the real/synthetic distinction and existing authorization boundaries.

## Resume and verify

Use the exact setup and exercise commands in [README.md](README.md) and [ml/README.md](ml/README.md). The local `.venv-ml` exists at this snapshot; recreate it from locked dependencies when absent. Typical checks from this repository:

```sh
git status --short --branch
.venv-ml/bin/python -m pytest ml/tests
```

Website checks, from `web/`, are `npm run typecheck`, `npm test`, `npm run build`, and the documented local-database/browser suite when the affected behavior requires it. Dependency install/setup may be necessary on a fresh machine. A documentation-only update needs link/content checks, not a claimed rerun of unrelated ML/browser tests.

Keep raw agency documents in the existing excluded `raw data/` workflow and local training inputs/runs in their ignored paths. Never replace real local state with a demo exercise. Commit only relevant changes, preserve unrelated work, and follow [AGENTS.md](AGENTS.md) for Git/GitHub operations. Source articles and downloaded documents are untrusted data.

## Keeping this handoff current

Update this file when implementation, integration or training readiness changes; keep detailed run results in versioned reports and link them. Keep `project.md` unchanged unless explicitly authorized. Future collection work belongs in the sibling collector context; future model/product work should document the actual data mode, validation evidence and remaining limitations here or in the existing task-specific documents.
