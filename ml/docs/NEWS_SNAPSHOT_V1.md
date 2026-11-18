# Kerala news snapshot model v1

Evaluated on 18 November 2026 using the collector's 1,137-observation snapshot. The model predicts monthly counts of dated seizures in the collected corpus across Kerala's 14 districts. Its binary scores measure whether a district-month contains at least one collected seizure observation.

## Results

The long-history district average had the lowest January–May 2026 validation count error and was selected before scoring the June–October 2026 holdout. The holdout covers 70 district-months over five months. It contains 67 observations across 36 positive district-months.

| Method | Validation MAE | Test MAE | Test RMSE | Accuracy | Precision | Recall | F1 | Average precision | Brier score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| District history mean, selected v1 | 0.790 | 0.745 | 0.955 | 70.0% | 71.4% | 69.4% | 70.4% | 79.9% | 0.195 |
| District recent three-month mean | 0.910 | 0.719 | 1.015 | 64.3% | 86.7% | 36.1% | 51.0% | 74.5% | 0.252 |
| Regularized Poisson with district, season and trend | 1.125 | 0.806 | 0.990 | 64.3% | 61.7% | 80.6% | 69.9% | 79.8% | 0.211 |

MAE is mean absolute count error per district-month. At the fixed 50% threshold for at least one report, v1 flagged 35 district-months. It correctly flagged 25, falsely flagged 10, missed 11 and correctly left 24 unflagged. Always predicting at least one report yields 51.4% accuracy. The top three districts captured 33 of 67 observations, or 49.3%. All three methods achieved the same top-three capture, which leaves the benefit of temporal modeling unproven. The recent mean had slightly lower holdout MAE and substantially lower recall. Holdout numbers were kept out of model selection.

Repeating the experiment on the 245 eligible source-accepted observations again selected the district history mean. Its holdout contained 37 observations. That run scored 77.1% accuracy, 73.3% precision, 47.8% recall, 57.9% F1 and 0.573 count MAE. This smaller cohort has a different base rate and labels. Always predicting no collected reports scores 67.1% accuracy there.

## Data and test design

- The canonical CSV supplied 1,137 rows. Filtering removed 640 undated observations, 14 observations in the partial edge months, 15 dated observations in other classifications, and 10 seizures with conflicting dates or districts. The primary cohort has 458 seizure observations and includes pending source reviews.
- The first fit used 337 observations dated December 2023–December 2025. Validation used January–May 2026. The test fit used 390 observations dated through May 2026. Fits exclude events published at or after the cutoff and those without a publication date. The June–October holdout uses the fixed snapshot's later observations.
- Each five-month block uses predictions from a single frozen fit. The Poisson candidate uses district, a calendar cycle and a time trend. For each count estimate, the experiment uses the Poisson probability of at least one report and flags at 50%. These probabilities carry no separate calibration guarantee.
- A zero means the snapshot contains zero eligible observations for that district-month. It gives no estimate of unreported cases. Most data first entered the pipeline in November 2026. Publication date is only a retrospective availability proxy. Later extraction, correction, deduplication and review can influence the reconstructed records.
- Five holdout months give limited evidence, and the same districts recur across months. Scores describe this archive. Forecasting actual seizure totals or drug movements requires prospective reporting data, independent validation and the existing product coverage contract.

## Reproduce

Use the [ML README](../README.md) commands with the same canonical CSV. The local model bundle retains all three fitted methods. Its default method is the long-history district average, and the prediction command reproduces one of the evaluated months. The run also contains aggregate holdout predictions for both cohorts, metrics, and input and model checksums. Repeated runs reproduced the four artifacts byte for byte, and the prediction command matched the October holdout CSV.
