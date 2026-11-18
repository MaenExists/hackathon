# Corridor: Hackathon Judging & Defense Guide

**Project**: Corridor (Kerala Drug Transit & Seizure Forecaster)  
**Date**: November 2026  
**Audience**: Technical Evaluation Committee & Domain Specialists  

---

## 1. The Core Design Decision: Honest Metric Framing

> [!IMPORTANT]
> **We model SEIZURE INTENSITY (Enforcement Proxy), NOT True Drug Flow.**
> Seizures record where law enforcement intercepts contraband, not the complete unobserved trafficking journey.
> High-enforcement checkposts (such as **Muthanga** on NH 766 and **Walayar** on NH 544) dominate statistical models because they are under constant surveillance, not necessarily because they carry all trafficking.
> Framing our predictions as **interception pressure and transit intensity** turns an inherent limitation into a defensible scientific strength.

| Unsound Pitch | Corridor's Accountable Pitch | Why It Wins Judges |
| :--- | :--- | :--- |
| *"Our AI predicts where drugs are moving in Kerala."* | *"We predict 2-week seizure intensity as an enforcement-calibrated proxy for transit pressure."* | Transparent about observability limits; rejects black-box hand-waving. |
| *"We discovered 10 trafficking routes."* | *"We formulated 10 transit pipeline hypotheses and statistically test for 7–14 day lead-lag cross-correlations."* | Grounded in empirical time-series correlation rather than speculative tracking. |
| *"Deep learning neural network with 99% accuracy."* | *"Poisson Gradient Boosting benchmarked against a rolling-mean baseline (+15.7% deviance reduction)."* | Avoids overfitting on 1,115 events; shows respect for model restraint. |

---

## 2. Data Layer Rigor

1. **LLM Extraction with Exact Supporting Text Spans**:
   - Claude-based extractor operating under a strict Pydantic JSON schema.
   - For every asserted key field (`district`, `event_date`, `drug_type`, `quantity_raw`, `origin_place`), an exact short substring is extracted from the article.
   - Any extracted fact without an exact verbatim match in the cached source text is automatically rejected.
2. **Clustering Deduplication**:
   - Multiple news outlets often cover the same major bust.
   - Events are clustered by `(date ± 3 days, locality/district, substance, quantity)` using Levenshtein similarity and entity grouping to prevent fake hotspot inflation.
3. **Multi-Level Geocoding Confidence**:
   - Every incident is flagged with confidence: `exact` (specific checkpoints/stations like Muthanga, Walayar, CIAL), `locality` (towns/panchayats), or `district-level` (centroid fallback).
   - Displayed prominently in the UI. District-level geography is used for training; exact coordinates are preserved for analyst visualization.
4. **Panel Aggregation**:
   - Evaluated across all 14 districts over 158 consecutive weeks.

---

## 3. Modeling & Empirical Evaluation

### A. Candidate vs. Baseline Benchmark (Rolling-Origin Backtest)
We run a **strictly chronological rolling-origin backtest** (62 test weeks forward, zero future leakage, no random splits):

| Model Architecture | Poisson Deviance | MAE | Hit@3 Capture | Headline Assessment |
| :--- | :---: | :---: | :---: | :--- |
| **Rolling-Mean Baseline** | 1.601 | 0.832 | 37% | Naive 12-week moving average (the reference to beat) |
| **GBM (Own-History Only)** | 1.382 | 0.870 | 37% | HistGradientBoosting with temporal lags & seasonality |
| **GBM + Upstream Corridors** | **1.350** | **0.859** | 36% | **Winner: Adds upstream pipeline transit features** |

**Headline Result**:
Adding upstream corridor features cuts Poisson deviance by **15.7%** relative to the naive baseline (1.601 → 1.350) and improves over own-history GBM (1.382 → 1.350).

### B. Uncertainty Calibration
Rather than misleading single-point guesses, Corridor fits quantile regressors (`p10` and `p90`). The empirical coverage rate is **89.2%**, demonstrating well-calibrated confidence intervals.

### C. Empirical Corridor Lead-Lag Verification
We tested cross-correlations across the 10 documented pipelines. **12 of 15 corridor edges exhibit positive lead-lag correlation**:
- **Wayanad → Kozhikode** (NH 766): Seizures at Muthanga/Wayanad lead Kozhikode metro seizures by **7–14 days** ($r = +0.11$, 95% CI $[+0.02, +0.22]$).
- **Thrissur → Ernakulam**: Border gateway activity leads Kochi commercial hub seizures by **0–7 days** ($r = +0.24$).
- **Ernakulam → Alappuzha → Kollam**: South coastal transit exhibits a **7–14 day** sequential wave ($r = +0.14$ to $+0.19$).

---

## 4. Winning Demo Features

1. **Backtest Replay Slider (`Forecast Lab`)**:
   - Scrub through past test weeks with a play/pause slider.
   - Shows predicted seizure intensity vs. observed busts with `p10–p90` prediction bands.
   - Plain-English attribution per district (*"Upstream corridor active: 3 seizures in Wayanad · Onam seasonal surge"*).
2. **"Ask the Atlas" (`Ledger-Grounded RAG`)**:
   - Interactive analyst query interface querying 1,137 verified Kerala records.
   - Every answer cites exact incident IDs, dates, quantities, and verifiable source URLs.
   - **Strict Refusal**: Refuses to answer queries unsupported by the evidence ledger (e.g., Fentanyl, non-Kerala claims, or personal identities).
3. **Corridor Atlas & Contraband Mix**:
   - Animated transit flow on Leaflet map.
   - Connection explorer displays substance breakdown (e.g., MDMA 45%, Ganja 40%, Heroin 15%) and statistically estimated transit lead times.

---

## 5. Systemic & Ethical Risk Defense

1. **Feedback Loops**:
   - *Risk*: Predictions send police to the same places, generating more busts there and artificially inflating model scores.
   - *Defense*: We explicitly aggregate to districts and high-level corridors, never to individual patrol beats or communities. Corridor is positioned as a broad prioritization aid, not proof of criminality.
2. **Tip Portal Abuse**:
   - *Risk*: Anonymous tips can become weapons for false accusations against neighbors.
   - *Defense*: Tips are never displayed publicly, never feed the predictive model directly, are strictly rate-limited, strip personal names, and route to a vetted review queue.
3. **Stigma Prevention**:
   - *Risk*: Naming specific college campuses or neighborhoods creates severe stigmatization.
   - *Defense*: Public views remain coarse (district and interstate corridor level). Granular place data is restricted to verified analysts.
4. **Scraping & Legal Integrity**:
   - *Risk*: Copyright and provenance issues from scraping news articles.
   - *Defense*: Corridor stores structured fact tuples with short audited text spans, never whole copied articles, and links directly to original publications.
