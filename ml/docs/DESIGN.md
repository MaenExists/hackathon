# Forecasting design and acceptance criteria

This implements the experiment described in `project.md`; it does not change that document or imply an agency arrangement. The Python training system is separate from the Cloudflare website. Real source records and executable model files stay local, in ignored directories. Only a deliberately synthetic aggregate demonstration report is committed to the website.

## What the model learns

Two separately trained targets share the same pipeline:

1. **Area:** the number of documented seizure cases in an area over the next 7 or 28 days. This works when only seizure locations are known.
2. **Corridor:** the number of documented cases involving an already established directed origin/destination connection over the next 7 or 28 days. Both endpoints must come from evidence. Transport modes can distinguish connections; an Unknown-mode connection includes documented movements with any mode.

The target is a count of **cases**, not people, consumption, seized kilograms, all drug traffic, a probability of wrongdoing, or a reconstructed road itinerary. Quantities are historical explanatory features, kept separate by substance and mass/tablet unit. A case with several substances needs one canonical primary classification for this first version; retain its detailed substance table in the source system. This avoids counting a multi-substance case as several independent seizures. The tool rejects duplicate canonical case IDs rather than guessing whether reports are independent.

The first version forecasts all accepted substance categories together, using historical substance-specific counts and quantities as features. It does not yet issue substance-specific targets. It does not discover unknown corridors or infer routes from nearby roads. A transport network is context, not evidence of a shipment.

## Why this model

The candidate is scikit-learn histogram gradient boosting with Poisson loss: a practical count-regression model for lagged tabular features, nonlinear changes and missing values. It runs on a normal CPU and needs no GPU, paid API, neural network or LLM. The fixed configuration avoids a large, misleading hyperparameter search on small datasets. The implementation disables randomized internal early stopping and uses deterministic seeds.

Two independent baselines compete with it: mean weekly counts from covered weeks in the previous 13 weeks, and the covered-week mean over the previous 4 weeks, each scaled to the forecast horizon. The candidate must improve selection MAE by at least 5% versus the best baseline to become the selected method. A trained gradient booster is saved for inspection even when a baseline wins. The final untouched holdout reports all three methods; losing there produces a visible review alert. Synthetic data is not evidence that this approach will generalize.

## Information available at prediction time

Cases retain separate event, first-availability, documentation and optional withdrawal dates. A historical snapshot includes only events before its origin, made available and documented by that origin, and not yet withdrawn. Later documentation cannot leak into earlier features. A later withdrawal is applied from its recorded date; it does not retroactively erase what an analyst knew before the withdrawal.

Coverage releases state whether an entity/week has complete reporting **within the declared reporting universe**. Revisions have their own availability date. Missing/incomplete weeks are NaN, never false zeros. A target label is usable only when all target weeks have complete releases by the label-maturity cutoff. Completeness does not mean all trafficking was observed.

Covariates retain measurement start/end and release dates. Only measurements ending and released by the origin are eligible. The newest available revision is used; measurements older than 91 days become missing with an age flag. Future realized transport, rainfall or consumption measurements are never used. Only an authorized aggregate consumption percentage with a denominator of at least 30 is accepted; this engineering threshold is not an anonymity guarantee. Names, IDs, individual consumers, patient records and demographic suspicion proxies have no input column.

Features cover 1/2/4/8/13/26-week lags, covered-week rolling means and trends, observed substance counts, log mass/tablet quantities, calendar seasonality, documented incoming/outgoing connections, entity/mode context, reporting coverage, and available aggregate enforcement/transport/consumption/service/weather measurements. Network features are observations, not a claim of coverage-adjusted flow. No raw news count, tip volume, or place-search activity is a model feature.

## Evaluation that can fail honestly

Training examples are created weekly. For every example, a 7/28-day future window is followed by a configurable reporting/verification delay (default 14 days). Its label uses only information available by that fixed maturity date. The target therefore includes reporting delay as part of its definition; records arriving even later are not silently backfilled into a historical label. Choose the delay from actual agency reporting-delay distributions before relying on results.

The last eleven evaluation origins are spaced by horizon **plus reporting delay**. Three earlier origins select the method; four later origins calibrate its error range; four final origins form the untouched holdout. This spacing gives disjoint target windows and ensures all labels used for selection/calibration have matured before the next stage starts. Every fitted fold purges training examples whose labels mature after its prediction origin. There is no shuffled split.

The default 28-day setup needs about two years of reliable weekly reporting for training plus evaluation, preferably three. It requires at least 100 training entity-windows, 20 cases across training labels, and 20 calibration entity-windows. With four calibration origins, at least five covered entities are needed. These are engineering readiness checks, not a statistical guarantee of sufficiency. Fewer entities require a redesigned calibration schedule, not turning off the check. A 7-day target shortens the historical requirement but can be much sparser.

MAE is the primary selection metric. Reports also contain RMSE, Poisson deviance, WAPE when the denominator is nonzero, top-three capture of documented holdout cases, and per-entity error/interval coverage. Percentage error per row is avoided because zero counts are valid. Errors across areas are a coverage diagnostic, not a fairness certificate. A more aggressive observation regime can change counts without changing underlying traffic.

The empirical interval uses earlier absolute residuals scaled by `sqrt(prediction + 1)` and a finite-sample 90th-percentile correction. The final holdout measures actual coverage and width. Serial dependence, reporting changes and distribution shifts mean nominal 90% coverage is **not guaranteed**. These are prediction ranges for counts, not confidence scores for an alleged route. Feature permutation diagnostics report predictive sensitivity, not causes.

After evaluation, one final model is refit on all mature past examples for inference. Its future forecasts are not the held-out predictions. Input/model/report hashes, software versions, configuration, selection/calibration/holdout CSVs, a model card and a manifest accompany each immutable run.

## Refusal and monitoring behavior

An entity forecast abstains if it was not in the model's known registry, has fewer than eight complete reporting weeks or five known documented cases in the previous thirteen weeks, or the model is older than thirteen weeks. An insufficient training/calibration panel stops with an actionable error. Missing measurements remain explicit; a model is not retrained silently.

After the target and reporting-delay window elapse, `evaluate` joins the saved forecasts to mature labels, reports errors and interval coverage, and lists unscorable entities. It cannot manufacture labels for missing coverage. Compare each new period with both the baseline and previous reports; inspect reporting changes before retraining. Version every new run rather than overwriting an old one. Independent agency-led validation, stronger membership roles, deployment/privacy review and a prospective shadow trial are separate prerequisites for operational use.

## News is a review workflow

The RSS/Atom collector supports explicit public HTTPS feeds, conditional ETag/Last-Modified requests, bounded response sizes, periodic polling, an idempotent SQLite inbox and an append-only review log. It stores article metadata and links, not full articles. First-seen time is independent of publisher date. URL tracking parameters are removed; matching-title groups flag possible repetition without treating it as corroboration.

No feed is pre-enabled, no publisher paywall is bypassed, and no background task is installed. Configure permitted feeds and run the polling command when ready. Corroboration needs a canonical case ID and independent evidence reference. Even an accepted article does not auto-create a case: merge the verified canonical case into the structured event dataset, preserve actual dates, and validate before retraining. Correcting/rejecting an earlier article stays in the review log. An LLM extractor could be added later behind the same review gate; it is not needed to run this system.

## Acceptance checks

- Duplicate case reports cannot inflate labels; unknown endpoints cannot become corridors.
- Future cases, reviews, withdrawals, measurements and coverage releases cannot leak into historical snapshots.
- Missing coverage differs from a covered week with zero documented cases.
- Selection/calibration maturity precedes final holdout prediction origins.
- Train/serialize/reload/forecast succeeds reproducibly; stale and unsupported entities abstain.
- RSS and Atom ingestion is idempotent, rejects XML entity expansion and requires review provenance.
- Real and synthetic datasets/models cannot be mixed.
- The website reads aggregate JSON reports locally; it never loads executable model files or uploads a selected real report.

## Primary references

- [scikit-learn lagged time-series features](https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html): time ordering, count loss and uncertainty evaluation.
- [HistGradientBoostingRegressor API](https://scikit-learn.org/1.7/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html): Poisson objective and missing-value behavior. The package pins scikit-learn 1.7.2 for reproducibility.
- [Forecasting: Principles and Practice, forecaster's toolbox](https://otexts.com/fpp3/toolbox.html): baselines, forecast accuracy and rolling-origin evaluation.
- [UNODC individual seizure guidelines](https://syntheticdrugs.unodc.org/uploads/syntheticdrugs/res/library/ait_html/UNODC_Guidelines_for_Individual_Drug_Seizures.pdf): event provenance, seizure and movement fields are distinct.
- [UNODC World Drug Report methodology](https://www.unodc.org/documents/data-and-analysis/WDR_2025/Annex/WDR2025_Methodological_Annex.pdf): interpretation and coverage limitations of seizure indicators.
- [scikit-learn model persistence](https://scikit-learn.org/stable/model_persistence.html): executable serialized models are local trusted artifacts, never uploaded or loaded from an unknown source.
- [defusedxml](https://github.com/tiran/defusedxml): defensive parsing of external XML feeds.

Research checked 1 November 2026. Implementation choices, readiness thresholds and the evaluation schedule are this project's explicit engineering decisions, not claims prescribed by these references.
