"""Retrospective district-month experiment on the collected news snapshot."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import PoissonRegressor
from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder

from .model import metrics

VERSION = "news-district-month-v1"
FIRST_MONTH = "2023-12"
VALIDATION_START = "2026-01"
TEST_START = "2026-06"
TEST_END = "2026-10"
CANDIDATE = "poisson_district_calendar"
METHODS = ("district_history", "district_recent_3m", CANDIDATE)
POSITIVE_THRESHOLD = 0.5
TOP_K = 3
DISTRICTS = (
    "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam",
    "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta",
    "Thiruvananthapuram", "Thrissur", "Wayanad",
)


def panel(start: str, end: str, events: pd.DataFrame | None = None) -> pd.DataFrame:
    months = pd.period_range(start, end, freq="M")
    grid = pd.MultiIndex.from_product([months, DISTRICTS], names=["month", "district"])
    frame = grid.to_frame(index=False)
    month_number = frame["month"].dt.month
    frame["month_sin"] = np.sin(2 * np.pi * (month_number - 1) / 12)
    frame["month_cos"] = np.cos(2 * np.pi * (month_number - 1) / 12)
    frame["year_offset"] = (
        (frame["month"].dt.year - 2023) * 12 + month_number - 12
    ) / 12
    if events is not None:
        counts = events.groupby(["month", "district"]).size()
        frame["actual_collected_count"] = counts.reindex(grid, fill_value=0).to_numpy()
    return frame


def load_events(path: Path) -> tuple[pd.DataFrame, dict]:
    columns = [
        "event_id", "event_date", "publish_date", "district",
        "classification", "review_status", "conflicts",
    ]
    source = pd.read_csv(path, usecols=columns)
    dates = pd.to_datetime(source["event_date"], format="%Y-%m-%d", errors="raise")
    in_months = dates.dt.to_period("M").between(FIRST_MONTH, TEST_END)
    if source["event_id"].isna().any() or source["event_id"].duplicated().any():
        raise ValueError("Expected distinct canonical event IDs")
    if not set(source.loc[in_months, "district"]).issubset(DISTRICTS):
        raise ValueError("Unexpected district in Kerala observations")
    seizures = source["classification"].eq("seizure")
    conflicted = source["conflicts"].fillna("[]").map(json.loads).map(
        lambda fields: bool({"district", "event_date"}.intersection(fields))
    )
    usable = in_months & seizures & ~conflicted & source["review_status"].ne("rejected")
    events = source.loc[usable, ["district", "publish_date", "review_status"]].copy()
    events["month"] = dates[usable].dt.to_period("M")
    events["publish_date"] = pd.to_datetime(events["publish_date"], format="%Y-%m-%d", errors="raise")
    return events, {
        "input_observations": len(source),
        "undated": int(dates.isna().sum()),
        "dated_outside_full_months": int((dates.notna() & ~in_months).sum()),
        "non_seizure_in_full_months": int((in_months & ~seizures).sum()),
        "seizures_in_full_months_with_date_or_district_conflict": int((in_months & seizures & conflicted).sum()),
        "usable_seizures": len(events),
    }


def fit(events: pd.DataFrame, cutoff: str) -> tuple[dict, dict]:
    boundary = pd.Period(cutoff, freq="M")
    earlier = events[events["month"] < boundary]
    eligible = earlier[earlier["publish_date"] < boundary.start_time]
    history = panel(FIRST_MONTH, str(boundary - 1), eligible)
    if eligible.empty:
        raise ValueError(f"No earlier published seizures at cutoff {cutoff}")
    preprocessor = ColumnTransformer([
        ("district", OneHotEncoder(), ["district"]),
        ("calendar", "passthrough", ["month_sin", "month_cos", "year_offset"]),
    ])
    trained = make_pipeline(preprocessor, PoissonRegressor(alpha=0.05, max_iter=1000))
    trained.fit(history, history["actual_collected_count"])
    recent = history[history["month"] >= boundary - 3]
    models = {
        "district_history": history.groupby("district")["actual_collected_count"].mean().to_dict(),
        "district_recent_3m": recent.groupby("district")["actual_collected_count"].mean().to_dict(),
        CANDIDATE: trained,
    }
    return models, {
        "through_month": str(boundary - 1),
        "district_months": len(history),
        "events": len(eligible),
        "excluded_late_or_unknown_publication": len(earlier) - len(eligible),
    }


def predict(frame: pd.DataFrame, models: dict, method: str) -> np.ndarray:
    if method == CANDIDATE:
        return models[method].predict(frame)
    return frame["district"].map(models[method]).to_numpy()


def ratio(numerator: int, denominator: int) -> float | None:
    return float(numerator / denominator) if denominator else None


def score(frame: pd.DataFrame, predicted: np.ndarray) -> dict:
    actual = frame["actual_collected_count"].to_numpy()
    observed = actual > 0
    probability = -np.expm1(-predicted)
    flagged = probability >= POSITIVE_THRESHOLD
    tn, fp, fn, tp = (int(n) for n in confusion_matrix(observed, flagged, labels=[False, True]).ravel())
    ranked = frame.assign(predicted=predicted).sort_values(
        ["month", "predicted", "district"], ascending=[True, False, True]
    )
    top = ranked.groupby("month", sort=False).head(TOP_K)
    total = int(actual.sum())
    return {
        **metrics(actual, predicted),
        "events": total,
        "accuracy": ratio(tp + tn, len(actual)),
        "precision": ratio(tp, tp + fp),
        "recall": ratio(tp, tp + fn),
        "f1": ratio(2 * tp, 2 * tp + fp + fn),
        "average_precision": float(average_precision_score(observed, probability)) if observed.any() else None,
        "brier_score": float(brier_score_loss(observed, probability)),
        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
        "top_3_events": int(top["actual_collected_count"].sum()),
        "top_3_capture": ratio(int(top["actual_collected_count"].sum()), total),
        "top_3_precision": float(top["actual_collected_count"].gt(0).mean()),
    }


def experiment(events: pd.DataFrame) -> tuple[dict, pd.DataFrame, dict]:
    validation_models, validation_fit = fit(events, VALIDATION_START)
    validation = panel(VALIDATION_START, "2026-05", events)
    validation_scores = {
        method: score(validation, predict(validation, validation_models, method))
        for method in METHODS
    }
    selected = min(METHODS, key=lambda method: validation_scores[method]["mae"])
    test_models, test_fit = fit(events, TEST_START)
    holdout = panel(TEST_START, TEST_END, events)
    test_scores = {}
    for method in METHODS:
        predicted = predict(holdout, test_models, method)
        test_scores[method] = score(holdout, predicted)
        holdout[f"{method}_count"] = predicted
        holdout[f"{method}_probability_any"] = -np.expm1(-predicted)
    observed = holdout["actual_collected_count"].gt(0)
    result = {
        "selected_on_validation_mae": selected,
        "validation_fit": validation_fit,
        "holdout_fit": test_fit,
        "validation": validation_scores,
        "holdout": test_scores,
        "holdout_positive_district_months": int(observed.sum()),
        "holdout_all_positive_accuracy": float(observed.mean()),
        "holdout_all_negative_accuracy": float((~observed).mean()),
    }
    bundle = {"version": VERSION, "selected": selected, "models": test_models, "fitted_before": TEST_START}
    predictions = holdout.drop(columns=["month_sin", "month_cos", "year_offset"])
    return result, predictions, bundle


def run(source: Path, out: Path) -> dict:
    events, counts = load_events(source)
    primary, holdout, bundle = experiment(events)
    accepted = events[events["review_status"].eq("accepted")]
    sensitivity, accepted_holdout, _ = experiment(accepted)
    out.mkdir(parents=True, exist_ok=False)
    model_path = out / "model.joblib"
    joblib.dump(bundle, model_path)
    holdout.to_csv(out / "holdout_predictions.csv", index=False)
    accepted_holdout.to_csv(out / "holdout_accepted_only.csv", index=False)
    report = {
        "version": VERSION,
        "target": "Count of canonical dated seizure observations per district-month in the fixed collected news corpus",
        "input_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "scikit_learn": sklearn.__version__,
        "cohort": counts,
        "accepted_only_events": len(accepted),
        "split": {"start": FIRST_MONTH, "validation_start": VALIDATION_START,
                  "test_start": TEST_START, "test_end": TEST_END},
        "positive_probability_threshold": POSITIVE_THRESHOLD,
        "primary": primary,
        "accepted_only": sensitivity,
    }
    (out / "metrics.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    train = commands.add_parser("train", help="Fit and evaluate the retrospective experiment")
    train.add_argument("--events", type=Path, required=True)
    train.add_argument("--out", type=Path, required=True, help="New local run directory")
    inference = commands.add_parser("predict", help="Reproduce district scores for a held-out month")
    inference.add_argument("--model", type=Path, required=True, help="Use only a model you trained locally")
    test_months = pd.period_range(TEST_START, TEST_END, freq="M").astype(str)
    inference.add_argument("--month", choices=list(test_months), required=True)
    args = parser.parse_args()
    if args.command == "predict":
        bundle = joblib.load(args.model)
        if bundle["version"] != VERSION:
            parser.error("Incompatible experiment version")
        frame = panel(args.month, args.month)
        counts = predict(frame, bundle["models"], bundle["selected"])
        rows = frame[["district"]].assign(
            predicted_collected_count=counts, probability_any_collected=-np.expm1(-counts)
        )
        print(json.dumps({
            "version": VERSION,
            "month": args.month,
            "target": "Collected seizure observations",
            "method": bundle["selected"],
            "predictions": rows.to_dict("records"),
        }, indent=2))
        return
    report = run(args.events, args.out)
    print(json.dumps({
        "version": report["version"],
        "output": str(args.out),
        "chosen_method": report["primary"]["selected_on_validation_mae"],
        "cohort": report["cohort"],
    }, indent=2))


if __name__ == "__main__":
    main()
