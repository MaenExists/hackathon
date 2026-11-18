# Retrospective news model evaluation v2

Updated 18 November 2026. This document evaluates the enhanced chronological seizure forecasting pipeline (**news-district-month-v2**) on the complete collected Kerala seizure corpus (1,115 usable seizure events across all 14 Kerala districts) and official police baseline metrics.

## Key evaluation summary

- **Champion model selected on validation MAE:** `hist_gradient_boosting` (Poisson deviance loss with temporal lag and official baseline features).
- **Validation selection (Jan–May 2026, 70 district-months):**
  - `hist_gradient_boosting`: **1.287 MAE** (selected vs. `district_history` 1.382, `district_recent_3m` 1.400, and `poisson_linear` 1.670).
- **Held-out test performance (Jun–Oct 2026, 70 district-months):**
  - **MAE:** **1.145** (lowest error of all models; lower than historical mean 1.172 and 3-month mean 1.257).
  - **Accuracy:** **77.1%**
  - **Precision:** **81.7%**
  - **Recall:** **90.7%**
  - **F1 score:** **0.860**
  - **Top-3 district capture rate:** **44.4%** of all seizures statewide captured in the top 3 flagged districts.

## Candidate comparison on holdout test block (June–October 2026)

| Method | Validation MAE | Holdout MAE | Holdout Accuracy | Holdout Precision | Holdout Recall | Holdout F1 | Top-3 Capture |
|---|---|---|---|---|---|---|---|
| **`hist_gradient_boosting` (Selected)** | **1.287** | **1.145** | **77.1%** | **81.7%** | **90.7%** | **0.860** | **44.4%** |
| `district_history` | 1.382 | 1.172 | 75.7% | 78.5% | 94.4% | 0.857 | 47.2% |
| `district_recent_3m` | 1.400 | 1.257 | 61.4% | 80.0% | 66.7% | 0.727 | 45.1% |
| `poisson_linear` | 1.670 | 1.193 | 77.1% | 77.1% | 100.0% | 0.871 | 45.8% |

## Methodology and accountability safeguards

1. **Strict Chronological Splits**: No random splitting or future information leakage.
   - Training block: December 2023 through December 2025.
   - Validation block: January 2026 through May 2026 (70 district-months).
   - Test holdout block: June 2026 through October 2026 (70 district-months).
2. **Feature Engineering**:
   - Lagged district seizure counts ($t-1, t-2, t-3$).
   - Lagged substance counts (Synthetic/MDMA vs. Cannabis/Ganja).
   - Official police NDPS registered case baselines from `official_stats.csv`.
   - Seasonality (sin/cos harmonic calendar cycles) and long-term secular trend.
3. **Artifact Integrity**:
   - Input SHA256: `4b5937593b1af14fc9a67df9a0720b3b8ae0a2040cda73dace90e54c1ff2fae5`
   - Fitted Model SHA256: `1df9a6a9453d2d46b634990e580156c3f94ded60823dedad264d4b7b11f3e399`
   - Scikit-Learn version: `1.7.2`
