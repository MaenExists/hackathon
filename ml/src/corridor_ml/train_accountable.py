"""Accountable chronological training and evaluation pipeline for Kerala drug seizure & corridor forecasting."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import PoissonRegressor
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    mean_absolute_error,
    mean_poisson_deviance,
    mean_squared_error,
)

VERSION = "news-district-month-v2"
FIRST_MONTH = "2023-12"
VALIDATION_START = "2026-01"
TEST_START = "2026-06"
TEST_END = "2026-10"
POSITIVE_THRESHOLD = 0.5
TOP_K = 3

DISTRICTS = (
    "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam",
    "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta",
    "Thiruvananthapuram", "Thrissur", "Wayanad",
)

CORRIDORS = [f"c{i:02d}" for i in range(1, 11)]


def assign_corridor(row) -> str | None:
    orig = str(row["origin_place"]).lower() if pd.notna(row["origin_place"]) else ""
    orig_st = str(row["origin_state"]).lower() if pd.notna(row["origin_state"]) else ""
    dist = str(row["district"]).lower() if pd.notna(row["district"]) else ""
    place = str(row["place"]).lower() if pd.notna(row["place"]) else ""
    mode = str(row["transport_mode"]).lower() if pd.notna(row["transport_mode"]) else ""
    drug = str(row["drug_type"]).lower() if pd.notna(row["drug_type"]) else ""

    if mode == "air" or any(k in place for k in ["airport", "nedumbassery", "cial", "karipur"]) or any(k in orig for k in ["bangkok", "thailand", "oman", "ethiopia"]):
        return "c05"
    if any(k in orig for k in ["bengaluru", "bangalore", "karnataka", "mysuru", "mysore"]):
        if dist in ["wayanad", "kozhikode", "malappuram", "kannur"] or any(k in place for k in ["muthanga", "bavali"]):
            return "c01"
        elif dist == "kasaragod":
            return "c03"
        else:
            return "c02"
    if any(k in orig for k in ["dakshina", "mangalore", "mangaluru", "goa"]) or "thalappady" in place or dist == "kasaragod":
        return "c03"
    if any(k in orig for k in ["odisha", "andhra", "visakhapatnam"]) or any(k in orig_st for k in ["odisha", "andhra"]):
        return "c04"
    if any(k in orig for k in ["delhi", "assam", "bengal", "kolkata"]):
        return "c10"
    if any(k in orig for k in ["madurai", "theni"]) or "kumily" in place or dist == "idukki":
        return "c06"
    if any(k in orig for k in ["shenkottai", "tenkasi", "tirunelveli"]) or "aryankavu" in place:
        return "c09"
    if any(k in place for k in ["muthanga", "bavali", "sulthan bathery"]) or dist == "wayanad":
        return "c01"
    if "walayar" in place or dist == "palakkad":
        return "c04" if "ganja" in drug else "c02"
    if dist in ["thiruvananthapuram", "kollam", "alappuzha"] and mode in ["train", "bus"]:
        return "c07"
    if dist in ["kozhikode", "malappuram", "thrissur"] and "mdma" in drug:
        return "c08"
    if dist == "ernakulam" and "mdma" in drug:
        return "c02"
    if dist == "ernakulam" and "ganja" in drug:
        return "c04"
    return None


def build_district_panel(events: pd.DataFrame, official_stats_path: Path | None = None) -> pd.DataFrame:
    months = pd.period_range(FIRST_MONTH, TEST_END, freq="M")
    grid = pd.MultiIndex.from_product([months, DISTRICTS], names=["month", "district"])
    frame = grid.to_frame(index=False)

    counts = events.groupby(["month", "district"]).size()
    frame["actual"] = counts.reindex(grid, fill_value=0).to_numpy()

    # Substance category counts
    syn_counts = events[events["is_synthetic"]].groupby(["month", "district"]).size()
    can_counts = events[events["is_cannabis"]].groupby(["month", "district"]).size()
    frame["actual_synthetic"] = syn_counts.reindex(grid, fill_value=0).to_numpy()
    frame["actual_cannabis"] = can_counts.reindex(grid, fill_value=0).to_numpy()

    # Official baseline
    if official_stats_path and official_stats_path.exists():
        df_off = pd.read_csv(official_stats_path)
        off_map = df_off[df_off["district"].notna()].groupby("district")["value"].mean().to_dict()
        frame["official_baseline"] = frame["district"].map(off_map).fillna(500.0)
    else:
        frame["official_baseline"] = 500.0

    frame = frame.sort_values(["month", "district"]).reset_index(drop=True)

    # Lags (strictly backwards in time)
    for lag in [1, 2, 3]:
        frame[f"lag_{lag}"] = frame.groupby("district")["actual"].shift(lag).fillna(0)
        frame[f"lag_syn_{lag}"] = frame.groupby("district")["actual_synthetic"].shift(lag).fillna(0)
        frame[f"lag_can_{lag}"] = frame.groupby("district")["actual_cannabis"].shift(lag).fillna(0)

    frame["recent_3m"] = (frame["lag_1"] + frame["lag_2"] + frame["lag_3"]) / 3.0
    frame["history_mean"] = frame.groupby("district")["actual"].transform(
        lambda s: s.shift(1).expanding(min_periods=1).mean()
    ).fillna(0)

    m_num = frame["month"].dt.month
    frame["month_sin"] = np.sin(2 * np.pi * (m_num - 1) / 12)
    frame["month_cos"] = np.cos(2 * np.pi * (m_num - 1) / 12)
    frame["year_offset"] = ((frame["month"].dt.year - 2023) * 12 + m_num - 12) / 12

    return frame


def evaluate_predictions(actual: np.ndarray, predicted: np.ndarray, frame: pd.DataFrame) -> dict:
    predicted = np.maximum(0, predicted)
    mae = mean_absolute_error(actual, predicted)
    rmse = np.sqrt(mean_squared_error(actual, predicted))
    p_dev = mean_poisson_deviance(actual, np.maximum(predicted, 1e-8))

    observed = actual > 0
    probability = -np.expm1(-predicted)
    flagged = probability >= POSITIVE_THRESHOLD

    tn, fp, fn, tp = (int(n) for n in confusion_matrix(observed, flagged, labels=[False, True]).ravel())
    acc = float((tp + tn) / len(actual)) if len(actual) else 0.0
    prec = float(tp / (tp + fp)) if (tp + fp) else 0.0
    rec = float(tp / (tp + fn)) if (tp + fn) else 0.0
    f1 = float(2 * tp / (2 * tp + fp + fn)) if (2 * tp + fp + fn) else 0.0

    ranked = frame.assign(predicted=predicted).sort_values(
        ["month", "predicted", "district"], ascending=[True, False, True]
    )
    top = ranked.groupby("month", sort=False).head(TOP_K)
    top_3_ev = int(top["actual"].sum())
    total_ev = int(actual.sum())

    return {
        "mae": round(float(mae), 5),
        "rmse": round(float(rmse), 5),
        "poisson_deviance": round(float(p_dev), 5),
        "accuracy": round(acc, 5),
        "precision": round(prec, 5),
        "recall": round(rec, 5),
        "f1": round(f1, 5),
        "brier_score": round(float(brier_score_loss(observed, probability)), 5),
        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
        "events": total_ev,
        "top_3_events": top_3_ev,
        "top_3_capture": round(float(top_3_ev / total_ev), 4) if total_ev else 0.0,
    }


def train_and_evaluate(events_csv: Path, official_csv: Path, out_dir: Path) -> dict:
    df_raw = pd.read_csv(events_csv)
    df_raw["effective_date"] = pd.to_datetime(df_raw["event_date"].fillna(df_raw["publish_date"]), errors="coerce")

    # Filter to valid Kerala seizures
    valid = (
        df_raw["effective_date"].notna()
        & df_raw["district"].isin(DISTRICTS)
        & df_raw["classification"].eq("seizure")
        & df_raw["review_status"].ne("rejected")
    )
    events = df_raw[valid].copy()
    events["month"] = events["effective_date"].dt.to_period("M")
    events["is_synthetic"] = events["drug_type"].isin(["mdma", "methamphetamine", "lsd"])
    events["is_cannabis"] = events["drug_type"].isin(["ganja", "hashish_oil"])
    events["corridor"] = events.apply(assign_corridor, axis=1)

    panel = build_district_panel(events, official_csv)

    feature_cols = [
        "history_mean", "recent_3m", "lag_1", "lag_syn_1", "lag_can_1",
        "lag_2", "lag_3", "official_baseline", "month_sin", "month_cos", "year_offset"
    ]

    val_start_p = pd.Period(VALIDATION_START, freq="M")
    test_start_p = pd.Period(TEST_START, freq="M")
    test_end_p = pd.Period(TEST_END, freq="M")

    # Chronological slices
    train_mask = panel["month"] < val_start_p
    val_mask = panel["month"].between(val_start_p, test_start_p - 1)
    trainval_mask = panel["month"] < test_start_p
    test_mask = panel["month"].between(test_start_p, test_end_p)

    train_df = panel[train_mask]
    val_df = panel[val_mask]
    trainval_df = panel[trainval_mask]
    test_df = panel[test_mask]

    # Models:
    # 1. District History
    val_pred_hist = val_df["history_mean"].to_numpy()

    # 2. Recent 3m
    val_pred_rec = val_df["recent_3m"].to_numpy()

    # 3. Poisson GLM with scaled features
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    poi = make_pipeline(StandardScaler(), PoissonRegressor(alpha=1.0, max_iter=1000))
    poi.fit(train_df[feature_cols], train_df["actual"])
    val_pred_poi = poi.predict(val_df[feature_cols])

    # 4. HistGradientBoosting Poisson
    hgb = HistGradientBoostingRegressor(
        loss="poisson",
        max_iter=60,
        learning_rate=0.05,
        min_samples_leaf=10,
        l2_regularization=2.0,
        random_state=42,
    )
    hgb.fit(train_df[feature_cols], train_df["actual"])
    val_pred_hgb = hgb.predict(val_df[feature_cols])

    val_actual = val_df["actual"].to_numpy()
    val_scores = {
        "district_history": evaluate_predictions(val_actual, val_pred_hist, val_df),
        "district_recent_3m": evaluate_predictions(val_actual, val_pred_rec, val_df),
        "poisson_linear": evaluate_predictions(val_actual, val_pred_poi, val_df),
        "hist_gradient_boosting": evaluate_predictions(val_actual, val_pred_hgb, val_df),
    }

    # Model selection on validation MAE
    selected_method = min(val_scores.keys(), key=lambda k: val_scores[k]["mae"])

    # Refit on train+validation (all data prior to test block)
    poi.fit(trainval_df[feature_cols], trainval_df["actual"])
    hgb.fit(trainval_df[feature_cols], trainval_df["actual"])

    test_pred_hist = test_df["history_mean"].to_numpy()
    test_pred_rec = test_df["recent_3m"].to_numpy()
    test_pred_poi = poi.predict(test_df[feature_cols])
    test_pred_hgb = hgb.predict(test_df[feature_cols])

    test_actual = test_df["actual"].to_numpy()
    test_scores = {
        "district_history": evaluate_predictions(test_actual, test_pred_hist, test_df),
        "district_recent_3m": evaluate_predictions(test_actual, test_pred_rec, test_df),
        "poisson_linear": evaluate_predictions(test_actual, test_pred_poi, test_df),
        "hist_gradient_boosting": evaluate_predictions(test_actual, test_pred_hgb, test_df),
    }

    # Save output artifacts
    out_dir.mkdir(parents=True, exist_ok=True)

    holdout_out = test_df[["month", "district", "actual"]].copy()
    holdout_out = holdout_out.rename(columns={"actual": "actual_collected_count"})
    holdout_out["district_history_count"] = test_pred_hist
    holdout_out["district_recent_3m_count"] = test_pred_rec
    holdout_out["poisson_linear_count"] = test_pred_poi
    holdout_out["hist_gradient_boosting_count"] = test_pred_hgb
    holdout_out.to_csv(out_dir / "holdout_predictions.csv", index=False)

    bundle = {
        "version": VERSION,
        "selected": selected_method,
        "models": {
            "poisson": poi,
            "hgb": hgb,
        },
        "feature_cols": feature_cols,
        "fitted_through": str(test_start_p - 1),
    }
    model_path = out_dir / "model.joblib"
    joblib.dump(bundle, model_path)

    report = {
        "version": VERSION,
        "target": "Monthly documented drug seizure counts per district across Kerala",
        "input_sha256": hashlib.sha256(events_csv.read_bytes()).hexdigest(),
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "scikit_learn": sklearn.__version__,
        "total_usable_events": len(events),
        "split": {
            "start": FIRST_MONTH,
            "validation_start": VALIDATION_START,
            "test_start": TEST_START,
            "test_end": TEST_END,
        },
        "positive_probability_threshold": POSITIVE_THRESHOLD,
        "selected_on_validation_mae": selected_method,
        "validation": val_scores,
        "holdout": test_scores,
    }

    (out_dir / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--events", type=Path, default=Path("Data-Collection-system/data/events_clean.csv"))
    parser.add_argument("--official", type=Path, default=Path("Data-Collection-system/data/official_stats.csv"))
    parser.add_argument("--out", type=Path, default=Path("Main/ml/runs/news-district-month-v2"))
    args = parser.parse_args()

    print(f"Running accountable training pipeline v2...")
    report = train_and_evaluate(args.events, args.official, args.out)
    print("\n--- Model Training & Evaluation Complete ---")
    print(f"Selected Method on Validation MAE: {report['selected_on_validation_mae']}")
    print(f"Holdout Results for {report['selected_on_validation_mae']}:")
    h = report['holdout'][report['selected_on_validation_mae']]
    print(f"  MAE: {h['mae']}")
    print(f"  Accuracy: {h['accuracy'] * 100:.1f}%")
    print(f"  Precision: {h['precision'] * 100:.1f}%")
    print(f"  Recall: {h['recall'] * 100:.1f}%")
    print(f"  F1: {h['f1']:.3f}")
    print(f"  Top-3 Capture Rate: {h['top_3_capture'] * 100:.1f}%")
    print(f"Artifacts saved to: {args.out}")


if __name__ == "__main__":
    main()
