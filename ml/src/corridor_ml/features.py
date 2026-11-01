"""Snapshot features: never read observations or releases from after the origin."""
from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

import numpy as np
import pandas as pd

from .data import Dataset, METRICS, SUBSTANCES

WEEK = timedelta(days=7)


def documented(events: pd.DataFrame, as_of: date) -> pd.DataFrame:
    return events[
        (events.event_date < as_of)
        & (events.available_date <= as_of)
        & events.documented_date.map(lambda d: d is not None and d <= as_of)
        & events.withdrawn_date.map(lambda d: d is None or d > as_of)
    ]


def matching(events: pd.DataFrame, entity: pd.Series) -> pd.DataFrame:
    if entity.target_type == "area":
        return events[events.seizure_area_id == entity.area_id]
    mode = (events.transport_mode == entity.transport_mode) if entity.transport_mode != "Unknown" else True
    return events[(events.origin_id == entity.origin_id) & (events.destination_id == entity.destination_id) & mode]


class FeatureStore:
    def __init__(self, data: Dataset):
        self.data = data
        self.entities = {r.entity_id: r for _, r in data.entities.iterrows()}
        self.events = {k: matching(data.events, r) for k, r in self.entities.items()}
        self.coverage = {k: data.coverage[data.coverage.entity_id == k] for k in self.entities}
        self.context = {k: data.covariates[data.covariates.entity_id == k] for k in self.entities}

    @lru_cache(maxsize=512)
    def graph(self, as_of: date) -> pd.DataFrame:
        rows = documented(self.data.events, as_of)
        return rows[(rows.event_date >= as_of - WEEK * 13) & (rows.origin_id != "") & (rows.destination_id != "")]

    @lru_cache(maxsize=8192)
    def complete_weeks(self, entity_id: str, as_of: date) -> frozenset[date]:
        rows = self.coverage[entity_id]
        rows = rows[(rows.available_date <= as_of) & (rows.week_start.map(lambda d: d + WEEK <= as_of))]
        # A corrected release replaces the earlier assertion, at its availability date.
        rows = rows.sort_values("available_date").drop_duplicates("week_start", keep="last")
        return frozenset(rows[rows.complete == True].week_start)  # noqa: E712

    @lru_cache(maxsize=16384)
    def snapshot(self, entity_id: str, as_of: date) -> tuple[dict, dict]:
        entity = self.entities[entity_id]
        rows = documented(self.events[entity_id], as_of)
        complete = self.complete_weeks(entity_id, as_of)
        weeks = [as_of - WEEK * i for i in range(1, 27)]
        counts = np.array([float(((rows.event_date >= w) & (rows.event_date < w + WEEK)).sum()) if w in complete else np.nan for w in weeks])
        recent = rows[rows.event_date >= as_of - WEEK * 13]
        f = {
            "entity": entity_id, "origin": entity.origin_id or entity.area_id,
            "destination": entity.destination_id or entity.area_id,
            "mode": entity.transport_mode,
            "distance_km": float(entity.distance_km) if entity.distance_km is not None else np.nan,
            "week_sin": float(np.sin(2 * np.pi * as_of.isocalendar().week / 52.18)),
            "week_cos": float(np.cos(2 * np.pi * as_of.isocalendar().week / 52.18)),
            "observed_cases_4w": int((recent.event_date >= as_of - WEEK * 4).sum()),
            "coverage_13w": float(np.isfinite(counts[:13]).mean()),
            "coverage_26w": float(np.isfinite(counts).mean()),
        }
        for lag in (1, 2, 4, 8, 13, 26):
            f[f"lag_{lag}w"] = counts[lag - 1]
        for length in (4, 8, 13, 26):
            subset = counts[:length]
            f[f"mean_{length}w"] = float(np.nanmean(subset)) if np.isfinite(subset).any() else np.nan
            f[f"covered_{length}w"] = int(np.isfinite(subset).sum())
        previous = counts[4:8]
        prev_mean = float(np.nanmean(previous)) if np.isfinite(previous).any() else np.nan
        f["trend_4w"] = f["mean_4w"] - prev_mean
        for substance in SUBSTANCES:
            sub = recent[recent.substance == substance]
            f[f"observed_{substance.lower()}_13w"] = len(sub)
            mass = sub[sub.unit.isin(["g", "kg"]) & sub.quantity.notna()]
            grams = sum(float(r.quantity) * (1000 if r.unit == "kg" else 1) for _, r in mass.iterrows())
            f[f"log_mass_{substance.lower()}_13w"] = float(np.log1p(grams)) if len(mass) else np.nan
            tablets = sub[(sub.unit == "tablets") & sub.quantity.notna()]
            f[f"log_tablets_{substance.lower()}_13w"] = float(np.log1p(tablets.quantity.astype(float).sum())) if len(tablets) else np.nan
        # Only documented movement edges form the network. Seizure-only points never do.
        graph = self.graph(as_of)
        origin, dest = entity.origin_id or entity.area_id, entity.destination_id or entity.area_id
        f["observed_incoming_origin_13w"] = int((graph.destination_id == origin).sum())
        f["observed_outgoing_destination_13w"] = int((graph.origin_id == dest).sum())
        external = self.context[entity_id]
        external = external[(external.available_date <= as_of) & (external.period_end <= as_of)]
        stale_metrics = []
        for metric in METRICS:
            candidates = external[external.metric == metric].sort_values(["period_end", "available_date"])
            if len(candidates):
                latest = candidates.iloc[-1]
                age = (as_of - latest.period_end).days
                f[f"context_{metric}"] = float(latest.value) if age <= 91 else np.nan
                f[f"age_{metric}"] = age
                if age > 91:
                    stale_metrics.append(metric)
            else:
                f[f"context_{metric}"] = np.nan
                f[f"age_{metric}"] = np.nan
        baseline = float(np.nanmean(counts[:13])) if np.isfinite(counts[:13]).any() else None
        last = float(np.nanmean(counts[:4])) if np.isfinite(counts[:4]).any() else baseline
        info = {"support_13w": len(recent), "covered_13w": int(np.isfinite(counts[:13]).sum()), "baseline_weekly": baseline, "recent_weekly": last, "stale_metrics": stale_metrics}
        return f, info

    def target(self, entity_id: str, origin: date, horizon: int, label_cutoff: date) -> int | None:
        weeks = {origin + WEEK * i for i in range(horizon)}
        if not weeks.issubset(self.complete_weeks(entity_id, label_cutoff)):
            return None
        rows = documented(self.events[entity_id], label_cutoff)
        return int(((rows.event_date >= origin) & (rows.event_date < origin + WEEK * horizon)).sum())

    def panel(self, target_type: str, as_of: date, horizon: int, delay: int) -> pd.DataFrame:
        coverage = self.data.coverage
        if coverage.empty:
            return pd.DataFrame()
        first = coverage.week_start.min() + WEEK * 26
        origin, rows = first, []
        while origin + WEEK * (horizon + delay) <= as_of:
            label_cutoff = origin + WEEK * (horizon + delay)
            for key, entity in self.entities.items():
                if entity.target_type != target_type or entity.known_since > origin:
                    continue
                features, info = self.snapshot(key, origin)
                if info["covered_13w"] < 8:
                    continue
                y = self.target(key, origin, horizon, label_cutoff)
                if y is None:
                    continue
                rows.append({"origin": origin, "label_cutoff": label_cutoff, "entity_id": key, "y": y, "features": features, "baseline": info["baseline_weekly"] * horizon, "recent_baseline": info["recent_weekly"] * horizon})
            origin += WEEK
        return pd.DataFrame(rows)
