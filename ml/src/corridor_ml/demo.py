"""Reproducible invented data for exercising the pipeline, never real evidence."""
from datetime import date, timedelta
import json
from pathlib import Path

import numpy as np

from .data import HEADERS, SUBSTANCES, DataError, write_csv

AREAS = ["kasaragod", "kannur", "wayanad", "kozhikode", "malappuram", "palakkad", "thrissur", "ernakulam", "idukki", "kottayam", "alappuzha", "pathanamthitta", "kollam", "thiruvananthapuram"]
ROUTES = [
    ("c01", "bengaluru", "ernakulam", "Road"),
    ("c02", "mysuru", "kozhikode", "Road"),
    ("c03", "dakshina-kannada", "kannur", "Road"),
    ("c04", "coimbatore", "thrissur", "Rail"),
    ("c05", "bengaluru", "kozhikode", "Road"),
    ("c06", "madurai", "idukki", "Road"),
    ("c07", "ernakulam", "thiruvananthapuram", "Rail"),
    ("c08", "kozhikode", "ernakulam", "Road"),
    ("c09", "coimbatore", "kottayam", "Unknown"),
    ("c10", "kannur", "malappuram", "Road"),
]


def init_dataset(out: Path, synthetic=False) -> None:
    if out.exists() and any(out.iterdir()):
        raise DataError("Dataset directory must be empty; existing data is never overwritten.")
    out.mkdir(parents=True, exist_ok=True)
    for name in HEADERS:
        write_csv(out / f"{name}.csv", name, [])
    (out / "dataset.json").write_text(json.dumps({"schema_version": 1, "data_mode": "synthetic" if synthetic else "real", "permitted_use_reference": "", "coverage_description": "Replace with the agencies, jurisdictions and reporting periods covered. Mark complete weeks only with source confirmation."}, indent=2) + "\n")


def generate_demo(out: Path, weeks=156, seed=42) -> None:
    init_dataset(out, synthetic=True)
    rng = np.random.default_rng(seed)
    start = date(2023, 10, 23)
    entities, events, coverage, context = [], [], [], []
    for key, origin, dest, mode in ROUTES:
        entities.append(dict(entity_id=key, target_type="corridor", name=f"{origin.title()} → {dest.title()}", origin_id=origin, destination_id=dest, area_id="", transport_mode=mode, known_since=str(start), distance_km=int(rng.integers(100, 650))))
    for key in AREAS:
        entities.append(dict(entity_id=f"area-{key}", target_type="area", name=key.title(), origin_id="", destination_id="", area_id=key, transport_mode="Unknown", known_since=str(start), distance_km=""))
    for w in range(weeks):
        begin = start + timedelta(weeks=w)
        for idx, e in enumerate(entities):
            traffic = 100 + 35 * np.sin(2 * np.pi * w / 52 + idx / 3)
            checks = 60 + 15 * np.cos(2 * np.pi * w / 26 + idx / 4)
            for metric, value, unit in [("transport_flow_index", traffic, "index"), ("enforcement_checks", checks, "count")]:
                context.append(dict(entity_id=e["entity_id"], metric=metric, period_start=str(begin), period_end=str(begin + timedelta(days=7)), available_date=str(begin + timedelta(days=8)), value=round(value, 2), unit=unit, sample_size="", source_ref="synthetic-generator"))
            # Some reporting gaps and delayed releases test missingness/availability.
            coverage.append(dict(entity_id=e["entity_id"], week_start=str(begin), complete="false" if (w + idx) % 37 == 0 else "true", available_date=str(begin + timedelta(days=9)), source_ref="synthetic-reporting-register"))
            rate = (1.0 + idx % 4 * .5) * (traffic / 100) ** 1.5
            if e["target_type"] == "area":
                rate *= .45
            for _ in range(int(rng.poisson(rate))):
                event = begin + timedelta(days=int(rng.integers(0, 7)))
                available = event + timedelta(days=int(rng.integers(1, 6)))
                documented = available + timedelta(days=int(rng.integers(0, 4)))
                seizure = e["destination_id"] or e["area_id"]
                events.append(dict(case_id=f"SYN-ML-{len(events)+1:07}", event_date=str(event), available_date=str(available), documented_date=str(documented), withdrawn_date="", seizure_area_id=seizure, origin_id=e["origin_id"], destination_id=e["destination_id"], transport_mode=e["transport_mode"], substance=str(rng.choice(SUBSTANCES)), quantity=round(float(rng.lognormal(2, 1)), 2), unit="g", source_kind="synthetic", source_ref="synthetic-generator", corroboration_ref=""))
    for name, rows in [("entities", entities), ("events", events), ("coverage", coverage), ("covariates", context)]:
        write_csv(out / f"{name}.csv", name, rows)
    (out / "dataset.json").write_text(json.dumps({"schema_version": 1, "data_mode": "synthetic", "permitted_use_reference": "Invented reproducible simulation", "coverage_description": "Invented weekly reporting register for ten fictional corridors and fourteen Kerala areas. No source is a real agency. Scenario is independent from the app's original case demonstration.", "seed": seed, "weeks": weeks, "recommended_as_of": str(start + timedelta(weeks=weeks))}, indent=2) + "\n")
