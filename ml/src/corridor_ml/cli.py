"""Beginner-facing commands. Training and real-data storage stay on your machine."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import html
import json
from pathlib import Path
import sys
import time

from .data import DataError, day, load_dataset
from .demo import generate_demo, init_dataset
from .features import FeatureStore, WEEK
from .model import forecast_bundle, json_write, load_bundle, metrics, train
from .news import connect, fetch_news, review


def render_report(report: dict, path: Path) -> None:
    esc = lambda v: html.escape(str(v))
    rows = "".join(f"<tr><td>{esc(r['name'])}</td><td>{esc(r['status'])}</td><td>{esc(r['estimate'] if r['estimate'] is not None else 'Abstained')}</td><td>{esc(r['baseline'])}</td><td>{esc(r['lower'])}–{esc(r['upper'])}</td><td>{esc(r['reason'] or '')}</td></tr>" for r in report["forecasts"])
    notes = "".join(f"<li>{esc(x)}</li>" for x in report["limitations"])
    path.write_text(f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forecast report · {esc(report['runId'])}</title>
<style>body{{background:#000;color:#ddd;font:15px/1.7 system-ui;margin:5vw;max-width:1300px}}h1{{font-size:44px;font-weight:500;letter-spacing:-2px}}small{{color:#999}}section{{border:1px solid #333;padding:24px;margin:24px 0;overflow:auto}}table{{border-collapse:collapse;width:100%;font-size:13px}}td,th{{padding:12px;text-align:left;border-bottom:1px solid #333}}code,pre{{color:#ccc;white-space:pre-wrap}}strong{{color:#c7a4ff}}a{{color:inherit}}</style>
<small>CORRIDOR / EXPERIMENTAL FORECAST</small><h1>Documented patterns. Measured uncertainty.</h1>
<p>{'SYNTHETIC DEMONSTRATION' if report['synthetic'] else 'LOCAL REAL-DATA EXPERIMENT — NOT OPERATIONALLY VALIDATED'}</p>
<p>{esc(report['target'])}. Next {report['horizonDays']} days from {esc(report['asOf'])}. Run <code>{esc(report['runId'])}</code>.</p>
<section><h2>Final chronological holdout</h2><p>Selected method: <strong>{esc(report['selectedModel'])}</strong> · MAE {esc(report['holdout']['selected']['mae'])} cases · 13-week baseline MAE {esc(report['holdout']['baseline']['mae'])} · observed interval coverage {esc(report['holdout']['intervalCoverage'])}</p><p>{esc(report['selectionReason'])}</p></section>
<section><h2>Forecasts</h2><table><thead><tr><th>Area / connection</th><th>Status</th><th>Expected cases</th><th>Baseline</th><th>Empirical range</th><th>Reason</th></tr></thead><tbody>{rows}</tbody></table></section>
<section><h2>What this cannot tell you</h2><ul>{notes}</ul></section><small>This file is standalone, makes no network requests, and contains aggregate model outputs. Full evaluation, input hashes and provenance are in the adjacent report.json and manifest.json.</small></html>""")


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Train aggregate documented-case forecasts; use --help after any command.")
    sub = p.add_subparsers(dest="command", required=True)
    for name in ("init", "demo-data"):
        c = sub.add_parser(name, help="Create blank real-data templates" if name == "init" else "Generate a reproducible synthetic training dataset")
        c.add_argument("--out", type=Path, required=True)
        if name == "demo-data":
            c.add_argument("--weeks", type=int, default=156)
            c.add_argument("--seed", type=int, default=42)
    c = sub.add_parser("validate", help="Validate CSVs without training")
    c.add_argument("--data", type=Path, required=True)
    c = sub.add_parser("train", help="Backtest, calibrate and train one aggregate target")
    c.add_argument("--data", type=Path, required=True)
    c.add_argument("--out", type=Path, required=True)
    c.add_argument("--as-of", required=True, help="Monday YYYY-MM-DD; everything after this date is excluded")
    c.add_argument("--target", choices=["area", "corridor"], default="corridor")
    c.add_argument("--horizon-weeks", type=int, choices=[1, 4], default=4)
    c.add_argument("--reporting-delay-weeks", type=int, default=2)
    c = sub.add_parser("forecast", help="Use your trusted local model on newer available data")
    c.add_argument("--model", type=Path, required=True, help="Only your own model.joblib; never download/load an untrusted pickle")
    c.add_argument("--data", type=Path, required=True)
    c.add_argument("--as-of", required=True)
    c.add_argument("--out", type=Path, required=True)
    c = sub.add_parser("evaluate", help="Score a saved report after its target and reporting delay have elapsed")
    c.add_argument("--report", type=Path, required=True)
    c.add_argument("--data", type=Path, required=True)
    c.add_argument("--as-of", required=True)
    c.add_argument("--out", type=Path, required=True)
    c = sub.add_parser("report", help="Render a standalone, offline HTML report")
    c.add_argument("--input", type=Path, required=True)
    c.add_argument("--out", type=Path, required=True)
    c = sub.add_parser("fetch-news", help="Poll approved RSS/Atom feeds into a separate review inbox")
    c.add_argument("--config", type=Path, required=True)
    c.add_argument("--database", type=Path, required=True)
    c.add_argument("--watch", action="store_true", help="Keep polling until Ctrl-C; does not retrain or create events")
    c.add_argument("--interval", type=int, default=900, help="Seconds between polls; minimum 300")
    c = sub.add_parser("news-inbox", help="Export news metadata for human review")
    c.add_argument("--database", type=Path, required=True)
    c.add_argument("--out", type=Path, required=True)
    c = sub.add_parser("review-news", help="Record a review; never automatically adds a training case")
    c.add_argument("--database", type=Path, required=True)
    c.add_argument("--article-id", required=True)
    c.add_argument("--decision", required=True, choices=["corroborated", "rejected"])
    c.add_argument("--case-id", default="")
    c.add_argument("--evidence-ref", default="")
    return p


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "init":
            init_dataset(args.out)
            print(f"Blank templates created in {args.out}. See ml/docs/DATA_COLLECTION.md before entering data.")
        elif args.command == "demo-data":
            if not 1 <= args.weeks <= 520:
                raise DataError("Demo weeks must be 1–520.")
            generate_demo(args.out, args.weeks, args.seed)
            print(f"Synthetic dataset created in {args.out}; recommended as-of is in dataset.json.")
        elif args.command == "validate":
            print(json.dumps(load_dataset(args.data).summary(), indent=2))
        elif args.command == "train":
            print("Validating data and constructing historical snapshots…", flush=True)
            report = train(load_dataset(args.data), args.out, day(args.as_of), args.target, args.horizon_weeks, args.reporting_delay_weeks)
            render_report(report, args.out / "report.html")
            print(json.dumps({"run": report["runId"], "data": "synthetic" if report["synthetic"] else "real", "selected": report["selectedModel"], "held_out_mae": report["holdout"]["selected"]["mae"], "interval_coverage": report["holdout"]["intervalCoverage"], "output": str(args.out)}, indent=2))
        elif args.command == "forecast":
            data, bundle = load_dataset(args.data), load_bundle(args.model)
            rows = forecast_bundle(bundle, data, day(args.as_of))
            args.out.parent.mkdir(parents=True, exist_ok=True)
            json_write(args.out, {"schemaVersion": 1, "runId": bundle["run_id"], "synthetic": bundle["synthetic"], "asOf": args.as_of, "targetType": bundle["target_type"], "horizonDays": bundle["horizon"] * 7, "reportingDelayDays": bundle["delay"] * 7, "forecasts": rows, "inputSha256": data.fingerprints})
            print(f"Forecast written to {args.out}; {sum(r['status'] == 'abstained' for r in rows)} entities abstained.")
        elif args.command == "evaluate":
            report, as_of = json.loads(args.report.read_text()), day(args.as_of)
            data = load_dataset(args.data)
            if report["synthetic"] != data.synthetic:
                raise DataError("Evaluation dataset mode differs from the report.")
            origin = day(report["asOf"])
            horizon, delay = report["horizonDays"] // 7, report["reportingDelayDays"] // 7
            if origin + WEEK * (horizon + delay) > as_of:
                raise DataError("The forecast window plus reporting delay has not elapsed.")
            store, scored, missing = FeatureStore(data), [], []
            for row in report["forecasts"]:
                if row["status"] != "forecast":
                    continue
                actual = store.target(row["entityId"], origin, horizon, origin + WEEK * (horizon + delay)) if row["entityId"] in store.entities else None
                if actual is None:
                    missing.append(row["entityId"])
                else:
                    scored.append({"entity_id": row["entityId"], "actual": actual, "estimate": row["estimate"], "baseline": row["baseline"], "covered": row["lower"] <= actual <= row["upper"]})
            result = {"runId": report["runId"], "evaluatedAsOf": str(as_of), "labelCutoff": str(origin + WEEK * (horizon + delay)), "selected": metrics([r["actual"] for r in scored], [r["estimate"] for r in scored]), "baseline": metrics([r["actual"] for r in scored], [r["baseline"] for r in scored]), "intervalCoverage": sum(r["covered"] for r in scored) / len(scored) if scored else None, "unscoredMissingCoverage": missing, "rows": scored}
            args.out.parent.mkdir(parents=True, exist_ok=True)
            json_write(args.out, result)
            print(f"Evaluation written to {args.out}; {len(scored)} scored, {len(missing)} missing coverage.")
        elif args.command == "report":
            render_report(json.loads(args.input.read_text()), args.out)
            print(args.out)
        elif args.command == "fetch-news":
            if args.interval < 300:
                raise DataError("Feed polling interval must be at least 300 seconds.")
            while True:
                print(json.dumps(fetch_news(args.config, args.database), indent=2), flush=True)
                if not args.watch:
                    break
                time.sleep(args.interval)
        elif args.command == "news-inbox":
            with connect(args.database) as db:
                rows = db.execute("SELECT * FROM articles ORDER BY first_seen_at DESC").fetchall()
                args.out.parent.mkdir(parents=True, exist_ok=True)
                with args.out.open("w", newline="", encoding="utf-8") as f:
                    columns = [x[1] for x in db.execute("PRAGMA table_info(articles)")]
                    writer = csv.writer(f)
                    writer.writerow(columns)
                    # Keep publisher-controlled headlines from becoming spreadsheet formulas.
                    safe = lambda v: "'" + v if isinstance(v, str) and v.lstrip().startswith(("=", "+", "-", "@")) else v
                    writer.writerows([safe(r[c]) for c in columns] for r in rows)
            print(f"Review inbox exported to {args.out}; no training events were created.")
        elif args.command == "review-news":
            review(args.database, args.article_id, args.decision, args.case_id, args.evidence_ref)
            print("Review appended. Merge a verified canonical case into events.csv manually; preserve original availability and review dates.")
        return 0
    except KeyboardInterrupt:
        print("Stopped.", file=sys.stderr)
        return 130
    except (DataError, OSError, ValueError, KeyError) as e:
        print(f"Cannot complete: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
