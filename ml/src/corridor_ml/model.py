"""Chronological selection, separate calibration/holdout, then a full past refit."""
from __future__ import annotations

import hashlib
import json
import math
import platform
from datetime import date, datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.feature_extraction import DictVectorizer
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_poisson_deviance, mean_squared_error
from sklearn.pipeline import make_pipeline
from threadpoolctl import threadpool_limits

from . import __version__
from .data import Dataset, DataError
from .features import FeatureStore, WEEK

LIMITATIONS = [
    "The target is future documented cases, not the volume or probability of actual trafficking.",
    "Seizures reflect reporting and enforcement. Coverage declarations cannot remove unmeasured selection bias.",
    "A corridor is a documented origin/destination connection, not a predicted street-level journey. New routes are not invented.",
    "Intervals are empirical ranges from earlier errors; temporal dependence and distribution changes can invalidate nominal coverage.",
    "News requires independent corroboration and canonical-case deduplication. Raw news, community tips and individual consumer records are excluded.",
    "Aggregate consumption and service indicators are contextual; they do not identify people or measure trafficking and treatment demand interchangeably.",
    "Synthetic results test the pipeline only. Real data needs independent validation and human review before any operational use.",
]


def estimator():
    # Disable sklearn's random internal early-stopping split: all evaluation is chronological.
    return make_pipeline(
        DictVectorizer(sparse=False),
        HistGradientBoostingRegressor(loss="poisson", max_iter=120, learning_rate=0.06, max_leaf_nodes=15, min_samples_leaf=20, l2_regularization=5.0, early_stopping=False, random_state=42),
    )


def entity_signature(entity) -> list[str]:
    return [str(entity[k]) for k in ("target_type", "origin_id", "destination_id", "area_id", "transport_mode", "known_since")]


def fit(rows: pd.DataFrame):
    if len(rows) < 100 or rows.y.sum() < 20:
        raise DataError("Insufficient training history: need at least 100 covered entity-windows and 20 documented cases in training labels. Collect more covered weeks or use a coarser target.")
    model = estimator()
    with threadpool_limits(limits=2):
        model.fit(rows.features.tolist(), rows.y.astype(float).to_numpy())
    return model


def predictions(model, rows: pd.DataFrame) -> np.ndarray:
    with threadpool_limits(limits=2):
        return np.maximum(0, model.predict(rows.features.tolist()))


def metrics(actual, predicted) -> dict:
    y, p = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    if not len(y):
        return {"mae": None, "rmse": None, "poisson_deviance": None, "wape": None, "rows": 0}
    return {
        "mae": round(float(mean_absolute_error(y, p)), 5),
        "rmse": round(float(np.sqrt(mean_squared_error(y, p))), 5),
        "poisson_deviance": round(float(mean_poisson_deviance(y, np.maximum(p, 1e-8))), 5),
        "wape": round(float(np.abs(y - p).sum() / y.sum()), 5) if y.sum() else None,
        "rows": len(y),
    }


def interval(prediction: float, radius: float) -> tuple[int, int]:
    width = radius * math.sqrt(max(0, prediction) + 1)
    return max(0, math.floor(prediction - width)), math.ceil(prediction + width)


def evaluate_origins(panel: pd.DataFrame, origins: list[date], selected: str | None = None, radius: float | None = None) -> pd.DataFrame:
    results = []
    for origin in origins:
        train, test = panel[panel.label_cutoff <= origin], panel[panel.origin == origin]
        if test.empty:
            continue
        model = fit(train)
        pred = predictions(model, test)
        for (_, row), value in zip(test.iterrows(), pred):
            item = {"origin": origin, "label_cutoff": row.label_cutoff, "entity_id": row.entity_id, "actual": int(row.y), "model": float(value), "baseline": float(row.baseline), "recent_baseline": float(row.recent_baseline), "train_rows": len(train), "train_labels_through": str(train.label_cutoff.max())}
            if selected:
                item["selected"] = item[selected]
            if radius is not None:
                item["lower"], item["upper"] = interval(item["selected"], radius)
                item["covered"] = item["lower"] <= item["actual"] <= item["upper"]
            results.append(item)
    return pd.DataFrame(results)


def json_write(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False, default=str) + "\n")


def train(data: Dataset, out: Path, as_of: date, target_type: str = "corridor", horizon: int = 4, delay: int = 2) -> dict:
    if as_of.weekday() != 0 or horizon not in (1, 4) or not 0 <= delay <= 26:
        raise DataError("as-of must be a Monday; horizon-weeks is 1 or 4; reporting-delay-weeks must be 0–26.")
    if target_type not in ("area", "corridor"):
        raise DataError("target must be area or corridor")
    if out.exists() and any(out.iterdir()):
        raise DataError("Use a new, empty run directory: previous models and reports are immutable.")
    store = FeatureStore(data)
    panel = store.panel(target_type, as_of, horizon, delay)
    if panel.empty:
        raise DataError("No mature, covered labels. Add reporting coverage, documented cases and sufficient history; seizure-only data supports the area target.")
    # Disjoint target windows plus reporting-delay gaps: calibration/selection labels
    # must already be mature before the next stage makes its first prediction.
    latest = panel.origin.max()
    origins = [latest - WEEK * (horizon + delay) * i for i in range(10, -1, -1)]
    if not set(origins).issubset(set(panel.origin)):
        raise DataError("Need 11 covered, non-overlapping evaluation origins after the initial training history. For 28-day forecasts collect about two years of weekly coverage (three years preferred).")
    selection_origins, calibration_origins, holdout_origins = origins[:3], origins[3:7], origins[7:]
    selection = evaluate_origins(panel, selection_origins)
    scores = {name: metrics(selection.actual, selection[name]) for name in ("model", "baseline", "recent_baseline")}
    best_baseline = min(("baseline", "recent_baseline"), key=lambda k: scores[k]["mae"])
    # Do not force a more complex model when it adds no evidence of value.
    selected = "model" if scores["model"]["mae"] < scores[best_baseline]["mae"] * 0.95 else best_baseline
    calibration = evaluate_origins(panel, calibration_origins, selected)
    residual = np.abs(calibration.actual - calibration.selected) / np.sqrt(calibration.selected + 1)
    if len(residual) < 20:
        raise DataError("At least 20 calibration entity-windows are required for an empirical range; add covered entities or history.")
    q = min(1.0, math.ceil((len(residual) + 1) * 0.9) / len(residual))
    radius = float(np.quantile(residual, q, method="higher"))
    holdout = evaluate_origins(panel, holdout_origins, selected, radius)
    model = fit(panel)
    by_entity = []
    for entity_id, rows in holdout.groupby("entity_id"):
        by_entity.append({"entity_id": entity_id, "name": str(store.entities[entity_id]["name"]), **metrics(rows.actual, rows.selected), "actual_cases": int(rows.actual.sum()), "interval_coverage": round(float(rows.covered.mean()), 4)})
    folds = []
    for origin, rows in holdout.groupby("origin"):
        top = rows.nlargest(min(3, len(rows)), "selected")
        folds.append({"origin": str(origin), "end": str(origin + WEEK * horizon), "train_labels_through": rows.iloc[0].train_labels_through, "train_rows": int(rows.iloc[0].train_rows), "selected_mae": metrics(rows.actual, rows.selected)["mae"], "model_mae": metrics(rows.actual, rows.model)["mae"], "baseline_mae": metrics(rows.actual, rows.baseline)["mae"], "recent_baseline_mae": metrics(rows.actual, rows.recent_baseline)["mae"], "top3_capture": round(float(top.actual.sum() / rows.actual.sum()), 4) if rows.actual.sum() else None})
    # Importance is computed on final holdout with the last pre-holdout model, never used to select/tune.
    importance_model = fit(panel[panel.label_cutoff <= holdout_origins[0]])
    importance_test = panel[panel.origin.isin(holdout_origins)]
    vector = importance_model.steps[0][1]
    booster = importance_model.steps[1][1]
    with threadpool_limits(limits=2):
        importance = permutation_importance(booster, vector.transform(importance_test.features.tolist()), importance_test.y.astype(float), scoring="neg_mean_absolute_error", n_repeats=3, random_state=42)
    explanations = sorted([{"feature": k, "mae_increase": round(float(v), 5), "std": round(float(s), 5)} for k, v, s in zip(vector.get_feature_names_out(), importance.importances_mean, importance.importances_std)], key=lambda x: -x["mae_increase"])[:12]
    source_hash = hashlib.sha256(b"".join(p.name.encode() + p.read_bytes() for p in sorted(Path(__file__).parent.glob("*.py")))).hexdigest()
    run_id = hashlib.sha256(json.dumps({"inputs": data.fingerprints, "as_of": str(as_of), "target": target_type, "horizon": horizon, "delay": delay, "version": __version__, "pipeline_source_sha256": source_hash}, sort_keys=True).encode()).hexdigest()[:16]
    bundle = {"schema_version": 1, "model": model, "selected": selected, "radius": radius, "as_of": as_of, "target_type": target_type, "horizon": horizon, "delay": delay, "run_id": run_id, "entity_ids": [k for k, e in store.entities.items() if e.target_type == target_type and e.known_since <= as_of], "entity_signatures": {k: entity_signature(e) for k,e in store.entities.items()}, "synthetic": data.synthetic, "sklearn_version": sklearn.__version__}
    report = {
        "schemaVersion": 1, "runId": run_id, "synthetic": data.synthetic,
        "generatedAt": datetime.now(timezone.utc).isoformat(), "asOf": str(as_of),
        "targetType": target_type, "horizonDays": horizon * 7,
        "target": "Future documented cases involving a known origin/destination corridor" if target_type == "corridor" else "Future documented seizure cases by area",
        "algorithm": "Poisson histogram gradient boosting", "selectedModel": selected,
        "selectionReason": "Gradient boosting must reduce selection MAE by at least 5% versus both baselines; otherwise retain the best baseline.",
        "reportingDelayDays": delay * 7, "trainingRows": len(panel),
        "trainingLabelsThrough": str(panel.label_cutoff.max()),
        "selection": {"origins": [str(d) for d in selection_origins], "metrics": scores},
        "calibration": {"origins": [str(d) for d in calibration_origins], "rows": len(residual), "nominalCoverage": 0.9, "method": "Earlier absolute residual / sqrt(prediction+1), finite-sample 90th percentile; no time-series coverage guarantee."},
        "holdout": {"origins": [str(d) for d in holdout_origins], "selected": metrics(holdout.actual, holdout.selected), "model": metrics(holdout.actual, holdout.model), "baseline": metrics(holdout.actual, holdout.baseline), "recentBaseline": metrics(holdout.actual, holdout.recent_baseline), "intervalCoverage": round(float(holdout.covered.mean()), 4), "meanIntervalWidth": round(float((holdout.upper - holdout.lower).mean()), 3), "folds": folds, "byEntity": by_entity},
        "featureImportance": explanations,
        "data": data.summary(), "software": {"pipeline": __version__, "python": platform.python_version(), "sklearn": sklearn.__version__, "numpy": np.__version__, "pandas": pd.__version__, "source_sha256": source_hash},
        "limitations": LIMITATIONS,
    }
    report["forecasts"] = forecast_bundle(bundle, data, as_of)
    report["monitoring"] = monitoring(report)
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, out / "model.joblib")
    report["modelSha256"] = hashlib.sha256((out / "model.joblib").read_bytes()).hexdigest()
    json_write(out / "report.json", report)
    holdout.to_csv(out / "holdout.csv", index=False)
    selection.to_csv(out / "selection.csv", index=False)
    calibration.to_csv(out / "calibration.csv", index=False)
    json_write(out / "manifest.json", {"run_id": run_id, "pipeline_source_sha256": source_hash, "input_sha256": data.fingerprints, "model_sha256": report["modelSha256"], "config": {"as_of": str(as_of), "target_type": target_type, "horizon_weeks": horizon, "reporting_delay_weeks": delay}, "report_sha256": hashlib.sha256((out / "report.json").read_bytes()).hexdigest()})
    (out / "model-card.md").write_text(model_card(report))
    return report


def forecast_bundle(bundle: dict, data: Dataset, as_of: date) -> list[dict]:
    if as_of < bundle["as_of"] or as_of.weekday() != 0:
        raise DataError("Forecast origin must be a Monday on/after the model's training date.")
    if data.synthetic != bundle["synthetic"]:
        raise DataError("A synthetic model cannot forecast real data, or vice versa. Retrain on the correct data.")
    store, rows = FeatureStore(data), []
    for key, entity in store.entities.items():
        if entity.target_type != bundle["target_type"]:
            continue
        features, info = store.snapshot(key, as_of)
        reason = None
        if key not in bundle["entity_ids"] or entity.known_since > as_of:
            reason = "Entity was not known to this training run. Add documented history and retrain."
        elif entity_signature(entity) != bundle["entity_signatures"].get(key):
            reason = "Entity definition changed since training. Review the registry and retrain."
        elif info["covered_13w"] < 8:
            reason = "Fewer than eight completed reporting weeks in the last thirteen."
        elif info["support_13w"] < 5:
            reason = "Fewer than five known documented cases in the last thirteen weeks."
        elif (as_of - bundle["as_of"]).days > 91:
            reason = "Model is over thirteen weeks old. Retrain before issuing forecasts."
        row = {"entityId": key, "name": str(entity["name"]), "originId": entity.origin_id or None, "destinationId": entity.destination_id or None, "areaId": entity.area_id or None, "status": "abstained" if reason else "forecast", "reason": reason, "estimate": None, "baseline": None, "lower": None, "upper": None, "support13w": info["support_13w"], "coveredWeeks13w": info["covered_13w"], "staleMetrics": info["stale_metrics"]}
        if not reason:
            value = float(predictions(bundle["model"], pd.DataFrame([{"features": features}]))[0]) if bundle["selected"] == "model" else info["baseline_weekly" if bundle["selected"] == "baseline" else "recent_weekly"] * bundle["horizon"]
            row.update(estimate=round(value, 3), baseline=round(info["baseline_weekly"] * bundle["horizon"], 3))
            row["lower"], row["upper"] = interval(value, bundle["radius"])
        rows.append(row)
    return sorted(rows, key=lambda r: (r["estimate"] is None, -(r["estimate"] or 0), r["entityId"]))


def load_bundle(path: Path) -> dict:
    # joblib/pickle is executable. This API is intentionally local CLI only, never an upload endpoint.
    bundle = joblib.load(path)
    if bundle.get("schema_version") != 1 or bundle.get("sklearn_version") != sklearn.__version__:
        raise DataError("Unsupported model or sklearn version. Use the locked environment and retrain.")
    return bundle


def monitoring(report: dict) -> dict:
    alerts = []
    if report["synthetic"]:
        alerts.append("Synthetic pipeline demonstration; real-world performance is unestablished.")
    h = report["holdout"]
    if h["selected"]["mae"] > min(h["baseline"]["mae"], h["recentBaseline"]["mae"]):
        alerts.append("Selected method lost to a baseline in the final holdout. Review before use.")
    if h["intervalCoverage"] < 0.8:
        alerts.append("Held-out interval coverage fell below 80%; nominal 90% ranges are unreliable here.")
    abstained = sum(r["status"] == "abstained" for r in report["forecasts"])
    if abstained:
        alerts.append(f"{abstained} entities abstained due to sparse/stale/unknown coverage.")
    return {"operationallyValidated": False, "alerts": alerts}


def model_card(report: dict) -> str:
    return "\n".join([
        "# Model card", "", f"Run: {report['runId']}", f"Data: {'SYNTHETIC' if report['synthetic'] else 'REAL — experimental, not operationally validated'}",
        f"Target: {report['target']}, next {report['horizonDays']} days", f"As of: {report['asOf']}; selected: {report['selectedModel']}",
        "", "Selection, calibration and final holdout use separate chronological, non-overlapping target windows. Training purges every label whose maturity cutoff is after the prediction origin. Features use only releases available by that origin. The final inference model is refit on all mature past labels after evaluation.",
        "", "## Held-out results", "", json.dumps(report["holdout"]["selected"], indent=2),
        f"Empirical interval coverage: {report['holdout']['intervalCoverage']}; nominal 0.9 is not guaranteed.",
        "", "## Limits and intended use", "", *[f"- {l}" for l in report["limitations"]],
        "", "## Reproducibility", "", "See manifest.json for input/model/report hashes and report.json for software versions, feature diagnostics, coverage and per-entity errors. Feature importance measures predictive sensitivity, never a causal explanation.", "",
    ])
