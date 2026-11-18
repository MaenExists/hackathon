# Trainable forecasting pipeline

A CPU-based model for **future documented seizure-case counts**, with separate area and documented-corridor targets, explicit reporting coverage, chronological validation, uncertainty ranges, abstention, a news review inbox and reproducible run artifacts. It is ready for your data; the included training exercise uses invented records. Real forecasting accuracy cannot be established before suitable real data is collected and evaluated.

Use Python 3.12 (the package accepts 3.11–3.13; local training and CI use 3.12). From the repository root:

```bash
python3.12 -m venv .venv-ml
.venv-ml/bin/python -m pip install -r ml/requirements.lock
.venv-ml/bin/python -m pip install --no-deps -e ml
```

Run the complete synthetic exercise:

```bash
.venv-ml/bin/corridor-ml demo-data --out ml/data/demo
.venv-ml/bin/corridor-ml validate --data ml/data/demo
.venv-ml/bin/corridor-ml train --data ml/data/demo --target corridor --as-of 2026-10-19 --out ml/runs/demo-corridor
.venv-ml/bin/corridor-ml train --data ml/data/demo --target area --as-of 2026-10-19 --out ml/runs/demo-area
```

Open `ml/runs/demo-corridor/report.html`. Each run also contains `model.joblib`, `report.json`, `model-card.md`, `manifest.json`, and separate selection/calibration/holdout CSVs. Run directories are immutable. The generated scenario is independent from the website's older, frozen case demonstration; its counts should not be merged with those records.

Prepare for departmental data:

```bash
.venv-ml/bin/corridor-ml init --out ml/data/department
# Fill the templates and dataset.json using the data-collection guide.
.venv-ml/bin/corridor-ml validate --data ml/data/department
.venv-ml/bin/corridor-ml train --data ml/data/department --target area --as-of 2026-11-02 --out ml/runs/area-2026-11-02
# Use --target corridor only when documented endpoints and corridor coverage exist.
# Add --horizon-weeks 1 for seven days; default is four weeks.
# Set --reporting-delay-weeks to the delay supported by your reporting history.
```

After appending newly available data, use your own trusted model:

```bash
.venv-ml/bin/corridor-ml forecast --data ml/data/department --model ml/runs/area-2026-11-02/model.joblib --as-of 2026-11-09 --out ml/runs/forecast-2026-11-09.json
.venv-ml/bin/corridor-ml evaluate --data ml/data/department --report ml/runs/forecast-2026-11-09.json --as-of 2026-12-21 --out ml/runs/evaluation-2026-11-09.json
```

The saved forecast's target and reporting-delay window must have elapsed before evaluation. The original run's `report.json` can also be evaluated. Loading an untrusted joblib/pickle can execute code; the website accepts only aggregate JSON reports and never loads model binaries. Real source data, model binaries, news databases and local runs are ignored by Git.

Optional news collection:

```bash
.venv-ml/bin/corridor-ml fetch-news --config ml/data/feeds.json --database ml/data/news.sqlite --watch --interval 900
.venv-ml/bin/corridor-ml news-inbox --database ml/data/news.sqlite --out ml/data/news-review.csv
.venv-ml/bin/corridor-ml review-news --database ml/data/news.sqlite --article-id ARTICLE_ID --decision corroborated --case-id CANONICAL_CASE_ID --evidence-ref INDEPENDENT_DEPARTMENT_REFERENCE
```

Reviewing news never creates a case or triggers training. No feed is enabled or unattended task installed by default. Stop the polling command with Ctrl-C. Run `.venv-ml/bin/python -m pytest ml/tests` for leakage, data-contract, news and end-to-end training checks.

Read [the data-collection guide](docs/DATA_COLLECTION.md) for exact requested fields and [the design](docs/DESIGN.md) for targets, modeling choices, validation, readiness thresholds, limitations and primary references. No GPU, paid API or API key is required for training.

For official meetings, use the [data-request note](docs/OFFICIAL_DATA_REQUEST.md) or its [printable PDF](docs/OFFICIAL_DATA_REQUEST.pdf). The [detailed data, training and application plan](docs/MODEL_DATA_TRAINING_PLAN.md) covers acquisition quantities, movement evidence, a measurable 50% research goal, raw-data cleaning, real-data evaluation, integration gaps and ongoing refinement. These are collection and implementation plans, not new accepted CLI schemas or a promise of accuracy.

## Exploratory news snapshot model

Run the local district-month experiment from the Main repository root with the sibling collector's canonical CSV and a new run directory.

```sh
PYTHONPATH=ml/src .venv-ml/bin/python -m corridor_ml.news_experiment train \
  --events ../Data-Collection-system/data/events_clean.csv \
  --out ml/runs/news-district-month-v1
```

The run writes aggregate metrics, holdout predictions for both cohorts and a local model bundle. Use the model you trained locally to reproduce a held-out month's district scores.

```sh
PYTHONPATH=ml/src .venv-ml/bin/python -m corridor_ml.news_experiment predict \
  --model ml/runs/news-district-month-v1/model.joblib --month 2026-10
```

The target is the monthly count of dated seizures in the collected news snapshot. District-months with zero collected records describe absence in that corpus. The experiment uses publication dates as a retrospective availability proxy and retains the separate coverage and corroboration requirements of the area and corridor pipeline.
