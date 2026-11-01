"""Strict, non-personal CSV contracts. All dates are UTC day boundaries."""
from __future__ import annotations

import csv
import hashlib
import json
import math
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

METRICS = {
    "enforcement_checks": "count",
    "transport_flow_index": "index",
    "consumption_rate": "percent",
    "service_contacts": "count",
    "rainfall_mm": "mm",
}
SUBSTANCES = ("Cannabis", "Stimulants", "Opioids", "Other")
HEADERS = {
    "entities": ["entity_id", "target_type", "name", "origin_id", "destination_id", "area_id", "transport_mode", "known_since", "distance_km"],
    "events": ["case_id", "event_date", "available_date", "documented_date", "withdrawn_date", "seizure_area_id", "origin_id", "destination_id", "transport_mode", "substance", "quantity", "unit", "source_kind", "source_ref", "corroboration_ref"],
    "coverage": ["entity_id", "week_start", "complete", "available_date", "source_ref"],
    "covariates": ["entity_id", "metric", "period_start", "period_end", "available_date", "value", "unit", "sample_size", "source_ref"],
}


class DataError(ValueError):
    pass


def day(value: str, label: str = "date") -> date:
    try:
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError()
        return parsed
    except (ValueError, TypeError):
        raise DataError(f"{label}: use YYYY-MM-DD, got {value!r}") from None


def number(value: str, label: str, optional: bool = False) -> float | None:
    if optional and value == "":
        return None
    try:
        n = float(value)
        if not math.isfinite(n) or n < 0:
            raise ValueError()
        return n
    except (ValueError, TypeError):
        raise DataError(f"{label}: expected a finite non-negative number") from None


def read_csv(root: Path, name: str, optional: bool = False) -> pd.DataFrame:
    path = root / f"{name}.csv"
    if optional and not path.exists():
        return pd.DataFrame(columns=HEADERS[name])
    if not path.exists():
        raise DataError(f"Missing {path}; run init to obtain the templates.")
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != HEADERS[name]:
            raise DataError(f"{name}.csv: columns must be exactly {','.join(HEADERS[name])}. Extra personal fields are not accepted.")
        rows = [{k: v.strip() if isinstance(v, str) else v for k, v in r.items()} for r in reader]
    if any(None in r or any(v is None for v in r.values()) for r in rows):
        raise DataError(f"{name}.csv: malformed CSV row")
    return pd.DataFrame(rows, columns=HEADERS[name])


@dataclass
class Dataset:
    root: Path
    metadata: dict
    entities: pd.DataFrame
    events: pd.DataFrame
    coverage: pd.DataFrame
    covariates: pd.DataFrame
    fingerprints: dict[str, str]

    @property
    def synthetic(self) -> bool:
        return self.metadata["data_mode"] == "synthetic"

    def summary(self) -> dict:
        return {
            "data_mode": self.metadata["data_mode"],
            "entities": len(self.entities), "events": len(self.events),
            "documented_events": int(self.events.documented_date.notna().sum()),
            "movement_events": int(((self.events.origin_id != "") & (self.events.destination_id != "")).sum()),
            "coverage_weeks": len(self.coverage), "covariates": len(self.covariates),
            "first_event": str(self.events.event_date.min()) if len(self.events) else None,
            "last_event": str(self.events.event_date.max()) if len(self.events) else None,
            "input_sha256": self.fingerprints,
        }


def load_dataset(root: str | Path) -> Dataset:
    root = Path(root)
    try:
        meta = json.loads((root / "dataset.json").read_text())
    except (OSError, ValueError):
        raise DataError("dataset.json is missing or invalid; run init first.") from None
    if meta.get("schema_version") != 1 or meta.get("data_mode") not in ("real", "synthetic"):
        raise DataError("dataset.json requires schema_version 1 and data_mode real or synthetic.")
    if meta["data_mode"] == "real" and not str(meta.get("permitted_use_reference", "")).strip():
        raise DataError("Real datasets require a permitted_use_reference in dataset.json.")
    if not str(meta.get("coverage_description", "")).strip():
        raise DataError("Describe the reporting universe in coverage_description; a missing row is not a zero.")
    entities = read_csv(root, "entities")
    events = read_csv(root, "events")
    coverage = read_csv(root, "coverage")
    covariates = read_csv(root, "covariates", optional=True)
    if entities.empty:
        raise DataError("Add at least one district/area or documented corridor to entities.csv.")
    if entities.entity_id.eq("").any() or entities.entity_id.duplicated().any():
        raise DataError("Entity IDs must be non-empty and unique.")
    for col in ("name", "target_type", "known_since"):
        if entities[col].eq("").any():
            raise DataError(f"entities.csv: {col} is required.")
    for i, r in entities.iterrows():
        if r.target_type not in ("area", "corridor"):
            raise DataError("target_type must be area or corridor")
        if r.target_type == "corridor" and (not r.origin_id or not r.destination_id):
            raise DataError("A corridor requires documented origin_id and destination_id.")
        if r.target_type == "corridor" and r.area_id:
            raise DataError("A corridor uses endpoints, not area_id.")
        if r.target_type == "area" and (not r.area_id or r.origin_id or r.destination_id):
            raise DataError("An area requires area_id and no inferred origin/destination.")
        if r.transport_mode not in ("Road", "Rail", "Maritime", "Air", "Unknown"):
            raise DataError("Invalid entity transport_mode")
        entities.at[i, "known_since"] = day(r.known_since)
        entities.at[i, "distance_km"] = number(r.distance_km, "distance_km", True)
    # Ambiguous entity definitions would double-count one case in the same target.
    signatures = entities.apply(lambda r: (r.target_type, r.area_id) if r.target_type == "area" else (r.target_type, r.origin_id, r.destination_id, r.transport_mode), axis=1)
    if signatures.duplicated().any():
        raise DataError("Duplicate area or corridor definition; merge the reporting universe.")
    for _, group in entities[entities.target_type == "corridor"].groupby(["origin_id", "destination_id"]):
        if len(group) > 1 and "Unknown" in set(group.transport_mode):
            raise DataError("An all-mode Unknown corridor overlaps a mode-specific corridor with the same endpoints; use one consistent partition.")
    if events.case_id.eq("").any() or events.case_id.duplicated().any():
        raise DataError("case_id is a canonical case identifier, unique across all sources. Merge duplicate reports before training.")
    for i, r in events.iterrows():
        for field in ("event_date", "available_date"):
            events.at[i, field] = day(r[field], field)
        for field in ("documented_date", "withdrawn_date"):
            events.at[i, field] = day(r[field], field) if r[field] else None
        e = events.loc[i]
        if e.available_date < e.event_date:
            raise DataError("A case cannot be available before its event date.")
        if e.documented_date and e.documented_date < e.available_date:
            raise DataError("documented_date cannot precede available_date.")
        if e.withdrawn_date and (not e.documented_date or e.withdrawn_date < e.documented_date):
            raise DataError("withdrawn_date requires an earlier documented_date.")
        if not r.seizure_area_id or not r.source_ref:
            raise DataError("Every case needs seizure_area_id and a source reference.")
        if bool(r.origin_id) != bool(r.destination_id):
            raise DataError("Provide both documented endpoints, or leave both unknown.")
        if r.substance not in SUBSTANCES or r.transport_mode not in ("Road", "Rail", "Maritime", "Air", "Unknown"):
            raise DataError("Invalid event substance or transport mode.")
        if r.source_kind not in ("department", "reviewed_news", "synthetic"):
            raise DataError("Only department, reviewed_news or synthetic sources are accepted. Raw tips/news are excluded.")
        if r.source_kind == "reviewed_news" and not r.corroboration_ref:
            raise DataError("Reviewed news needs an independent corroboration_ref, not another copied article.")
        if r.source_kind == "reviewed_news" and r.corroboration_ref == r.source_ref:
            raise DataError("corroboration_ref must differ from the original source_ref.")
        if (meta["data_mode"] == "synthetic") != (r.source_kind == "synthetic"):
            raise DataError("Do not mix synthetic and real events in one dataset.")
        events.at[i, "quantity"] = number(r.quantity, "quantity", True)
        if r.unit not in ("g", "kg", "tablets", "unknown") or (r.unit == "unknown" and r.quantity):
            raise DataError("Quantity requires an explicit g, kg or tablets unit; leave unknown quantities blank.")
    entity_ids = set(entities.entity_id)
    if coverage.duplicated(["entity_id", "week_start", "available_date"]).any():
        raise DataError("Duplicate coverage release.")
    for i, r in coverage.iterrows():
        start, available = day(r.week_start), day(r.available_date)
        if r.entity_id not in entity_ids or start.weekday() != 0 or available < start + timedelta(days=7):
            raise DataError("Coverage requires a known entity, a Monday week_start and availability on/after week end.")
        if r.complete not in ("true", "false") or not r.source_ref:
            raise DataError("Coverage complete must be true/false and source_ref is required.")
        coverage.at[i, "week_start"], coverage.at[i, "available_date"] = start, available
        coverage.at[i, "complete"] = r.complete == "true"
    if covariates.duplicated(["entity_id", "metric", "period_end", "available_date"]).any():
        raise DataError("Duplicate covariate release.")
    for i, r in covariates.iterrows():
        start, end, available = day(r.period_start), day(r.period_end), day(r.available_date)
        if r.entity_id not in entity_ids or r.metric not in METRICS or r.unit != METRICS.get(r.metric):
            raise DataError("Unknown covariate entity/metric or wrong unit.")
        if start >= end or available < end or not r.source_ref:
            raise DataError("Covariates need a non-empty measurement period, availability on/after period end and source_ref.")
        value = number(r.value, "covariate value")
        sample = number(r.sample_size, "sample_size", True)
        if sample is not None and sample != int(sample):
            raise DataError("sample_size must be an integer.")
        if r.metric == "consumption_rate" and (sample is None or sample < 30 or value > 100):
            raise DataError("Consumption is an aggregate percentage with sample_size >= 30; individual consumer data is not accepted.")
        for field, v in [("period_start", start), ("period_end", end), ("available_date", available), ("value", value), ("sample_size", sample)]:
            covariates.at[i, field] = v
    fingerprints = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.iterdir()) if p.name in ["dataset.json", *[n + ".csv" for n in HEADERS]]}
    return Dataset(root, meta, entities, events, coverage, covariates, fingerprints)


def write_csv(path: Path, name: str, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS[name])
        writer.writeheader()
        writer.writerows(rows)
