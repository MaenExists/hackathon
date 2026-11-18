"""Export district-month evaluation aggregates for the hackathon demo."""

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

METHODS = ("district_history", "district_recent_3m", "poisson_district_calendar")
OUT = Path(__file__).resolve().parents[1] / "data" / "news-demo.json"


def export(run: Path) -> dict:
    report = json.loads((run / "metrics.json").read_text())
    if report["version"] != "news-district-month-v1":
        raise ValueError("Expected the v1 news experiment")
    if hashlib.sha256((run / "model.joblib").read_bytes()).hexdigest() != report["model_sha256"]:
        raise ValueError("The model bundle does not match the report checksum")
    primary = report["primary"]
    threshold = report["positive_probability_threshold"]
    with (run / "holdout_predictions.csv").open(newline="") as file:
        rows = [
            {
                "month": row["month"], "district": row["district"],
                "observed": int(row["actual_collected_count"]),
                "expected": {method: float(row[f"{method}_count"]) for method in METHODS},
            }
            for row in csv.DictReader(file)
        ]
    expected_months = [f"2026-{month:02d}" for month in range(6, 11)]
    district_sets = [{row["district"] for row in rows if row["month"] == month} for month in expected_months]
    if (len(rows) != 70 or {row["month"] for row in rows} != set(expected_months)
            or len(district_sets[0]) != 14 or any(group != district_sets[0] for group in district_sets)):
        raise ValueError("Expected a complete panel of 14 districts across five holdout months")
    selected = min(METHODS, key=lambda name: primary["validation"][name]["mae"])
    if selected != primary["selected_on_validation_mae"]:
        raise ValueError("Selected method does not match validation results")
    methods = []
    for name in METHODS:
        confusion = dict(tp=0, fp=0, fn=0, tn=0)
        for row in rows:
            count = row["expected"][name]
            if not math.isfinite(count) or count < 0 or row["observed"] < 0:
                raise ValueError("Expected nonnegative finite evaluation counts")
            flagged = -math.expm1(-count) >= threshold
            observed = row["observed"] > 0
            confusion[("t" if flagged == observed else "f") + ("p" if flagged else "n")] += 1
        score = primary["holdout"][name]
        mae = sum(abs(row["observed"] - row["expected"][name]) for row in rows) / len(rows)
        top_three = 0
        for month in expected_months:
            ranked = sorted(
                (row for row in rows if row["month"] == month),
                key=lambda row: (-row["expected"][name], row["district"]),
            )
            top_three += sum(row["observed"] for row in ranked[:3])
        if (confusion != score["confusion"] or abs(mae - score["mae"]) > 0.0000051
                or score["rows"] != len(rows)
                or score["top_3_events"] != top_three
                or score["events"] != sum(row["observed"] for row in rows)):
            raise ValueError(f"Holdout predictions and metrics disagree for {name}")
        tp, fp, fn, tn = (confusion[key] for key in ("tp", "fp", "fn", "tn"))
        for key, value in {
            "accuracy": (tp + tn) / len(rows), "precision": tp / (tp + fp),
            "recall": tp / (tp + fn), "f1": 2 * tp / (2 * tp + fp + fn),
        }.items():
            if not math.isclose(score[key], value):
                raise ValueError(f"Invalid {key} for {name}")
        methods.append({
            "id": name, "validationMae": primary["validation"][name]["mae"],
            **{key: score[key] for key in ("mae", "rmse", "accuracy", "precision", "recall", "f1",
                                           "confusion", "top_3_events")},
        })
    return {
        "version": report["version"], "selected": selected,
        "threshold": threshold, "inputObservations": report["cohort"]["input_observations"],
        "eligibleObservations": report["cohort"]["usable_seizures"],
        "fitEvents": primary["holdout_fit"]["events"], "modelSha256": report["model_sha256"],
        "split": report["split"], "months": expected_months, "methods": methods, "rows": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = json.dumps(export(args.run), indent=2, allow_nan=False) + "\n"
    if args.check:
        if OUT.read_text() != content:
            parser.error("The bundled demo differs from the verified model run")
    else:
        OUT.write_text(content)


if __name__ == "__main__":
    main()
